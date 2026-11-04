import { createServer } from "node:http";
import { applyResult, loadSource, saveSource } from "./cache.ts";
import { fetchGitHub } from "./github.ts";
import { createIngest, loadReports, parseNodes, project, saveReports } from "./homelab.ts";
import type { GitHubStats, Source, StatsResponse, YouTubeStats } from "./types.ts";
import { fetchYouTube } from "./youtube.ts";

const PORT = Number(process.env.PORT ?? 8787);
const LOGIN = process.env.GITHUB_USER ?? "theycallmek";
const TOKEN = process.env.GITHUB_TOKEN;
const YT_CHANNEL = process.env.YOUTUBE_CHANNEL_ID || "UC4aCKFHOXtL0WdT3nkMSmrA";
const YT_KEY = process.env.YOUTUBE_API_KEY;

// Each source keeps its own last-good cache file and refresh cadence.
function source<T>(name: string, file: string, everyMs: number, fetcher: () => Promise<T>) {
  let s = loadSource<T>(file);
  const refresh = async () => {
    const now = new Date().toISOString();
    try {
      s = applyResult(s, { ok: true, data: await fetcher() }, now);
    } catch (e) {
      s = applyResult(s, { ok: false, error: e instanceof Error ? e.message : "fetch failed" }, now);
      console.error(`${name} refresh failed:`, s.error);
    }
    saveSource(file, s);
  };
  void refresh();
  setInterval(refresh, everyMs).unref();
  return (): Source<T> => s;
}

const github = source<GitHubStats>(
  "github",
  process.env.CACHE_FILE ?? "server/data/github.json",
  10 * 60 * 1000,
  () => fetchGitHub(LOGIN, TOKEN),
);
const youtube = source<YouTubeStats>(
  "youtube",
  process.env.YOUTUBE_CACHE_FILE ?? "server/data/youtube.json",
  30 * 60 * 1000,
  () => fetchYouTube(YT_CHANNEL, YT_KEY),
);

// Homelab: no HOMELAB_NODES (or an invalid one) means no ingest listener and an unavailable source.
let nodes: ReturnType<typeof parseNodes> = [];
try {
  nodes = parseNodes(process.env.HOMELAB_NODES);
} catch (e) {
  console.error(`homelab disabled: ${e instanceof Error ? e.message : "bad config"}`);
}
const HOMELAB_FILE = process.env.HOMELAB_CACHE_FILE ?? "server/data/homelab.json";
const reports = loadReports(HOMELAB_FILE, nodes);
if (nodes.length) {
  const port = Number(process.env.INGEST_PORT ?? 8788);
  const host = process.env.INGEST_HOST ?? "127.0.0.1"; // the stats image sets 0.0.0.0; compose limits the host binding
  createIngest(nodes, reports, () => saveReports(HOMELAB_FILE, reports)).listen(port, host, () =>
    console.log(`homelab ingest on ${host}:${port} (${nodes.length} nodes)`),
  );
}

const stats = (): StatsResponse => ({
  github: github(),
  youtube: youtube(),
  homelab: project(nodes, reports, Date.now()),
  now: new Date().toISOString(),
});

// Push the same snapshot to the Cloudflare Worker that serves royalt.online, so the public site keeps
// the last known stats when this server is offline. Outbound only: nothing here is exposed.
const PUSH_URL = process.env.STATS_PUSH_URL;
const PUSH_TOKEN = process.env.STATS_PUSH_TOKEN;
if (PUSH_URL && PUSH_TOKEN) {
  const push = async () => {
    try {
      const res = await fetch(PUSH_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${PUSH_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(stats()),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) console.error(`stats push failed: HTTP ${res.status}`);
    } catch (e) {
      console.error(`stats push failed: ${e instanceof Error ? e.message : "error"}`);
    }
  };
  setTimeout(push, 5_000).unref(); // after the first GitHub/YouTube refresh
  setInterval(push, 60_000).unref();
}

createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://x").pathname;
  if (path === "/api/health") return void res.writeHead(200).end("ok");
  if (path === "/api/stats") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" });
    return void res.end(JSON.stringify(stats()));
  }
  res.writeHead(404).end();
}).listen(PORT, () => console.log(`stats service on :${PORT}`));
