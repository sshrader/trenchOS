import { getMintInfo } from '../../../lib/solana.js';
import { whaleReport } from '../../../lib/whales.js';
import { explainWhales } from '../../../lib/explain.js';
import { guard } from '../../../lib/guard.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    const mintInfo = await getMintInfo(mint);
    if (!mintInfo) return Response.json({ error: 'That address is not a token mint.' }, { status: 404 });

    const report = await whaleReport(mint, mintInfo);
    if (report.empty) {
      return Response.json({ error: 'No holder data was returned for this token.' }, { status: 404 });
    }
    const { text: explanation, source: explanationSource } = await explainWhales(report.summary);

    return Response.json({
      mint,
      generatedAt: new Date().toISOString(),
      summary: report.summary,
      holders: report.rows,
      perWalletTxLimit: report.perWalletTxLimit,
      explanation,
      explanationSource,
      caveats: [
        `Activity covers each wallet's most recent ${report.perWalletTxLimit} transactions on its token account, so the time window differs per wallet.`,
        'Moving tokens between wallets someone owns looks the same as buying or selling. Net change is a movement measure, not proof of a trade.',
        'Pools, vaults and bonding curves are program-controlled and are listed but not tracked as whales.',
        'Past activity only. Nothing here predicts price or tells you what to do.',
      ],
      sources: ['Solana RPC (largest token accounts and parsed transactions)'],
    });
  } catch (err) {
    console.error('whale-radar failed', err);
    const detail = typeof err?.message === 'string' && err.message.startsWith('RPC') ? err.message : undefined;
    return Response.json({ error: 'Whale scan failed. A data provider may be unavailable.', detail }, { status: 502 });
  }
}
