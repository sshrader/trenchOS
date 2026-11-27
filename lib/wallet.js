// Deterministic wallet behavior analysis. All arithmetic lives here, never in the LLM.
// Works on parsed swaps from Helius. PnL is approximate: it ignores fees, transfers,
// and anything that happened before the sampled window.

const WSOL = 'So11111111111111111111111111111111111111112';

const tokenAmount = (t) =>
  t?.rawTokenAmount?.tokenAmount != null
    ? Number(t.rawTokenAmount.tokenAmount) / 10 ** (t.rawTokenAmount.decimals ?? 0)
    : Number(t?.tokenAmount ?? 0);

// Fallback for transactions Helius does not label as swaps (for example bonding-curve buys):
// infer a buy or sell from the wallet's net SOL and token movement. Needs exactly one
// non-SOL token moving in the opposite direction to SOL.
function classifyByTransfers(tx, wallet) {
  let sol = 0;
  for (const n of tx?.nativeTransfers ?? []) {
    const a = Number(n.amount ?? 0) / 1e9;
    if (n.toUserAccount === wallet) sol += a;
    else if (n.fromUserAccount === wallet) sol -= a;
  }
  const tokens = new Map();
  for (const t of tx?.tokenTransfers ?? []) {
    const a = Number(t.tokenAmount ?? 0);
    const sign = t.toUserAccount === wallet ? 1 : t.fromUserAccount === wallet ? -1 : 0;
    if (!sign) continue;
    if (t.mint === WSOL) sol += sign * a;
    else tokens.set(t.mint, (tokens.get(t.mint) ?? 0) + sign * a);
  }
  const moved = [...tokens.entries()].filter(([, v]) => v !== 0);
  if (moved.length !== 1 || Math.abs(sol) < 0.001) return null;
  const [mint, net] = moved[0];
  const ts = Number(tx.timestamp ?? 0);
  if (sol < 0 && net > 0) return { type: 'buy', mint, sol: -sol, amount: net, ts };
  if (sol > 0 && net < 0) return { type: 'sell', mint, sol, amount: -net, ts };
  return null;
}

// Turns one parsed transaction into a SOL buy or sell of a token, or null if it is something else.
export function classify(swap, wallet) {
  if (swap?.transactionError) return null;
  return classifyBySwapEvent(swap, wallet) ?? classifyByTransfers(swap, wallet);
}

function classifyBySwapEvent(swap, wallet) {
  const s = swap?.events?.swap;
  if (!s) return null;
  let solSpent = 0;
  let solGot = 0;
  let tokIn = null;
  let tokOut = null;
  if (s.nativeInput?.account === wallet) solSpent += Number(s.nativeInput.amount) / 1e9;
  if (s.nativeOutput?.account === wallet) solGot += Number(s.nativeOutput.amount) / 1e9;
  for (const t of s.tokenInputs ?? []) {
    if (t.userAccount !== wallet) continue;
    if (t.mint === WSOL) solSpent += tokenAmount(t);
    else tokIn = { mint: t.mint, amount: tokenAmount(t) };
  }
  for (const t of s.tokenOutputs ?? []) {
    if (t.userAccount !== wallet) continue;
    if (t.mint === WSOL) solGot += tokenAmount(t);
    else tokOut = { mint: t.mint, amount: tokenAmount(t) };
  }
  const ts = Number(swap.timestamp ?? 0);
  if (solSpent > 0 && tokOut && !tokIn) return { type: 'buy', mint: tokOut.mint, sol: solSpent, amount: tokOut.amount, ts };
  if (solGot > 0 && tokIn && !tokOut) return { type: 'sell', mint: tokIn.mint, sol: solGot, amount: tokIn.amount, ts };
  return null;
}

const median = (xs) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const ARCHETYPES = {
  MYSTERY: { name: 'THE MYSTERY WALLET', blurb: 'Not enough swap history in the sample to profile.' },
  SPEED: { name: 'THE 2-MINUTE MILLIONAIRE', blurb: 'Gets in and out before the chart finishes loading.' },
  EXIT: { name: 'THE PROFESSIONAL EXIT LIQUIDITY', blurb: 'Closes most positions at a loss. Someone has to provide the liquidity.' },
  DIAMOND: { name: 'THE DIAMOND-HANDED PSYCHOPATH', blurb: 'Buys plenty, sells rarely. Positions are more of a lifestyle.' },
  DIPPER: { name: 'THE SERIAL DIPPER', blurb: 'Keeps adding to the same tokens. Every drop is a sale.' },
  STEADY: { name: 'THE STEADY TRENCHER', blurb: 'No extreme habits in this sample. Suspiciously normal.' },
};

function pickArchetype(m) {
  if (m.closedTokens < 3) return 'MYSTERY';
  if (m.medianHoldMin != null && m.medianHoldMin < 15) return 'SPEED';
  if (m.winRatePct < 35) return 'EXIT';
  if (m.unsoldPct >= 60) return 'DIAMOND';
  if (m.avgBuysPerToken >= 2) return 'DIPPER';
  return 'STEADY';
}

