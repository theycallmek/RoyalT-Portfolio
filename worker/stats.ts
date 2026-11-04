// Pure helpers for the Worker (no Cloudflare APIs), unit-tested in tests/unit/worker.test.ts.
import type { StatsResponse } from "../server/types.ts";

export const MAX_BODY = 256 * 1024;
// Same threshold as OFFLINE_MS in server/homelab.ts (not imported: that module needs Node).
const OFFLINE_MS = 3 * 60_000;

/** Constant-time check of an `Authorization: Bearer <token>` header against the secret. */
export async function authorized(
  header: string | null,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const digest = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    );
  const [a, b] = await Promise.all([digest(header.slice(7)), digest(secret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** The pushed body must look like the stats service's response; returns it re-serialized or null. */
export function parsePush(text: string): string | null {
  if (text.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(text) as Partial<StatsResponse>;
    const ok =
      typeof v === "object" &&
      v !== null &&
      typeof v.now === "string" &&
      !Number.isNaN(Date.parse(v.now)) &&
      ["github", "youtube", "homelab"].every(
        (k) => typeof v[k as keyof StatsResponse] === "object",
      );
    return ok ? JSON.stringify(v) : null;
  } catch {
    return null;
  }
}

/** Stored snapshot as served: when pushes have stopped (home server down), machines show offline. */
export function freshen(stored: string, now: number): StatsResponse {
  const s = JSON.parse(stored) as StatsResponse;
  if (now - Date.parse(s.now) >= OFFLINE_MS && s.homelab.data) {
    s.homelab.data.nodes = s.homelab.data.nodes.map((n) => ({
      ...n,
      online: false,
    }));
  }
  return { ...s, now: new Date(now).toISOString() };
}
