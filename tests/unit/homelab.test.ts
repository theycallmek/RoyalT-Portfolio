import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createIngest,
  MAX_BODY,
  nodeForAuth,
  parseNodes,
  project,
  type Report,
  type Stored,
  sha256,
  validateReport,
} from "../../server/homelab.ts";

const TOKENS = { web: "a".repeat(64), bot: "b".repeat(64) };
const nodes = parseNodes(
  JSON.stringify([
    {
      id: "web",
      label: "web server",
      hw: "x86 laptop",
      tokenSha256: sha256(TOKENS.web),
    },
    {
      id: "bot",
      label: "discord bot",
      hw: "ARM board",
      tokenSha256: sha256(TOKENS.bot),
    },
  ]),
);
const report: Report = {
  uptimeSeconds: 23 * 86400 + 5000,
  cpu: 12.4,
  memUsed: 1_536_000,
  memTotal: 4_096_000,
  disk: 44.6,
  temp: 52.7,
  rx: 12_345,
  tx: 340_123,
  arch: "x86",
};

describe("parseNodes", () => {
  it("is empty when unset", () => {
    expect(parseNodes(undefined)).toEqual([]);
    expect(parseNodes(" ")).toEqual([]);
  });
  it("parses valid entries", () => {
    expect(nodes.map((n) => n.id)).toEqual(["web", "bot"]);
  });
  it("rejects bad hashes, duplicate ids and bad JSON without echoing the input", () => {
    const bad = (v: unknown) => () => parseNodes(JSON.stringify(v));
    const ok = { id: "web", label: "w", hw: "h", tokenSha256: "f".repeat(64) };
    expect(bad([{ ...ok, tokenSha256: "xyz" }])).toThrow(/entry 0/);
    expect(bad([ok, ok])).toThrow(/entry 1/);
    expect(bad({ ok })).toThrow(/array/);
    expect(() => parseNodes('[{"secret-ish')).toThrow(
      /^HOMELAB_NODES is not valid JSON$/,
    );
  });
});

describe("nodeForAuth", () => {
  it("maps a token to its own node", () => {
    expect(nodeForAuth(nodes, `Bearer ${TOKENS.web}`)?.id).toBe("web");
    expect(nodeForAuth(nodes, `Bearer ${TOKENS.bot}`)?.id).toBe("bot");
  });
  it("rejects unknown, missing and malformed tokens", () => {
    expect(nodeForAuth(nodes, `Bearer ${"c".repeat(64)}`)).toBeUndefined();
    expect(nodeForAuth(nodes, undefined)).toBeUndefined();
    expect(nodeForAuth(nodes, TOKENS.web)).toBeUndefined();
    expect(nodeForAuth(nodes, "Bearer ")).toBeUndefined();
    expect(nodeForAuth([], `Bearer ${TOKENS.web}`)).toBeUndefined();
  });
});

describe("validateReport", () => {
  it("accepts a valid report and strips unknown fields", () => {
    const r = validateReport({
      ...report,
      hostname: "orangepi5",
      ip: "100.64.1.2",
      iface: "eth0",
    });
    expect(r).toEqual(report);
  });
  it("makes temp optional", () => {
    const { temp: _, ...noTemp } = report;
    expect(validateReport(noTemp)).toEqual(noTemp);
  });
  it.each([
    ["cpu over 100", { cpu: 101 }],
    ["negative disk", { disk: -1 }],
    ["memUsed over memTotal", { memUsed: 5_000_000 }],
    ["zero memTotal", { memTotal: 0, memUsed: 0 }],
    ["string number", { cpu: "12" }],
    ["NaN-ish", { rx: null }],
    ["silly temp", { temp: 400 }],
    ["unknown arch", { arch: "mips" }],
    ["missing uptime", { uptimeSeconds: undefined }],
  ])("rejects %s", (_, patch) => {
    expect(validateReport({ ...report, ...patch })).toBeNull();
  });
  it("rejects non-objects", () => {
    expect(validateReport(null)).toBeNull();
    expect(validateReport([report])).toBeNull();
    expect(validateReport("x")).toBeNull();
  });
});

