// KOL Intelligence: compares what a public wallet did with the times of an account's posts.
// The tool never reads X and never decides who owns a wallet. The person supplies the wallet,
// how they know it is linked, and the post times. Timing is a pattern to look at, not proof.

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_CALLS = 10;
const AFTER_WINDOW_MS = 24 * 3600 * 1000;

export const LINKS = {
  confirmed: { label: 'Confirmed', note: 'A signed message or other on-chain proof ties this wallet to the account.' },
  self: { label: 'Self-disclosed', note: 'The account itself has said this wallet is theirs.' },
  probable: { label: 'Probable', note: 'Inferred (for example from funding or timing). This is a guess, not an identification.' },
  unknown: { label: 'Unknown', note: 'No known link. Results describe the wallet only, not any person or account.' },
};

// Lines of "mint, time". Times without a time zone are read as UTC.
export function parseCalls(text) {
  const calls = [];
  const problems = [];
  const lines = String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length > MAX_CALLS) problems.push(`Only the first ${MAX_CALLS} lines are used.`);
  for (const line of lines.slice(0, MAX_CALLS)) {
    const m = line.match(/^([1-9A-HJ-NP-Za-km-z]{32,44})[\s,;]+(.+)$/);
    if (!m) { problems.push(`Could not read the line "${line.slice(0, 40)}". Use: mint, date and time.`); continue; }
    const raw = m[2].trim();
    const hasZone = /(Z|[+-]\d{2}:?\d{2}|UTC|GMT)$/i.test(raw);
    const at = Date.parse(hasZone ? raw : `${raw} UTC`);
    if (!Number.isFinite(at)) { problems.push(`Could not read the time "${raw.slice(0, 30)}".`); continue; }
    calls.push({ mint: m[1], at, raw });
  }
  return { calls, problems };
}

export const isWallet = (s) => BASE58.test(s);

// Per-mint events for one wallet from Helius enhanced transactions: [{t (ms), delta}].
export function walletEvents(txs, wallet) {
  const byMint = new Map();
  let windowStart = Infinity;
  for (const tx of txs) {
    if (tx?.timestamp) windowStart = Math.min(windowStart, tx.timestamp * 1000);
    if (tx?.transactionError) continue;
    for (const t of tx?.tokenTransfers ?? []) {
      let d = 0;
      if (t.toUserAccount === wallet) d += Number(t.tokenAmount) || 0;
      if (t.fromUserAccount === wallet) d -= Number(t.tokenAmount) || 0;
      if (!d || !t.mint) continue;
      if (!byMint.has(t.mint)) byMint.set(t.mint, []);
      byMint.get(t.mint).push({ t: (tx.timestamp ?? 0) * 1000, delta: d });
    }
  }
  return { byMint, windowStart: Number.isFinite(windowStart) ? windowStart : null };
}

const mins = (ms) => Math.round(ms / 60000);

// Pure. One result per call: what the wallet did around the mention time.
export function timing(call, events, windowStart) {
  const base = { mint: call.mint, at: call.at };
  if (windowStart == null || call.at < windowStart) {
    return { ...base, status: 'outside-history', note: 'The mention is older than the transactions that were fetched.' };
  }
  const ev = (events ?? []).slice().sort((a, b) => a.t - b.t);
  if (ev.length === 0) return { ...base, status: 'no-activity', note: 'No transfers of this token in the fetched history.' };

  const buys = ev.filter((e) => e.delta > 0);
  const firstBuy = buys[0];
  const before = ev.filter((e) => e.t <= call.at);
  const heldBefore = before.reduce((s, e) => s + e.delta, 0) > 0;
  const soldAfter = ev.find((e) => e.t > call.at && e.t <= call.at + AFTER_WINDOW_MS && e.delta < 0);
  return {
    ...base,
    status: firstBuy && firstBuy.t <= call.at ? 'bought-before' : 'bought-after',
    firstBuyOffsetMin: firstBuy ? mins(firstBuy.t - call.at) : null, // negative = before the mention
    heldAtMention: heldBefore,
    soldWithin24hMin: soldAfter ? mins(soldAfter.t - call.at) : null,
    transfers: ev.length,
  };
}

export function summarize(results) {
  const evaluable = results.filter((r) => r.status === 'bought-before' || r.status === 'bought-after');
  const boughtBefore = evaluable.filter((r) => r.status === 'bought-before');
  return {
    calls: results.length,
    evaluable: evaluable.length,
    outsideHistory: results.filter((r) => r.status === 'outside-history').length,
    noActivity: results.filter((r) => r.status === 'no-activity').length,
    boughtBefore: boughtBefore.length,
    boughtAfter: evaluable.length - boughtBefore.length,
    boughtBeforeThenSold24h: boughtBefore.filter((r) => r.soldWithin24hMin != null).length,
  };
}

export function kolTemplate(summary, link) {
  const parts = [];
  if (summary.evaluable === 0) {
    parts.push('None of the listed tokens appear in the fetched wallet history, so there is no timing to compare.');
  } else {
    parts.push(
      `Of ${summary.calls} mentions, the wallet traded ${summary.evaluable}. It first bought ${summary.boughtBefore} of those before the mention and ${summary.boughtAfter} after it.`,
    );
    if (summary.boughtBefore > 0) {
      parts.push(`${summary.boughtBeforeThenSold24h} of the early buys ${summary.boughtBeforeThenSold24h === 1 ? "was" : "were"} followed by a sale within 24 hours of the mention.`);
    }
  }
  parts.push(
    link === 'confirmed' || link === 'self'
      ? 'Timing like this is a pattern worth a closer look, not proof of intent.'
      : 'The link between this wallet and the account is not established, so this describes the wallet only. Timing is not proof of anything.',
  );
  return parts.join(' ');
}
