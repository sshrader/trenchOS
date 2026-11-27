import { allow } from './ratelimit.js';

// Shared access-code and rate-limit checks. Returns a Response to send, or null to continue.
export function guard(request) {
  const requiredCode = process.env.ACCESS_CODE;
  if (requiredCode && request.headers.get('x-access-code') !== requiredCode) {
    return Response.json({ error: 'Access code required.' }, { status: 401 });
  }
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const limit = Number(process.env.RATE_LIMIT_PER_MIN ?? 10);
  if (!allow(ip, limit)) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
  }
  return null;
}