export function analyze(swaps, wallet) {
  const trades = swaps
    .map((s) => classify(s, wallet))
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);

  const byMint = new Map();
  for (const t of trades) {
    const r = byMint.get(t.mint) ?? { boughtAmt: 0, boughtSol: 0, soldAmt: 0, soldSol: 0, firstBuy: null, lastSell: null, buyCount: 0 };
    if (t.type === 'buy') {
      r.boughtAmt += t.amount;
      r.boughtSol += t.sol;
      r.buyCount += 1;
      if (r.firstBuy == null) r.firstBuy = t.ts;
    } else {
      r.soldAmt += t.amount;
      r.soldSol += t.sol;
      r.lastSell = t.ts;
    }
    byMint.set(t.mint, r);
  }

  const closed = [];
  let tokensWithBuys = 0;
  let unsold = 0;
  let totalBuys = 0;
  for (const r of byMint.values()) {
    if (r.boughtAmt > 0) {
      tokensWithBuys += 1;
      totalBuys += r.buyCount;
      if (r.soldAmt < 0.1 * r.boughtAmt) unsold += 1;
    }
    if (r.boughtAmt > 0 && r.soldAmt > 0) {
      // Only match sells against buys we can see. Extra sold amount was bought before the sample.
      const matched = Math.min(1, r.boughtAmt / r.soldAmt);
      const soldSolMatched = r.soldSol * matched;
      const frac = Math.min(r.soldAmt, r.boughtAmt) / r.boughtAmt;
      const cost = r.boughtSol * frac;
      const pnl = soldSolMatched - cost;
      closed.push({
        pnl,
        pct: cost > 0 ? (pnl / cost) * 100 : null,
        holdMin: r.firstBuy != null && r.lastSell != null && r.lastSell >= r.firstBuy ? (r.lastSell - r.firstBuy) / 60 : null,
      });
    }
  }

  const withPct = closed.filter((c) => c.pct != null);
  const metrics = {
    tradesAnalyzed: trades.length,
    buys: trades.filter((t) => t.type === 'buy').length,
    sells: trades.filter((t) => t.type === 'sell').length,
    distinctTokens: byMint.size,
    closedTokens: closed.length,
    winRatePct: closed.length ? (closed.filter((c) => c.pnl > 0).length / closed.length) * 100 : 0,
    medianHoldMin: median(closed.map((c) => c.holdMin).filter((x) => x != null)),
    bestPct: withPct.length ? Math.max(...withPct.map((c) => c.pct)) : null,
    worstPct: withPct.length ? Math.min(...withPct.map((c) => c.pct)) : null,
    totalRealizedSol: closed.reduce((sum, c) => sum + c.pnl, 0),
    unsoldPct: tokensWithBuys ? (unsold / tokensWithBuys) * 100 : 0,
    avgBuysPerToken: tokensWithBuys ? totalBuys / tokensWithBuys : 0,
  };

  const id = trades.length < 6 ? 'MYSTERY' : pickArchetype(metrics);
  return {
    archetype: { id, ...ARCHETYPES[id] },
    metrics,
    sample: {
      transactionsFetched: swaps.length,
      windowStart: trades.length ? new Date(trades[0].ts * 1000).toISOString() : null,
      windowEnd: trades.length ? new Date(trades[trades.length - 1].ts * 1000).toISOString() : null,
    },
    caveats: [
      'Based only on recent SOL swaps in the sample window.',
      'PnL is approximate: it ignores fees and transfers, and only matches sells against buys inside the window.',
      'Entertainment, not financial advice. Describes wallet behavior only, never a person.',
    ],
  };
}

const f1 = (n) => (n == null ? 'n/a' : n.toFixed(1));

// Zero-cost fallback roast, built from the computed metrics.
export function roastTemplate(profile) {
  const m = profile.metrics;
  switch (profile.archetype.id) {
    case 'MYSTERY':
      return `Only ${m.tradesAnalyzed} readable swaps in this sample. Either a very disciplined wallet or one that hasn't started yet.`;
    case 'SPEED':
      return `Median hold time is ${f1(m.medianHoldMin)} minutes. That is not a position, that is a glance.`;
    case 'EXIT':
      return `Win rate of ${f1(m.winRatePct)}% across ${m.closedTokens} closed tokens. Every market needs liquidity, and this wallet is generous.`;
    case 'DIAMOND':
      return `${f1(m.unsoldPct)}% of bought tokens were never meaningfully sold. Either conviction or the sell button is broken.`;
    case 'DIPPER':
      return `${f1(m.avgBuysPerToken)} buys per token on average. When in doubt, add more.`;
    default:
      return `${m.closedTokens} closed tokens, ${f1(m.winRatePct)}% win rate, no wild habits. Boring is underrated.`;
  }
}
