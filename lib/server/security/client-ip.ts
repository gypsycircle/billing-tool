// lib/server/security/client-ip.ts
// Who is making the request, for the login rate limit.

import "server-only";

/**
 * Reads the client IP from headers that Vercel's edge sets itself and that a
 * client cannot override: `x-vercel-forwarded-for`, then `x-real-ip`.
 * `x-forwarded-for` is deliberately ignored — its first entry is whatever the
 * client sent, so trusting it would let an attacker pick a fresh rate-limit
 * key for every attempt. Without these headers (local development) every
 * request shares the key "unknown"; the global limit still applies.
 */
export function getClientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

/** Expands an IPv6 address to its 8 hextets, or null if it isn't one. */
function ipv6Hextets(ip: string): string[] | null {
  const [head, tail, ...rest] = ip.split("::");
  if (rest.length > 0) return null;
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? missing !== 0 : missing < 1) return null;
  const groups = [...left, ...Array(tail === undefined ? 0 : missing).fill("0"), ...right];
  return groups.every((g) => /^[0-9a-f]{1,4}$/.test(g)) ? groups : null;
}

/**
 * The rate-limit key for a client. IPv6 users usually control a whole /64, so
 * they are limited per /64 network rather than per address. IPv4-mapped IPv6
 * (::ffff:1.2.3.4) is treated as the IPv4 address.
 */
export function rateLimitClientKey(ip: string): string {
  const value = ip.trim().toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
  if (mapped) return mapped[1];
  if (!value.includes(":")) return value;

  const groups = ipv6Hextets(value);
  return groups ? `${groups.slice(0, 4).map((g) => g.padStart(4, "0")).join(":")}::/64` : value;
}
