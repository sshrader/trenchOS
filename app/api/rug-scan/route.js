import { getMintInfo, getTopHolders, getMarket } from '../../../lib/solana.js';
import { deployerReport } from '../../../lib/deployer.js';
import { buildChecks } from '../../../lib/checks.js';
import { explain } from '../../../lib/explain.js';
import { guard } from '../../../lib/guard.js';

export const dynamic = 'force-dynamic';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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
  if (!BASE58.test(mint)) {
    return Response.json({ error: 'That does not look like a Solana mint address.' }, { status: 400 });
  }

  try {
    const [mintInfo, holders, market, deployer] = await Promise.all([
      getMintInfo(mint),
      getTopHolders(mint).catch((e) => { console.error('holders failed', e); return null; }),
      getMarket(mint).catch(() => null),
      deployerReport(mint).catch((e) => { console.error('deployer failed', e); return null; }),
    ]);
    if (!mintInfo) {
      return Response.json({ error: 'That address is not a token mint.' }, { status: 404 });
    }

    const { checks, summary } = buildChecks({ mintInfo, holders, market, deployer });
    const { text: explanation, source: explanationSource } = await explain({ summary, checks });

    return Response.json({
      mint,
      generatedAt: new Date().toISOString(),
      summary,
      checks,
      explanation,
      explanationSource,
      sources: ['Solana RPC (on-chain accounts and transactions)', 'DexScreener (pool and liquidity data)'],
    });
  } catch (err) {
    console.error('rug-scan failed', err);
    // Our own RPC errors never contain the URL or key, so their message is safe to show.
    const detail = typeof err?.message === 'string' && err.message.startsWith('RPC') ? err.message : undefined;
    return Response.json(
      { error: 'Scan failed. A data provider may be unavailable.', detail },
      { status: 502 },
    );
  }
}
