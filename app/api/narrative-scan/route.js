import { fetchSample, cluster } from '../../../lib/narratives.js';
import { explainNarratives } from '../../../lib/explain.js';
import { guard } from '../../../lib/guard.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// The same data goes to everyone, so cache it briefly to stay inside DexScreener's rate limits.
const TTL_MS = 3 * 60 * 1000;
let cache = null;

export async function POST(request) {
  const blocked = guard(request);
  if (blocked) return blocked;

  if (cache && Date.now() - cache.at < TTL_MS) {
    return Response.json({ ...cache.data, cached: true });
  }
  try {
    const sample = await fetchSample();
    if (sample.tokens.length === 0) {
      return Response.json({ error: 'DexScreener returned no Solana tokens right now. Try again in a minute.' }, { status: 502 });
    }
    const { themes, grouped, ungrouped } = cluster(sample.tokens);
    const { text: explanation, source: explanationSource } = await explainNarratives(themes);
    const data = {
      generatedAt: new Date().toISOString(),
      sample: { tokens: sample.tokens.length, requested: sample.requested, grouped, ungrouped, sources: sample.sources },
      themes,
      explanation,
      explanationSource,
      caveats: [
        'The sample is the tokens DexScreener lists as recent profiles or boosts on Solana. It is small and biased toward tokens whose creators paid for promotion.',
        'Themes are shared words in token names. A word can match for unrelated reasons.',
        'Momentum compares tokens launched in the last 3 hours to the 3 to 24 hours before. It is about launch counts, not price.',
        'Nothing here predicts price or tells you what to do.',
      ],
      sources: ['DexScreener (token profiles, boosts, pairs and liquidity)'],
    };
    cache = { at: Date.now(), data };
    return Response.json(data);
  } catch (err) {
    console.error('narrative-scan failed', err);
    return Response.json({ error: 'Narrative scan failed. DexScreener may be unavailable.' }, { status: 502 });
  }
}