describe("project", () => {
  const now = Date.parse("2026-11-02T12:00:30Z");
  const at = (msAgo: number): Stored => ({
    report,
    at: new Date(now - msAgo).toISOString(),
  });

  it("is unavailable without configured nodes", () => {
    expect(project([], {}, now)).toEqual({
      data: null,
      fetchedAt: null,
      error: "homelab not configured",
    });
  });

  it("rounds values and uses label/hw from config, not the agent", () => {
    const s = project(nodes, { web: at(10_000) }, now);
    expect(s.data?.nodes[0]).toEqual({
      id: "web",
      label: "web server",
      hw: "x86 laptop",
      online: true,
      uptime: "23d",
      cpu: 12,
      mem: 38,
      disk: 45,
      temp: 53,
      rx: 12_000,
      tx: 340_000,
      reportedAt: "2026-11-02T12:00:00.000Z",
    });
    expect(s.fetchedAt).toBe("2026-11-02T12:00:00.000Z");
  });

  it("shows hours under a day and null temp without a sensor", () => {
    const { temp: _, ...noTemp } = report;
    const s = project(
      nodes,
      {
        web: {
          report: { ...noTemp, uptimeSeconds: 5 * 3600 + 59 },
          at: new Date(now).toISOString(),
        },
      },
      now,
    );
    expect(s.data?.nodes[0]).toMatchObject({ uptime: "5h", temp: null });
  });

  it("goes offline after 3 minutes but keeps the last values", () => {
    const on = project(nodes, { web: at(179_000) }, now).data?.nodes[0];
    const off = project(nodes, { web: at(181_000) }, now).data?.nodes[0];
    expect(on?.online).toBe(true);
    expect(off).toMatchObject({ online: false, cpu: 12, uptime: "23d" });
  });

  it("lists a node that never reported with null values", () => {
    const bot = project(nodes, {}, now).data?.nodes[1];
    expect(bot).toMatchObject({
      id: "bot",
      online: false,
      cpu: null,
      reportedAt: null,
    });
  });

  it("publishes only the documented keys and nothing that looks like a host or IP", () => {
    // even if a hostile agent got extra fields into the store, they must not leak
    const leaky = {
      ...report,
      hostname: "orangepi5.collie-truck.ts.net",
      ip: "192.168.1.20",
    } as Report;
    const s = project(
      nodes,
      { web: { report: leaky, at: new Date(now).toISOString() } },
      now,
    );
    expect(Object.keys(s).sort()).toEqual(["data", "error", "fetchedAt"]);
    expect(Object.keys(s.data ?? {})).toEqual(["nodes"]);
    for (const n of s.data?.nodes ?? []) {
      expect(Object.keys(n).sort()).toEqual(
        [
          "cpu",
          "disk",
          "hw",
          "id",
          "label",
          "mem",
          "online",
          "reportedAt",
          "rx",
          "temp",
          "tx",
          "uptime",
        ].sort(),
      );
    }
    const json = JSON.stringify(s);
    expect(json).not.toMatch(/\b\d{1,3}(\.\d{1,3}){3}\b/); // IPv4
    expect(json).not.toMatch(/[0-9a-f]{0,4}(:[0-9a-f]{0,4}){3,}/i); // IPv6-ish (ISO times have only 2 colons)
    expect(json).not.toMatch(/ts\.net|orangepi|hostname|\.local\b/i);
    expect(json).not.toContain(nodes[0].tokenSha256);
  });
});

describe("ingest listener", () => {
  let clock = Date.parse("2026-11-02T12:00:00Z");
  const store: Record<string, Stored> = {};
  const accepted = vi.fn();
  const server = createIngest(nodes, store, accepted, () => clock);
  let url = "";
  const logs = [
    vi.spyOn(console, "log"),
    vi.spyOn(console, "error"),
    vi.spyOn(console, "warn"),
  ];

  beforeAll(async () => {
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ingest`;
  });
  afterAll(() => {
    server.close();
  });

  const post = (
    body: string,
    token = TOKENS.web,
    headers: Record<string, string> = {},
  ) =>
    fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...headers,
      },
      body,
    }).then((r) => r.status);

  it("rejects unknown tokens", async () => {
    expect(await post(JSON.stringify(report), "z".repeat(64))).toBe(401);
    expect(store).toEqual({});
  });
  it("only serves POST /ingest", async () => {
    expect((await fetch(url.replace("/ingest", "/api/stats"))).status).toBe(
      404,
    );
    expect((await fetch(url)).status).toBe(405);
  });
  it("requires JSON", async () => {
    expect(
      await post(JSON.stringify(report), TOKENS.web, {
        "content-type": "text/plain",
      }),
    ).toBe(415);
  });
  it("rejects invalid payloads and oversized bodies", async () => {
    expect(await post("{not json")).toBe(400);
    expect(await post(JSON.stringify({ ...report, cpu: 500 }))).toBe(400);
    const big = JSON.stringify({ ...report, pad: "x".repeat(MAX_BODY) });
    expect(await post(big)).toBe(413);
    expect(store).toEqual({});
  });
  it("accepts a report for the token's own node, then rate limits it", async () => {
    expect(
      await post(JSON.stringify({ ...report, hostname: "secret-host" })),
    ).toBe(204);
    expect(store.web.report).toEqual(report);
    expect(store.bot).toBeUndefined();
    expect(accepted).toHaveBeenCalledTimes(1);
    clock += 19_000;
    expect(await post(JSON.stringify(report))).toBe(429);
    expect(await post(JSON.stringify(report), TOKENS.bot)).toBe(204); // per node
    clock += 2_000;
    expect(await post(JSON.stringify(report))).toBe(204);
    expect(accepted).toHaveBeenCalledTimes(3);
  });
  it("never logs", () => {
    for (const l of logs) expect(l).not.toHaveBeenCalled();
  });
});
