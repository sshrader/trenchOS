// Price history from GeckoTerminal's free public API. Data access only.
// Error messages start with "Candle" and never include URLs, so they are safe to show.

export async function getCandles(poolAddress, { minutes = 5, limit = 1000 } = {}) {
  const url = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolAddress}/ohlcv/minute?aggregate=${minutes}&limit=${limit}&currency=usd`;
  const res = await fetch(url, { headers: { accept: 'application/json;version=20230302' }, cache: 'no-store' });
  if (res.status === 429) throw new Error('Candle data is rate limited right now. Try again in a minute.');
  if (!res.ok) throw new Error(`Candle data request failed with HTTP ${res.status}`);
  const json = await res.json();
  const list = json?.data?.attributes?.ohlcv_list;
  if (!Array.isArray(list)) throw new Error('Candle data came back in an unexpected format.');
  return list
    .map(([t, o, h, l, c, v]) => ({ t: t * 1000, o: +o, h: +h, l: +l, c: +c, v: +v }))
    .filter((k) => k.o > 0 && k.c > 0)
    .sort((a, b) => a.t - b.t);
}
