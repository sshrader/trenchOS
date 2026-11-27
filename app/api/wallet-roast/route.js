import { getSwaps } from '../../../lib/solana.js';
import { analyze } from '../../../lib/wallet.js';
import { roast } from '../../../lib/explain.js';
import { guard } from '../../../lib/guard.js';

export const dynamic = 'force-dynamic';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST(request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  if (!process.env.HELIUS_API_KEY) {
    return Response.json({ error: 'Wallet Roast needs HELIUS_API_KEY to be set.' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const wallet = String(body?.wallet ?? '').trim();
  if (!BASE58.test(wallet)) {
    return Response.json({ error: 'That does not look like a Solana wallet address.' }, { status: 400 });
  }

  try {
    const swaps = await getSwaps(wallet);
    const profile = analyze(swaps, wallet);
    const { text, source } = await roast(profile);
    return Response.json({
      wallet,
      generatedAt: new Date().toISOString(),
      ...profile,
      roast: text,
      roastSource: source,
      sources: ['Helius enhanced transactions (parsed swaps)'],
    });
  } catch (err) {
    console.error('wallet-roast failed', err);
    const detail = typeof err?.message === 'string' && err.message.startsWith('RPC') ? err.message : undefined;
    return Response.json({ error: 'Roast failed. A data provider may be unavailable.', detail }, { status: 502 });
  }
}
