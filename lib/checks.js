// Deterministic risk checks. All arithmetic and thresholds live here, never in the LLM.
// Thresholds are deliberately simple and published so users can judge them.

export const THRESHOLDS = {
  top10ReviewPct: 30,
  top10FlagPct: 50,
  liquidityFlagUsd: 5000,
  liquidityReviewUsd: 25000,
  youngPairHours: 1,
};

const fmtPct = (n) => `${n.toFixed(1)}%`;
const fmtUsd = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

const short = (a) => (a && a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a);

function deployerCheck(d) {
  const base = { name: 'Deployer history' };
  if (!d) {
    return { ...base, status: 'REVIEW', evidence: 'Deployer history was unavailable.', confidence: 'Not checked' };
  }
  if (d.status !== 'ok') {
    return {
      ...base,
      status: 'REVIEW',
      evidence: 'Could not locate the creation transaction. The token may be too old or too active for this version.',
      confidence: 'Not checked',
    };
  }
  const who = short(d.deployer);
  const window = `its last ${d.txsChecked} transactions`;
  if (d.otherLaunches === 0) {
    return {
      ...base,
      status: 'PASS',
      evidence: `Creator wallet ${who} shows no other token launches in ${window}.`,
      confidence: 'Low to medium (recent window only; a creator can use several wallets)',
    };
  }
  const deadShare = d.marketChecked > 0 ? d.deadCount / d.marketChecked : null;
  const deadText =
    d.marketChecked > 0
      ? `; ${d.deadCount} of ${d.marketChecked} checked have under $1,000 liquidity now (they may be dead, which is not necessarily a rug)`
      : '';
  const status =
    d.otherLaunches >= 5 && deadShare != null && deadShare >= 0.6 ? 'FLAG' : d.otherLaunches >= 3 ? 'REVIEW' : 'PASS';
  return {
    ...base,
    status,
    evidence: `Creator wallet ${who} launched ${d.otherLaunches} other token${d.otherLaunches === 1 ? '' : 's'} in ${window}${deadText}. REVIEW at 3 or more, FLAG at 5 or more when most look dead.`,
    confidence: 'Low to medium (recent window only; creator is the fee payer of the first transaction)',
  };
}

export function buildChecks({ mintInfo, holders, market, deployer }) {
  const checks = [];

  checks.push(
    mintInfo.mintAuthority === null
      ? { name: 'Mint authority', status: 'PASS', evidence: 'Revoked. No new supply can be minted.', confidence: 'High (on-chain account data)' }
      : { name: 'Mint authority', status: 'FLAG', evidence: `Still active (${mintInfo.mintAuthority}). New supply can be minted.`, confidence: 'High (on-chain account data)' },
  );

  checks.push(
    mintInfo.freezeAuthority === null
      ? { name: 'Freeze authority', status: 'PASS', evidence: 'Revoked. Holder accounts cannot be frozen.', confidence: 'High (on-chain account data)' }
      : { name: 'Freeze authority', status: 'FLAG', evidence: `Still active (${mintInfo.freezeAuthority}). Holder accounts can be frozen.`, confidence: 'High (on-chain account data)' },
  );

  // Holder concentration, excluding the liquidity pool itself when we can identify it.
  if (!holders || holders.length === 0) {
    checks.push({
      name: 'Holder concentration',
      status: 'REVIEW',
      evidence: 'Holder data was unavailable for this token. Very large tokens can exceed RPC limits.',
      confidence: 'Not checked',
    });
  } else {
    const supplyUi = mintInfo.supply / 10 ** mintInfo.decimals;
    const poolAddress = market?.pairAddress ?? null;
    const counted = holders.filter((h) => h.owner !== poolAddress);
    const excludedPool = counted.length !== holders.length;
    const top10Ui = counted.slice(0, 10).reduce((sum, h) => sum + h.uiAmount, 0);
    const top10Pct = supplyUi > 0 ? (top10Ui / supplyUi) * 100 : 0;
    const hStatus = top10Pct >= THRESHOLDS.top10FlagPct ? 'FLAG' : top10Pct >= THRESHOLDS.top10ReviewPct ? 'REVIEW' : 'PASS';
    checks.push({
      name: 'Holder concentration',
      status: hStatus,
      evidence: `Top ${Math.min(10, counted.length)} holders control ${fmtPct(top10Pct)} of supply (REVIEW at ${THRESHOLDS.top10ReviewPct}%, FLAG at ${THRESHOLDS.top10FlagPct}%).`,
      confidence: excludedPool
        ? 'Medium (liquidity pool excluded; other program-owned accounts may still be counted)'
        : 'Medium (program-owned accounts such as bonding curves may be counted as holders)',
    });
  }

  if (!market) {
    checks.push({ name: 'Liquidity depth', status: 'REVIEW', evidence: 'No Solana pool found on DexScreener.', confidence: 'Medium (provider coverage is incomplete)' });
  } else {
    const liq = market.liquidity?.usd ?? 0;
    const lStatus = liq < THRESHOLDS.liquidityFlagUsd ? 'FLAG' : liq < THRESHOLDS.liquidityReviewUsd ? 'REVIEW' : 'PASS';
    checks.push({
      name: 'Liquidity depth',
      status: lStatus,
      evidence: `Best pool holds ${fmtUsd(liq)} of liquidity (FLAG below ${fmtUsd(THRESHOLDS.liquidityFlagUsd)}, REVIEW below ${fmtUsd(THRESHOLDS.liquidityReviewUsd)}). Lock or burn status is not checked in this version.`,
      confidence: 'Medium (provider data, may lag)',
    });

    if (market.pairCreatedAt) {
      const ageHours = (Date.now() - market.pairCreatedAt) / 3_600_000;
      checks.push({
        name: 'Pair age',
        status: ageHours < THRESHOLDS.youngPairHours ? 'REVIEW' : 'PASS',
        evidence: ageHours < 24 ? `Pool is about ${ageHours.toFixed(1)} hours old.` : `Pool is about ${(ageHours / 24).toFixed(1)} days old.`,
        confidence: 'Medium (provider data)',
      });
    }
  }

  checks.push(deployerCheck(deployer));

  const summary = {
    flags: checks.filter((c) => c.status === 'FLAG').length,
    reviews: checks.filter((c) => c.status === 'REVIEW').length,
    passes: checks.filter((c) => c.status === 'PASS').length,
  };
  return { checks, summary };
}
