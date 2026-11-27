import { getMarket } from '../../../lib/solana.js';
import { getCandles } from '../../../lib/candles.js';
import { runWars, FEE, START_CASH } from '../../../lib/agents.js';
import { explainWars } from '../../../lib/explain.js';
import { guard } from '../../../lib/guard.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MIN_CANDLES = 60;
const TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // mint -> { at, data }

export async function POST(request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const mint = String(body?.mint ?? '').trim();
  if (!BASE58.test(mint)) return Response.json({ error: 'That does not look like a Solana mint address.' }, { status: 400 });

  const hit = cache.get(mint);
  if (hit && Date.now() - hit.at < TTL_MS) return Response.json({ ...hit.data, cached: true });

  try {
    const pair = await getMarket(mint);
    if (!pair?.pairAddress) return Response.json({ error: 'No trading pool was found for this token.' }, { status: 404 });
    if (pair.baseToken?.address !== mint) {
      return Response.json({ error: 'This token trades as the quote side of its best pool, so its price history is not usable here.' }, { status: 422 });
    }
    const liquidityUsd = pair.liquidity?.usd ?? 0;
    if (liquidityUsd < 1000) {
      return Response.json({ error: 'This pool has under $1,000 of liquidity, too thin to simulate fills sensibly.' }, { status: 422 });
    }
    // Young tokens have too few 5-minute candles, so fall back to 1-minute candles.
    let minutes = 5;
    let candles = await getCandles(pair.pairAddress, { minutes, limit: 1000 });
    if (candles.length < MIN_CANDLES) {
      minutes = 1;
      candles = await getCandles(pair.pairAddress, { minutes, limit: 1000 });
    }
    if (candles.length < MIN_CANDLES) {
      return Response.json(
        { error: `This token is too new: only ${candles.length} one-minute candles exist (at least ${MIN_CANDLES} needed). Try again once it has traded for an hour or more.` },
        { status: 422 },
      );
    }
    const wars = runWars(candles, { liquidityUsd, seed: mint });
    const hours = (candles[candles.length - 1].t - candles[0].t) / 3.6e6;
    const { text: explanation, source: explanationSource } = await explainWars(wars, hours);

    const data = {
      mint,
      symbol: String(pair.baseToken?.symbol ?? '').slice(0, 14),
      generatedAt: new Date().toISOString(),
      window: { start: candles[0].t, end: candles[candles.length - 1].t, hours, candles: candles.length, candleMinutes: minutes },
      assumptions: { startCash: START_CASH, feePct: FEE * 100, liquidityUsd },
      ...wars,
      explanation,
      explanationSource,
      caveats: [
        'Simulated paper trading on past prices. It does not predict future prices, and no agent here is advice.',
        'Agents see only candles up to the current one and fill at the next candle\'s open, so none can peek ahead.',
        `Costs: ${(FEE * 100).toFixed(1)}% fee per trade plus slippage estimated from the pool's current liquidity. Past liquidity may have been different, so real costs could be higher or lower.`,
        'One token over a short window is a tiny sample. A strategy that wins here can lose on the next token. The random agent shows how much luck matters.',
        'Candles only exist for minutes with trades, so quiet periods are missing and a young or thin token may cover less time than the candle count suggests.',
        'Each agent goes all-in on one position at a time. Real trading has failed transactions, MEV and delays that this does not model.',
      ],
      sources: ['DexScreener (best pool and liquidity)', `GeckoTerminal (${minutes}-minute price candles)`],
    };
    cache.set(mint, { at: Date.now(), data });
    if (cache.size > 50) cache.delete(cache.keys().next().value);
    return Response.json(data);
  } catch (err) {
    console.error('agent-wars failed', err);
    const m = typeof err?.message === 'string' ? err.message : '';
    const detail = m.startsWith('Candle') || m.startsWith('RPC') ? m : undefined;
    return Response.json({ error: 'Simulation failed. A data provider may be unavailable.', detail }, { status: 502 });
  }
}
