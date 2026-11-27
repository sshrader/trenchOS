// Agent Wars: rule-based "agents" trade a paper portfolio over a token's real price history.
// Code makes every decision. Signals use only candles up to the current one, and trades fill at the
// NEXT candle's open, so no agent sees the future. Results are simulated, never advice or a forecast.

export const START_CASH = 1000;
export const FEE = 0.005; // 0.5% per trade, a rough DEX fee plus tip

// Rough constant-product price impact: trade size against half the pool's USD liquidity.
export function slippage(sizeUsd, liquidityUsd) {
  const depth = Number.isFinite(liquidityUsd) ? Math.max(liquidityUsd / 2, 1) : Infinity;
  return Math.min(0.5, sizeUsd / (depth + sizeUsd));
}

const sma = (candles, i, n) => {
  if (i + 1 < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += candles[k].c;
  return s / n;
};
const highest = (candles, i, n) => {
  let h = -Infinity;
  for (let k = Math.max(0, i - n + 1); k <= i; k++) h = Math.max(h, candles[k].h);
  return h;
};

// Deterministic PRNG so the coin-flip agent gives the same answer for the same token.
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// signal(ctx) -> 'buy' | 'sell' | null. ctx: { candles, i, holding, entry, peak, rand }
export const AGENTS = [
  {
    id: 'hold', name: 'Diamond Dan', style: 'Buy and hold',
    blurb: 'Buys at the start and never sells. The baseline every other agent has to beat.',
    signal: ({ holding }) => (holding ? null : 'buy'),
  },
  {
    id: 'momentum', name: 'Momentum Mia', style: 'Trend follower',
    blurb: 'Buys when price is above its 12-candle average and up over the last 6 candles. Sells when it drops below the average or falls 5% from entry.',
    signal: ({ candles, i, holding, entry }) => {
      const avg = sma(candles, i, 12);
      if (avg == null || i < 6) return null;
      const c = candles[i].c;
      const up = c / candles[i - 6].c - 1;
      if (!holding) return c > avg && up > 0.03 ? 'buy' : null;
      return c < avg || c < entry * 0.95 ? 'sell' : null;
    },
  },
  {
    id: 'dip', name: 'Dip Dexter', style: 'Dip buyer',
    blurb: 'Buys after price falls 10% below its 24-candle high. Sells at +10% from entry or -8% from entry.',
    signal: ({ candles, i, holding, entry }) => {
      if (i < 24) return null;
      const c = candles[i].c;
      if (!holding) return c < highest(candles, i, 24) * 0.9 ? 'buy' : null;
      return c >= entry * 1.1 || c <= entry * 0.92 ? 'sell' : null;
    },
  },
  {
    id: 'trail', name: 'Trailing Tara', style: 'Breakout with trailing stop',
    blurb: 'Buys when price breaks above its previous 12-candle high. Sells when price falls 10% from its peak since entry.',
    signal: ({ candles, i, holding, peak }) => {
      if (i < 13) return null;
      const c = candles[i].c;
      if (!holding) return c > highest(candles, i - 1, 12) ? 'buy' : null;
      return c <= peak * 0.9 ? 'sell' : null;
    },
  },
  {
    id: 'coin', name: 'Coin Flip Carl', style: 'Random baseline',
    blurb: 'Buys or sells on random chance (5% per candle). Shows how much of any result could just be luck.',
    signal: ({ holding, rand }) => (rand() < 0.05 ? (holding ? 'sell' : 'buy') : null),
  },
];

export function simulate(candles, agent, { liquidityUsd = Infinity, fee = FEE, startCash = START_CASH, seed = '' } = {}) {
  const rand = rng(`${seed}:${agent.id}`);
  let cash = startCash;
  let units = 0;
  let entry = 0;
  let peak = 0;
  let spent = 0;
  const trades = [];
  let costs = 0;
  let wins = 0;
  let rounds = 0;
  let maxEq = startCash;
  let maxDd = 0;

  const buy = (price, t) => {
    const impact = slippage(cash, liquidityUsd);
    const feeUsd = cash * fee;
    const fill = price * (1 + impact);
    units = (cash - feeUsd) / fill;
    costs += feeUsd + cash * impact;
    trades.push({ t, side: 'buy', price: fill, usd: cash, feeUsd, slipPct: impact * 100 });
    spent = cash;
    entry = fill;
    peak = fill;
    cash = 0;
  };
  const sell = (price, t, note) => {
    const gross = units * price;
    const impact = slippage(gross, liquidityUsd);
    const fill = price * (1 - impact);
    const proceeds = units * fill;
    const feeUsd = proceeds * fee;
    costs += feeUsd + gross * impact;
    cash = proceeds - feeUsd;
    trades.push({ t, side: 'sell', price: fill, usd: proceeds, feeUsd, slipPct: impact * 100, ...(note ? { note } : {}) });
    rounds++;
    if (cash > spent) wins++;
    units = 0;
  };

  for (let i = 0; i < candles.length - 1; i++) {
    const holding = units > 0;
    if (holding) peak = Math.max(peak, candles[i].c);
    const sig = agent.signal({ candles, i, holding, entry, peak, rand });
    const next = candles[i + 1];
    if (sig === 'buy' && !holding) buy(next.o, next.t);
    else if (sig === 'sell' && holding) sell(next.o, next.t);
    const eq = cash + units * candles[i].c;
    maxEq = Math.max(maxEq, eq);
    maxDd = Math.max(maxDd, (maxEq - eq) / maxEq);
  }
  const last = candles[candles.length - 1];
  if (units > 0) sell(last.c, last.t, 'closed at end of window');
  return {
    id: agent.id, name: agent.name, style: agent.style, blurb: agent.blurb,
    finalValue: cash,
    returnPct: (cash / startCash - 1) * 100,
    trades: trades.length,
    roundTrips: rounds,
    winRatePct: rounds ? (wins / rounds) * 100 : null,
    maxDrawdownPct: maxDd * 100,
    costsUsd: costs,
    ledger: trades,
  };
}

export function runWars(candles, opts) {
  const results = AGENTS.map((a) => simulate(candles, a, opts)).sort((a, b) => b.returnPct - a.returnPct);
  const hold = results.find((r) => r.id === 'hold');
  return {
    results,
    holdReturnPct: hold.returnPct,
    beatHold: results.filter((r) => r.id !== 'hold' && r.returnPct > hold.returnPct).length,
    candles: candles.length,
  };
}

export function warsTemplate({ results, holdReturnPct, beatHold }, hours) {
  const f = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  const best = results[0];
  const worst = results[results.length - 1];
  const parts = [`Over about ${Math.round(hours)} hours of price history, ${best.name} finished first at ${f(best.returnPct)} and ${worst.name} finished last at ${f(worst.returnPct)}.`];
  parts.push(`Buy and hold returned ${f(holdReturnPct)}, and ${beatHold} of the 4 trading agents beat it after fees and slippage.`);
  const coin = results.find((r) => r.id === 'coin');
  parts.push(`The random baseline returned ${f(coin.returnPct)}, a reminder that one run on one token can be mostly luck.`);
  parts.push('These are simulated results on past data only. They do not predict anything.');
  return parts.join(' ');
}

export function warsPayload({ results, holdReturnPct }, hours) {
  return {
    windowHours: Math.round(hours),
    buyAndHoldReturnPct: Math.round(holdReturnPct * 10) / 10,
    agents: results.map((r, i) => ({
      rank: i + 1, agent: r.name, style: r.style,
      returnPct: Math.round(r.returnPct * 10) / 10, trades: r.trades,
      maxDrawdownPct: Math.round(r.maxDrawdownPct), costsUsd: Math.round(r.costsUsd),
    })),
  };
}
