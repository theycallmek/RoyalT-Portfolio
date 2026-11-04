// royalt.online on Cloudflare: the static site is served from Workers Static Assets; this script only
// runs for /api/* (wrangler.jsonc run_worker_first). The home stats service POSTs its snapshot here every
// minute (outbound, bearer token); visitors GET the last one from D1, so stats survive a home outage.
import { authorized, freshen, parsePush } from "./stats.ts";

// Minimal shapes of the bindings used (avoids a dependency on @cloudflare/workers-types).
type D1 = {
  prepare(sql: string): { bind(...v: unknown[]): D1Stmt } & D1Stmt;
  batch(stmts: D1Stmt[]): Promise<unknown>;
};
type D1Stmt = { first<T>(): Promise<T | null>; run(): Promise<unknown> };
type Env = { DB: D1; STATS_PUSH_TOKEN?: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === "/api/health") return new Response("ok");
    if (pathname !== "/api/stats") return json({ error: "not found" }, 404);

    if (req.method === "POST") {
      if (
        !(await authorized(
          req.headers.get("Authorization"),
          env.STATS_PUSH_TOKEN,
        ))
      )
        return json({ error: "unauthorized" }, 401);
      const body = parsePush(await req.text());
      if (!body) return json({ error: "invalid body" }, 400);
      await env.DB.batch([
        env.DB.prepare(
          "CREATE TABLE IF NOT EXISTS stats (id INTEGER PRIMARY KEY, body TEXT NOT NULL)",
        ),
        env.DB.prepare(
          "INSERT INTO stats (id, body) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET body = excluded.body",
        ).bind(body),
      ]);
      return json({ ok: true });
    }

    if (req.method !== "GET" && req.method !== "HEAD")
      return json({ error: "method not allowed" }, 405);
    try {
      const row = await env.DB.prepare(
        "SELECT body FROM stats WHERE id = 1",
      ).first<{ body: string }>();
      if (!row) return json({ error: "no stats yet" }, 503);
      return json(freshen(row.body, Date.now()));
    } catch {
      return json({ error: "no stats yet" }, 503); // table not created until the first push
    }
  },
};
