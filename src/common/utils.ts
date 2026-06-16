import { Types } from 'mongoose';

/**
 * Shared, dependency-free helpers used across services. Previously these were
 * copy-pasted in admins/subscriptions/vendors/etc — centralised here so the
 * behaviour (and any future hardening) lives in one place.
 */

/** Keep only the last 10 digits (drops +91 / spaces / dashes). */
export const normalizePhone = (p: unknown): string =>
  String(p ?? '').replace(/\D/g, '').slice(-10);

/** Coerce a string id to an ObjectId when valid; otherwise return it unchanged. */
export const toObjectId = (id: string): any => {
  try {
    if (Types.ObjectId.isValid(id)) return new Types.ObjectId(id);
  } catch {
    /* fall through */
  }
  return id;
};

/**
 * Strip NoSQL-injection-prone keys ($-prefixed / dotted) from a plain object and
 * coerce values to bounded strings. Returns a safe shallow copy.
 */
export const sanitizeStringMap = (
  obj: unknown,
  maxKey = 120,
  maxVal = 120,
): Record<string, string> => {
  const out: Record<string, string> = {};
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof k !== 'string' || k.startsWith('$') || k.includes('.')) continue;
      out[k.slice(0, maxKey)] = String(v ?? '').slice(0, maxVal);
    }
  }
  return out;
};

/** True for an object key that is safe to use in a Mongo document/update. */
export const isSafeKey = (k: unknown): k is string =>
  typeof k === 'string' && !k.startsWith('$') && !k.includes('.');

/**
 * Recursively strip keys that could be used for NoSQL operator/path injection
 * ($-prefixed / dotted) from an arbitrary value. Returns a safe deep copy.
 */
export const sanitizeDeep = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDeep);
  if (typeof obj !== 'object') return obj;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!isSafeKey(k)) continue;
    out[k] = sanitizeDeep(v);
  }
  return out;
};

/** Clamp a number into [lo, hi], defaulting non-numbers to lo. */
export const clampNumber = (n: unknown, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Number(n) || 0));
