// Whale Radar: who holds a token, and what the biggest wallets did in their recent transactions.
// All numbers are computed here. Nothing in this file predicts prices or gives advice.

import { rpc, rpcBatch, getTopHolders } from './solana.js';
import { base58Decode, isOnCurve } from './pumpfun.js';

const WALLETS_TRACKED = 10;
const SIGS_PER_WALLET = 15;
const QUIET_PCT = 0.05; // net change under 0.05% of supply counts as "no meaningful change"

function role(owner) {
  if (!owner) return 'unknown';
  try {
    // Owners that are not ordinary wallets (off-curve) are program-controlled: pools, vaults, bonding curves.
    return isOnCurve(base58Decode(owner)) ? 'wallet' : 'program';
  } catch {
    return 'unknown';
  }
}

// Net change in `owner`'s balance of `mint` for one parsed transaction (UI units), or null if failed/unreadable.
export function tokenDelta(tx, owner, mint) {
  if (!tx?.meta || tx.meta.err) return null;
  const sum = (list) =>
    (list ?? [])
      .filter((b) => b.owner === owner && b.mint === mint)
      .reduce((s, b) => s + (b.uiTokenAmount?.uiAmount ?? Number(b.uiTokenAmount?.uiAmountString ?? 0)), 0);
  return sum(tx.meta.postTokenBalances) - sum(tx.meta.preTokenBalances);
}

// Pure analysis. holders: [{tokenAccount, owner, uiAmount}], activity: Map(owner -> [{time, delta}]).
export function analyze({ holders, activity, supply }) {
  const rows = holders.map((h) => {
    const r = role(h.owner);
    const pct = supply > 0 ? (h.uiAmount / supply) * 100 : 0;
    const base = { tokenAccount: h.tokenAccount, owner: h.owner, role: r, holdingPct: pct };
    const events = activity.get(h.owner);
    if (r !== 'wallet' || !events) return { ...base, tracked: false };
    const bought = events.filter((e) => e.delta > 0).reduce((s, e) => s + e.delta, 0);
    const sold = -events.filter((e) => e.delta < 0).reduce((s, e) => s + e.delta, 0);
    const net = bought - sold;
    const netPct = supply > 0 ? (net / supply) * 100 : 0;
    const times = events.map((e) => e.time).filter(Boolean);
    return {
      ...base,
      tracked: true,
      txs: events.length,
      movedIn: events.filter((e) => e.delta > 0).length,
      movedOut: events.filter((e) => e.delta < 0).length,
      netPctOfSupply: netPct,
      direction: Math.abs(netPct) < QUIET_PCT ? 'steady' : netPct > 0 ? 'adding' : 'reducing',
      lastActive: times.length ? Math.max(...times) : null,
      firstSeen: times.length ? Math.min(...times) : null,
    };
  });

  const tracked = rows.filter((r) => r.tracked);
  const allTimes = tracked.flatMap((r) => [r.firstSeen, r.lastActive]).filter(Boolean);
  const summary = {
    topHoldersPct: rows.reduce((s, r) => s + r.holdingPct, 0),
    walletsPct: rows.filter((r) => r.role === 'wallet').reduce((s, r) => s + r.holdingPct, 0),
    programPct: rows.filter((r) => r.role === 'program').reduce((s, r) => s + r.holdingPct, 0),
    walletsTracked: tracked.length,
    adding: tracked.filter((r) => r.direction === 'adding').length,
    reducing: tracked.filter((r) => r.direction === 'reducing').length,
    steady: tracked.filter((r) => r.direction === 'steady').length,
    netFlowPctOfSupply: tracked.reduce((s, r) => s + r.netPctOfSupply, 0),
    windowStart: allTimes.length ? Math.min(...allTimes) : null,
    windowEnd: allTimes.length ? Math.max(...allTimes) : null,
  };
  return { rows, summary };
}

async function collectActivity(mint, holders) {
  const wallets = holders.filter((h) => role(h.owner) === 'wallet').slice(0, WALLETS_TRACKED);
  const sigLists = await rpcBatch(
    wallets.map((w) => ({ method: 'getSignaturesForAddress', params: [w.tokenAccount, { limit: SIGS_PER_WALLET }] })),
  );
  const jobs = [];
  wallets.forEach((w, i) => {
    for (const s of sigLists[i] ?? []) if (!s.err) jobs.push({ owner: w.owner, sig: s.signature, time: s.blockTime });
  });
  const activity = new Map(wallets.map((w) => [w.owner, []]));
  const CHUNK = 40;
  for (let i = 0; i < jobs.length; i += CHUNK) {
    const part = jobs.slice(i, i + CHUNK);
    const txs = await rpcBatch(
      part.map((j) => ({
        method: 'getTransaction',
        params: [j.sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }],
      })),
    );
    part.forEach((j, k) => {
      const d = tokenDelta(txs[k], j.owner, mint);
      if (d !== null && d !== 0) activity.get(j.owner).push({ time: txs[k]?.blockTime ?? j.time, delta: d });
    });
  }
  return activity;
}

export async function whaleReport(mint, mintInfo) {
  const supply = mintInfo.supply / 10 ** mintInfo.decimals;
  const holders = await getTopHolders(mint, 20);
  if (holders.length === 0) return { empty: true };
  const activity = await collectActivity(mint, holders);
  const { rows, summary } = analyze({ holders, activity, supply });
  return { empty: false, rows, summary, perWalletTxLimit: SIGS_PER_WALLET };
}

export function whaleTemplate(summary) {
  const parts = [
    `The largest ordinary wallets (${summary.walletsTracked} tracked) hold ${summary.walletsPct.toFixed(1)}% of supply; pools and program accounts hold another ${summary.programPct.toFixed(1)}%.`,
  ];
  if (summary.walletsTracked > 0) {
    parts.push(
      `In their recent transactions ${summary.adding} added, ${summary.reducing} reduced and ${summary.steady} stayed roughly flat, for a combined net change of ${summary.netFlowPctOfSupply >= 0 ? '+' : ''}${summary.netFlowPctOfSupply.toFixed(2)}% of supply.`,
    );
  }
  parts.push('This describes past on-chain activity only. It does not say what any wallet will do next.');
  return parts.join(' ');
}
