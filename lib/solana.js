// Data access only. No scoring or opinions here.

function rpcUrl() {
  const key = process.env.HELIUS_API_KEY;
  return key
    ? `https://mainnet.helius-rpc.com/?api-key=${key}`
    : 'https://api.mainnet-beta.solana.com';
}

async function rpc(method, params) {
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
