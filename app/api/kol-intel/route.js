import { getWalletTransactions } from '../../../lib/solana.js';
import { analyze } from '../../../lib/wallet.js';
import { parseCalls, isWallet, walletEvents, timing, summarize, LINKS } from '../../../lib/kol.js';
import { explainKol } from '../../../lib/explain.js';
import { guard } from '../../../lib/guard.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  const blocked = guard(request);
  if (blocked) return blocked;
  if (!process.env.HELIUS_API_KEY) {
    return Response.json({ error: 'KOL Intelligence needs HELIUS_API_KEY to be set.' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const handle = String(body?.handle ?? '').trim().replace(/^@/, '');
  const wallet = String(body?.wallet ?? '').trim();
  const link = String(body?.link ?? 'unknown');
  const text = String(body?.calls ?? '').slice(0, 4000);
  if (handle && !/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return Response.json({ error: 'Handle should be 1 to 15 letters, numbers or underscores.' }, { status: 400 });
  }
  if (!isWallet(wallet)) return Response.json({ error: 'That does not look like a Solana wallet address.' }, { status: 400 });
  if (!LINKS[link]) return Response.json({ error: 'Choose how the wallet is linked to the account.' }, { status: 400 });
  const { calls, problems } = parseCalls(text);
  if (calls.length === 0) {
    return Response.json({ error: `Add at least one line like "mint, 2025-11-20 14:30". ${problems[0] ?? ''}`.trim() }, { status: 400 });
  }

  try {
    const txs = await getWalletTransactions(wallet, { pages: 5, limit: 100 });
    const { byMint, windowStart } = walletEvents(txs, wallet);
    const results = calls.map((c) => timing(c, byMint.get(c.mint), windowStart));
    const summary = summarize(results);
    const footprint = analyze(txs, wallet);
    const { text: explanation, source: explanationSource } = await explainKol(summary, link);
    return Response.json({
      generatedAt: new Date().toISOString(),
      handle: handle || null,
      wallet,
      link: { id: link, ...LINKS[link] },
      problems,
      window: { transactions: txs.length, start: windowStart },
      summary,
      results,
      footprint: footprint.metrics.tradesAnalyzed >= 6 ? { archetype: footprint.archetype.name, metrics: footprint.metrics } : null,
      explanation,
      explanationSource,
      caveats: [
        'This tool does not read X. You supplied the post times, and they are only as accurate as what you entered. Times without a zone are read as UTC.',
        'It sees only the wallet you entered. A person can use many wallets, and a wallet can be shared, so a clean result proves nothing either way.',
        'Only the most recent transactions are fetched. Mentions older than that are marked as outside the history.',
        'Buying before a post and selling after it can also be ordinary trading. Timing is a pattern to look at, never proof of intent.',
        'Use this on public accounts and wallets they have disclosed or that are otherwise established. Do not use it to track private individuals.',
      ],
      sources: ['Helius enhanced transactions (token transfers for the wallet)'],
    });
  } catch (err) {
    console.error('kol-intel failed', err);
    const detail = typeof err?.message === 'string' && err.message.startsWith('RPC') ? err.message : undefined;
    return Response.json({ error: 'Lookup failed. A data provider may be unavailable.', detail }, { status: 502 });
  }
}
