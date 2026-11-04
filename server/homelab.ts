import { createHash, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";
import type { HomelabNode, HomelabStats, Source } from "./types.ts";

// Homelab ingest (POST /ingest from homelab/agent.sh) and the public projection for /api/stats.
// Never log tokens or request bodies.

export interface NodeConfig {
  id: string;
  label: string;
  hw: string;
  tokenSha256: string;
}

export interface Report {
  uptimeSeconds: number;
  cpu: number;
  memUsed: number;
  memTotal: number;
  disk: number;
  temp?: number;
  rx: number;
  tx: number;
  arch: "x86" | "ARM";
}

export interface Stored {
  report: Report;
  at: string; // server receive time
}

export const OFFLINE_MS = 3 * 60_000;
export const MIN_INTERVAL_MS = 20_000;
export const MAX_BODY = 4096;

export const sha256 = (s: string) =>
  createHash("sha256").update(s).digest("hex");

const text = (v: unknown, re: RegExp): v is string =>
  typeof v === "string" && re.test(v);

export function parseNodes(raw: string | undefined): NodeConfig[] {
  if (!raw?.trim()) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    throw new Error("HOMELAB_NODES is not valid JSON"); // V8's message would quote the input
  }
  if (!Array.isArray(list))
    throw new Error("HOMELAB_NODES must be a JSON array");
  const seen = new Set<string>();
  return list.map((n, i) => {
    const { id, label, hw, tokenSha256 } = (n ?? {}) as Record<
      string,
      unknown
    >;
    if (
      !text(id, /^[a-z0-9-]{1,32}$/) ||
      !text(label, /^[^\n]{1,40}$/) ||
      !text(hw, /^[^\n]{1,40}$/) ||
      !text(tokenSha256, /^[0-9a-f]{64}$/) ||
      seen.has(id)
    )
      throw new Error(`HOMELAB_NODES entry ${i} is invalid`);
    seen.add(id);
    return { id, label, hw, tokenSha256 };
  });
}

// The node comes from the token, so a leaked token can only spoof its own node.
// Hash first (fixed length), then compare against every node without an early exit.
export function nodeForAuth(
  nodes: NodeConfig[],
  header: string | undefined,
): NodeConfig | undefined {
  const m = /^Bearer ([\x21-\x7e]{16,256})$/.exec(header ?? "");
  const presented = createHash("sha256")
    .update(m?.[1] ?? "")
    .digest();
  let found: NodeConfig | undefined;
  for (const n of nodes) {
    const hit = timingSafeEqual(presented, Buffer.from(n.tokenSha256, "hex"));
    if (hit && m && !found) found = n;
  }
  return found;
}

const num = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

// Strict schema; builds a new object so unknown fields (hostname, IPs, ...) are dropped.
export function validateReport(x: unknown): Report | null {
  if (typeof x !== "object" || x === null || Array.isArray(x)) return null;
  const r = x as Record<string, unknown>;
  const { uptimeSeconds, cpu, memUsed, memTotal, disk, temp, rx, tx, arch } =
    r;
  if (
    !num(uptimeSeconds, 0, 1e10) ||
    !num(cpu, 0, 100) ||
    !num(memTotal, 1, 1e15) ||
    !num(memUsed, 0, memTotal) ||
    !num(disk, 0, 100) ||
    !(temp === undefined || num(temp, -40, 150)) ||
    !num(rx, 0, 1e12) ||
    !num(tx, 0, 1e12) ||
    (arch !== "x86" && arch !== "ARM")
  )
    return null;
  return {
    uptimeSeconds,
    cpu,
    memUsed,
    memTotal,
    disk,
    ...(temp === undefined ? {} : { temp }),
    rx,
    tx,
    arch,
  };
}

const sig2 = (n: number) => (n > 0 ? Number(n.toPrecision(2)) : 0);
const uptime = (s: number) =>
  s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
const toMinute = (iso: string) =>
  new Date(Math.floor(Date.parse(iso) / 60_000) * 60_000).toISOString();

// Public view: listed fields only, rounded (privacy rules in docs/superpowers/plans/2026-11-02-homelab.md).
export function project(
  nodes: NodeConfig[],
  store: Record<string, Stored>,
  now: number,
): Source<HomelabStats> {
  if (!nodes.length)
    return { data: null, fetchedAt: null, error: "homelab not configured" };
  const list = nodes.map((n): HomelabNode => {
    const s = store[n.id];
    const r = s?.report;
    return {
      id: n.id,
      label: n.label,
      hw: n.hw,
      online: !!s && now - Date.parse(s.at) < OFFLINE_MS,
      uptime: r ? uptime(r.uptimeSeconds) : null,
      cpu: r ? Math.round(r.cpu) : null,
      mem: r ? Math.round((100 * r.memUsed) / r.memTotal) : null,
      disk: r ? Math.round(r.disk) : null,
      temp: r?.temp === undefined ? null : Math.round(r.temp),
      rx: r ? sig2(r.rx) : null,
      tx: r ? sig2(r.tx) : null,
      reportedAt: s ? toMinute(s.at) : null,
    };
  });
  const times = list.flatMap((n) => n.reportedAt ?? []).sort();
  return {
    data: { nodes: list },
    fetchedAt: times.at(-1) ?? null,
    error: null,
  };
}

export function createIngest(
  nodes: NodeConfig[],
  store: Record<string, Stored>,
  onAccept: () => void,
  clock: () => number = Date.now,
) {
  const tooSoon = (id: string) => {
    const prev = store[id];
    return !!prev && clock() - Date.parse(prev.at) < MIN_INTERVAL_MS;
  };
  const server = createServer((req, res) => {
    const end = (code: number) =>
      void res.writeHead(code, { Connection: "close" }).end();
    if (new URL(req.url ?? "/", "http://x").pathname !== "/ingest")
      return end(404);
    if (req.method !== "POST") return end(405);
    const node = nodeForAuth(nodes, req.headers.authorization);
    if (!node) return end(401);
    if (!/^application\/json\b/i.test(req.headers["content-type"] ?? ""))
      return end(415);
    if (tooSoon(node.id)) return end(429);
    if (Number(req.headers["content-length"] ?? 0) > MAX_BODY) return end(413);
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size <= MAX_BODY) chunks.push(c);
    });
    req.on("end", () => {
      if (size > MAX_BODY) return end(413);
      let report: Report | null = null;
      try {
        report = validateReport(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {}
      if (!report) return end(400);
      if (tooSoon(node.id)) return end(429); // a concurrent request won
      store[node.id] = { report, at: new Date(clock()).toISOString() };
      onAccept();
      end(204);
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  return server;
}

// Persisted latest reports (no tokens). Entries for unknown nodes or invalid reports are dropped.
export function loadReports(
  file: string,
  nodes: NodeConfig[],
): Record<string, Stored> {
  const out: Record<string, Stored> = {};
  try {
    if (!existsSync(file)) return out;
    const raw = JSON.parse(readFileSync(file, "utf8")) as Record<
      string,
      Stored
    >;
    for (const n of nodes) {
      const report = validateReport(raw[n.id]?.report);
      const at = raw[n.id]?.at;
      if (report && typeof at === "string" && !Number.isNaN(Date.parse(at)))
        out[n.id] = { report, at };
    }
  } catch {}
  return out;
}

export function saveReports(file: string, store: Record<string, Stored>) {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(store));
  } catch (e) {
    console.error(
      "homelab cache write failed:",
      e instanceof Error ? e.message : e,
    );
  }
}
