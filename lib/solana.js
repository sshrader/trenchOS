// Data access only. No scoring or opinions here.

function rpcUrl() {
  const key = process.env.HELIUS_API_KEY;
  return key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : 'https://api.mainnet-beta.solana.com';
}

// Error messages here never include the URL or key, so they are safe to show to users.
export async function rpc(method, params) {
  const res = await fetch(rpcUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`RPC ${method} failed with HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// JSON-RPC batch. Returns results in the same order as calls (null where a call failed).
// Retries on HTTP 429 (rate limit) with backoff, so busy tokens degrade to slower instead of failing.
export async function rpcBatch(calls) {
  if (calls.length === 0) return [];
  const body = JSON.stringify(calls.map((c, i) => ({ jsonrpc: '2.0', id: i, method: c.method, params: c.params })));
  let res;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch(rpcUrl(), { method: 'POST', headers: { 'content-type': 'application/json' }, body, cache: 'no-store' });
    if (res.status !== 429) break;
    const wait = Number(res.headers.get('retry-after')) * 1000 || 700 * 2 ** attempt;
    await sleep(Math.min(wait, 6000));
  }
  if (!res.ok) throw new Error(`RPC batch failed with HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error('RPC batch returned an unexpected response');
  const out = new Array(calls.length).fill(null);
  for (const r of json) {
    if (r && typeof r.id === 'number') out[r.id] = r.result ?? null;
  }
  return out;
}

export async function getMintInfo(mint) {
  const result = await rpc('getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
  const value = result?.value;
  const parsed = value?.data?.parsed;
  if (!value || !parsed || parsed.type !== 'mint') return null;
  return {
    mintAuthority: parsed.info.mintAuthority ?? null,
    freezeAuthority: parsed.info.freezeAuthority ?? null,
    supply: Number(parsed.info.supply),
    decimals: parsed.info.decimals,
  };
}

// Returns the largest token accounts with their owner wallets resolved.
export async function getTopHolders(mint, limit = 10) {
  const result = await rpc('getTokenLargestAccounts', [mint]);
  const top = (result?.value ?? []).slice(0, limit);
  if (top.length === 0) return [];
  const accounts = await rpc('getMultipleAccounts', [
    top.map((t) => t.address),
    { encoding: 'jsonParsed' },
  ]);
  return top.map((t, i) => ({
    tokenAccount: t.address,
    owner: accounts?.value?.[i]?.data?.parsed?.info?.owner ?? null,
    uiAmount: t.uiAmount ?? 0,
  }));
}

// Best pool by liquidity from DexScreener, or null.
export async function getMarket(mint) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = await res.json();
  const pairs = (json.pairs ?? []).filter((p) => p.chainId === 'solana');
  pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  return pairs[0] ?? null;
}

// Best liquidity in USD per mint for up to 30 mints. Mints with no pool are absent from the map.
export async function getMarketsBatch(mints) {
  const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mints.join(',')}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`DexScreener batch failed with HTTP ${res.status}`);
  const pairs = await res.json();
  const best = new Map();
  for (const p of Array.isArray(pairs) ? pairs : []) {
    const mint = p?.baseToken?.address;
    if (!mint) continue;
    best.set(mint, Math.max(best.get(mint) ?? 0, p.liquidity?.usd ?? 0));
  }
  return best;
}

// Parsed transactions for a wallet from Helius' enhanced transactions API (newest first).
// Pass type 'SWAP' to filter, or omit it for everything. Requires HELIUS_API_KEY.
export async function getWalletTransactions(wallet, { type, pages = 2, limit = 100 } = {}) {
  const key = process.env.HELIUS_API_KEY;
  if (!key) throw new Error('RPC enhanced transactions need HELIUS_API_KEY');
  const out = [];
  let before;
  for (let i = 0; i < pages; i++) {
    const url = new URL(`https://api.helius.xyz/v0/addresses/${wallet}/transactions`);
    url.searchParams.set('api-key', key);
    if (type) url.searchParams.set('type', type);
    url.searchParams.set('limit', String(limit));
    if (before) url.searchParams.set('before', before);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`RPC enhanced transactions failed with HTTP ${res.status}`);
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    before = page[page.length - 1].signature;
    // Do not stop on a short page: Helius can return fewer than the limit while older ones remain.
  }
  return out;
}
