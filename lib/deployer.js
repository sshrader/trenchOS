// Finds a token's creator wallet and how many other tokens that wallet recently launched.
// Heuristics, so results are labeled low to medium confidence:
// - The creator is the fee payer of the oldest transaction that touches the mint.
// - "Other launches" are mints initialized in the creator's last transactions.
// Limits: creators who use many wallets are not linked, and very old or very active tokens
// may be too far back to locate.

import { rpc, rpcBatch, getMarketsBatch } from './solana.js';

const MINT_INIT_TYPES = new Set(['initializeMint', 'initializeMint2']);
const TX_OPTS = { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 };

export function mintsCreatedIn(tx) {
  const found = [];
  const scan = (ixs) => {
    for (const ix of ixs ?? []) {
      const p = ix?.parsed;
      if (p && MINT_INIT_TYPES.has(p.type) && p.info?.mint) found.push(p.info.mint);
    }
  };
  scan(tx?.transaction?.message?.instructions);
  for (const inner of tx?.meta?.innerInstructions ?? []) scan(inner.instructions);
  return found;
}

export async function deployerReport(mint) {
  // 1. Walk back to the oldest signature for the mint (up to 3000 signatures).
  let before;
  let oldest = null;
  let reachedEnd = false;
  for (let page = 0; page < 3; page++) {
    const sigs = await rpc('getSignaturesForAddress', [mint, { limit: 1000, ...(before ? { before } : {}) }]);
    if (!sigs?.length) {
      reachedEnd = true;
      break;
    }
    oldest = sigs[sigs.length - 1];
    before = oldest.signature;
    if (sigs.length < 1000) {
      reachedEnd = true;
      break;
    }
  }
  if (!reachedEnd || !oldest) return { status: 'unlocated' };

  const creationTx = await rpc('getTransaction', [oldest.signature, TX_OPTS]);
  const payer = creationTx?.transaction?.message?.accountKeys?.[0];
  const deployer = typeof payer === 'string' ? payer : payer?.pubkey;
  if (!deployer) return { status: 'unlocated' };

  // 2. The creator's recent transactions, and which mints they initialized.
  const sigs = (await rpc('getSignaturesForAddress', [deployer, { limit: 40 }])) ?? [];
  const okSigs = sigs.filter((s) => !s.err);
  const txs = await rpcBatch(okSigs.map((s) => ({ method: 'getTransaction', params: [s.signature, TX_OPTS] })));
  const created = new Set();
  for (const tx of txs) {
    if (!tx || tx.meta?.err) continue;
    for (const m of mintsCreatedIn(tx)) if (m !== mint) created.add(m);
  }
  const others = [...created];

  // 3. How many of those other tokens look dead now (under $1,000 liquidity).
  let marketChecked = 0;
  let deadCount = 0;
  if (others.length > 0) {
    const checkList = others.slice(0, 30);
    const liq = await getMarketsBatch(checkList).catch(() => null);
    if (liq) {
      for (const m of checkList) {
        marketChecked += 1;
        if ((liq.get(m) ?? 0) < 1000) deadCount += 1;
      }
    }
  }

  return { status: 'ok', deployer, otherLaunches: others.length, txsChecked: okSigs.length, marketChecked, deadCount };
}
