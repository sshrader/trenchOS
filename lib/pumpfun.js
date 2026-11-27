// Reads a pump.fun token's creator straight from its bonding curve account.
//
// The bonding curve is a program-derived address (PDA) from the seeds ["bonding-curve", mint]
// under the pump.fun program. Its account data records the creator wallet, which is far more
// reliable and much cheaper than walking a token's whole transaction history.
//
// Account layout (as of this writing; if pump.fun changes it, this returns null and the caller
// falls back to the slower transaction search):
//   0..8    Anchor discriminator
//   8..48   five u64 reserve and supply fields
//   48      complete (bool)
//   49..81  creator (32-byte public key)

import { createHash } from 'node:crypto';
import { rpc } from './solana.js';

export const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const BONDING_CURVE_DISCRIMINATOR = Buffer.from([23, 183, 248, 55, 96, 216, 172, 96]);

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Decode(str) {
  let n = 0n;
  for (const ch of str) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('invalid base58');
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const body = n === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros++;
  return Buffer.concat([Buffer.alloc(zeros), body]);
}

export function base58Encode(buf) {
  let n = 0n;
  for (const b of buf) n = n * 256n + BigInt(b);
  let out = '';
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + out;
}

// ed25519 curve membership test. A PDA must be OFF the curve.
const P = 2n ** 255n - 19n;
const modPow = (base, exp, mod) => {
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
};
const inv = (a) => modPow(a, P - 2n, P);
const D = ((-121665n % P + P) % P) * inv(121666n) % P;

export function isOnCurve(bytes) {
  if (bytes.length !== 32) return false;
  const b = Buffer.from(bytes);
  b[31] &= 0x7f; // clear the sign bit
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(b[i]);
  if (y >= P) return false;
  const y2 = (y * y) % P;
  const u = (y2 - 1n + P) % P;
  const v = (D * y2 + 1n) % P;
  if (u === 0n) return true;
  const w = (u * inv(v)) % P;
  return modPow(w, (P - 1n) / 2n, P) === 1n;
}

export function findProgramAddress(seeds, programId) {
  const programBytes = base58Decode(programId);
  for (let bump = 255; bump >= 0; bump--) {
    const hash = createHash('sha256')
      .update(Buffer.concat([...seeds, Buffer.from([bump]), programBytes, Buffer.from('ProgramDerivedAddress')]))
      .digest();
    if (!isOnCurve(hash)) return base58Encode(hash);
  }
  throw new Error('no program address found');
}

export function bondingCurveAddress(mint) {
  return findProgramAddress([Buffer.from('bonding-curve'), base58Decode(mint)], PUMP_PROGRAM);
}

// Returns the creator wallet from raw bonding curve account bytes, or null if the layout is unexpected.
export function parseCreator(data) {
  if (!data || data.length < 81) return null;
  if (!data.subarray(0, 8).equals(BONDING_CURVE_DISCRIMINATOR)) return null;
  const creator = data.subarray(49, 81);
  if (creator.every((b) => b === 0)) return null;
  return base58Encode(creator);
}

// Creator wallet for a pump.fun token, or null if this is not one (or the layout changed).
export async function findPumpCreator(mint) {
  const curve = bondingCurveAddress(mint);
  const result = await rpc('getAccountInfo', [curve, { encoding: 'base64' }]);
  const value = result?.value;
  if (!value || value.owner !== PUMP_PROGRAM) return null;
  const b64 = Array.isArray(value.data) ? value.data[0] : null;
  if (!b64) return null;
  return parseCreator(Buffer.from(b64, 'base64'));
}
