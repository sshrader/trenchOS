// Simple in-memory limiter, per server instance. Fine for testing on one Railway instance;
// use Redis or Postgres if you scale to several.
const hits = new Map();

export function allow(key, limitPerMin) {
  const now = Date.now();
  const windowMs = 60_000;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limitPerMin) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
