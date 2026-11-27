// Narrative Scanner: groups recently promoted Solana tokens into themes by shared name words,
// then reports how each theme is trending. Clustering and every number come from code.
// Nothing here predicts prices. Token names are creator-controlled text, so they are only
// ever shown as plain text, and only short [a-z0-9] theme words reach any model.

const SAMPLE_CAP = 90;
const MIN_TOKENS = 2;
const RECENT_H = 3;
const EARLIER_H = 24;
const THIN_LIQ = 5000;
const CROWDED_AT = 6;

const STOP = new Set([
  'the', 'and', 'coin', 'token', 'sol', 'solana', 'pump', 'pumpfun', 'official', 'new', 'of', 'to', 'for', 'on', 'in',
  'is', 'my', 'you', 'with', 'from', 'inc', 'ltd', 'dao', 'fun', 'meme', 'memecoin', 'crypto', 'wrapped',
]);

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`DexScreener request failed with HTTP ${res.status}`);
  return res.json();
}

// Recently promoted tokens (profiles and boosts) on Solana. Returns {mints, sources}.
async function promotedMints() {
  const endpoints = [
    ['profiles', 'https://api.dexscreener.com/token-profiles/latest/v1'],
    ['boosts', 'https://api.dexscreener.com/token-boosts/latest/v1'],
    ['top boosts', 'https://api.dexscreener.com/token-boosts/top/v1'],
  ];
  const results = await Promise.all(endpoints.map(([, u]) => getJson(u).catch(() => null)));
  const mints = new Map();
  const sources = [];
  results.forEach((list, i) => {
    if (!Array.isArray(list)) return;
    sources.push(endpoints[i][0]);
    for (const it of list) {
      if (it?.chainId === 'solana' && typeof it.tokenAddress === 'string') {
        const cur = mints.get(it.tokenAddress) ?? { boosted: false };
        if (endpoints[i][0] !== 'profiles') cur.boosted = true;
        mints.set(it.tokenAddress, cur);
      }
    }
  });
  return { mints, sources };
}

async function pairsFor(mintList) {
  const best = new Map();
  for (let i = 0; i < mintList.length; i += 30) {
    const part = mintList.slice(i, i + 30);
    let pairs;
    try { pairs = await getJson(`https://api.dexscreener.com/tokens/v1/solana/${part.join(',')}`); } catch { continue; }
    for (const p of Array.isArray(pairs) ? pairs : []) {
      const m = p?.baseToken?.address;
      if (!m) continue;
      const liq = p.liquidity?.usd ?? 0;
      if (!best.has(m) || liq > best.get(m).liq) best.set(m, { liq, p });
    }
  }
  return best;
}

export async function fetchSample(now = Date.now()) {
  const { mints, sources } = await promotedMints();
  const list = [...mints.keys()].slice(0, SAMPLE_CAP);
  const pairs = await pairsFor(list);
  const tokens = [];
  for (const mint of list) {
    const hit = pairs.get(mint);
    if (!hit) continue;
    const p = hit.p;
    tokens.push({
      mint,
      name: String(p.baseToken.name ?? '').slice(0, 40),
      symbol: String(p.baseToken.symbol ?? '').slice(0, 14),
      liquidityUsd: hit.liq,
      volume24h: p.volume?.h24 ?? 0,
      ageHours: p.pairCreatedAt ? Math.max(0, (now - p.pairCreatedAt) / 3.6e6) : null,
      boosted: mints.get(mint).boosted,
    });
  }
  return { tokens, requested: list.length, sources };
}

// Words from a token's name and symbol, lowercased. Splits camelCase and non-alphanumerics.
export function words(token) {
  const text = `${token.name} ${token.symbol}`.replace(/([a-z])([A-Z])/g, '$1 $2');
  const out = new Set();
  for (const w of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length >= 2 && w.length <= 12 && !/^\d+$/.test(w) && !STOP.has(w)) out.add(w);
  }
  return out;
}

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function momentum(nRecent, nEarlier, n) {
  if (n < 3) return 'too few to call';
  const rateRecent = nRecent / RECENT_H;
  const rateEarlier = nEarlier / (EARLIER_H - RECENT_H);
  if (nRecent >= 2 && rateRecent >= 2 * rateEarlier) return 'accelerating';
  if (nEarlier >= 3 && rateRecent <= 0.5 * rateEarlier) return 'fading';
  return 'steady';
}

// Pure: tokens in, themes out. Each token lands in at most one theme (the biggest word group it belongs to).
export function cluster(tokens) {
  const byWord = new Map();
  for (const t of tokens) for (const w of words(t)) {
    if (!byWord.has(w)) byWord.set(w, []);
    byWord.get(w).push(t);
  }
  const groups = [...byWord.entries()].filter(([, ts]) => ts.length >= MIN_TOKENS).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const taken = new Set();
  const themes = [];
  for (const [word, ts] of groups) {
    const free = ts.filter((t) => !taken.has(t.mint));
    if (free.length < MIN_TOKENS) continue;
    free.forEach((t) => taken.add(t.mint));
    const ages = free.map((t) => t.ageHours).filter((a) => a != null);
    const nRecent = ages.filter((a) => a < RECENT_H).length;
    const nEarlier = ages.filter((a) => a >= RECENT_H && a < EARLIER_H).length;
    themes.push({
      word,
      count: free.length,
      recent: nRecent,
      earlier: nEarlier,
      older: ages.filter((a) => a >= EARLIER_H).length,
      momentum: momentum(nRecent, nEarlier, free.length),
      crowded: free.length >= CROWDED_AT,
      thinSharePct: (free.filter((t) => t.liquidityUsd < THIN_LIQ).length / free.length) * 100,
      medianLiquidityUsd: median(free.map((t) => t.liquidityUsd)),
      volume24h: free.reduce((s, t) => s + t.volume24h, 0),
      examples: [...free].sort((a, b) => b.liquidityUsd - a.liquidityUsd).slice(0, 4),
    });
  }
  themes.sort((a, b) => b.count - a.count || b.volume24h - a.volume24h);
  return { themes, grouped: taken.size, ungrouped: tokens.length - taken.size };
}

export function narrativeTemplate(themes) {
  if (!themes.length) return 'No shared name themes showed up in this sample. That is common when the sample is small. Try again later.';
  const top = themes.slice(0, 3).map((t) => `"${t.word}" (${t.count} tokens, ${t.momentum})`);
  const crowded = themes.filter((t) => t.crowded).map((t) => `"${t.word}"`);
  const parts = [`The largest name themes in this sample are ${top.join(', ')}.`];
  if (crowded.length) parts.push(`Crowded with many look-alikes: ${crowded.join(', ')}.`);
  parts.push('Themes are grouped by shared words in token names, from a small sample. This describes what was launched or promoted recently, not what will happen next.');
  return parts.join(' ');
}

// Only short [a-z0-9] words and numbers go to a model.
export function modelPayload(themes) {
  return themes.slice(0, 8).map((t) => ({
    theme: /^[a-z0-9]{2,12}$/.test(t.word) ? t.word : 'unnamed',
    tokens: t.count,
    momentum: t.momentum,
    crowded: t.crowded,
    thinLiquiditySharePct: Math.round(t.thinSharePct),
    launchedLast3h: t.recent,
    launched3to24hAgo: t.earlier,
  }));
}
