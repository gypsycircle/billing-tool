// lib/server/session/access-code.ts
// The shared access code, stored only as a salted scrypt hash in the
// `settings` collection (set with scripts/set-access-code.mjs).
//
// Hash format (self-describing, so the cost can be raised later without
// breaking stored hashes):  scrypt$<log2 N>$<r>$<p>$<salt b64url>$<key b64url>

import "server-only";

import crypto from "node:crypto";
import { promisify } from "node:util";
import { settingsCollection } from "../db/collections";
import { AccessCodeNotSetError } from "../errors";

const scrypt = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

// OWASP's scrypt baseline: N = 2^17, r = 8, p = 1 (128 MiB, ~0.2 s)
const COST = { log2N: 17, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const HASH_FORMAT = /^scrypt\$(\d{1,2})\$(\d{1,2})\$(\d{1,2})\$([A-Za-z0-9_-]{16,})\$([A-Za-z0-9_-]{32,})$/;

function derive(code: string, salt: Buffer, cost: typeof COST, keyBytes: number): Promise<Buffer> {
  const N = 2 ** cost.log2N;
  return scrypt(code.normalize("NFKC"), salt, keyBytes, { N, r: cost.r, p: cost.p, maxmem: 256 * N * cost.r });
}

/** A new salted hash of `code`, in the stored format. */
export async function hashAccessCode(code: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = await derive(code, salt, COST, KEY_BYTES);
  return ["scrypt", COST.log2N, COST.r, COST.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** Checks `code` against a stored hash in constant time. Throws on a malformed hash. */
async function matchesAccessCodeHash(code: string, hash: string): Promise<boolean> {
  const parts = HASH_FORMAT.exec(hash);
  const cost = parts && { log2N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) };
  if (!parts || !cost || cost.log2N < 14 || cost.log2N > 20 || cost.r < 1 || cost.p < 1) {
    throw new AccessCodeNotSetError("The stored access code hash is malformed");
  }
  const expected = Buffer.from(parts[5], "base64url");
  const supplied = await derive(code, Buffer.from(parts[4], "base64url"), cost, expected.length);
  return crypto.timingSafeEqual(supplied, expected);
}

/**
 * True when `code` is the app's access code. Reads the hash on every call (one
 * _id lookup), so a changed code applies at once. Throws AccessCodeNotSetError
 * when no access code has been set.
 */
export async function verifyAccessCode(code: string): Promise<boolean> {
  const settings = await (await settingsCollection()).findOne(
    { _id: "access" },
    { projection: { _id: 0, hashedAccessCode: 1 } }
  );
  if (!settings) throw new AccessCodeNotSetError("No access code has been set");
  return matchesAccessCodeHash(code, settings.hashedAccessCode);
}
