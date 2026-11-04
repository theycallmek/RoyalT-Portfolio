import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const github = {
  login: "theycallmek",
  repos: 9,
  followers: 6,
  stars: 58,
  languages: [{ name: "Python", bytes: 5000 }],
  topRepos: [
    {
      name: "Klipper-Input-Shaping-Assistant",
      stars: 57,
      language: "Python",
      url: "https://github.com/x/y",
    },
  ],
  recent: [
    {
      repo: "WLED-COMPILE",
      pushedAt: new Date().toISOString(),
      url: "https://github.com/x/z",
    },
  ],
};
// data: URL thumbnail, so mocked pages never fetch from i.ytimg.com
const thumb =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const youtube = {
  title: "Royal T",
  subscribers: 195,
  views: 135427,
  videoCount: 48,
  videos: [
    {
      id: "abc123",
      title: "Input shaping a Voron in ten minutes",
      publishedAt: "2025-06-01T12:00:00Z",
      views: 5000, // most viewed
      likes: 5,
      comments: 7,
      thumbnail: thumb,
      url: "https://www.youtube.com/watch?v=abc123",
    },
    // 14 clips with distinct stats: newest is Clip 13, most liked is Clip 09 (14 likes)
    ...Array.from({ length: 14 }, (_, i) => ({
      id: `clip${i}`,
      title: `Clip ${String(i).padStart(2, "0")}`,
      publishedAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      views: (((i * 5) % 14) + 1) * 100,
      likes: ((i * 3) % 14) + 1,
      comments: 0,
      thumbnail: thumb,
      url: `https://www.youtube.com/watch?v=clip${i}`,
    })),
  ],
};
const live = (data: unknown) => ({
  data,
  fetchedAt: new Date().toISOString(),
  error: null,
});
const down = { data: null, fetchedAt: null, error: "HTTP 500" };
const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60_000).toISOString();
const node = (id: string, label: string, hw: string) => ({
  id,
  label,
  hw,
  online: true,
  uptime: "23d",
  cpu: 12,
  mem: 38,
  disk: 45,
  temp: 52,
  rx: 340_000,
  tx: 12_000,
  reportedAt: minutesAgo(0),
});
const homelab = {
  nodes: [
    node("web", "web server", "x86 laptop"),
    { ...node("bot", "discord bot", "ARM board"), temp: null, uptime: "5h" },
    // offline: keeps its last values, dimmed
    {
      ...node("router", "router", "ARM board"),
      online: false,
      reportedAt: minutesAgo(5),
    },
  ],
};
const ok = {
  github: live(github),
  youtube: live(youtube),
  homelab: live(homelab),
  now: new Date().toISOString(),
};
const noData = {
  github: down,
  youtube: down,
  homelab: { data: null, fetchedAt: null, error: "homelab not configured" },
  now: new Date().toISOString(),
};

test("shows live github data", async ({ page }) => {
  await page.route("**/api/stats", (r) => r.fulfill({ json: ok }));
  await page.goto("/");
  await expect(page.getByText("Klipper-Input-Shaping-Assistant")).toBeVisible();
  await expect(page.getByText("Python").first()).toBeVisible();
});

test("shows stale badge when the source errors but data exists", async ({
  page,
}) => {
  const stale = { ...ok, github: { ...ok.github, error: "GitHub HTTP 403" } };
  await page.route("**/api/stats", (r) => r.fulfill({ json: stale }));
  await page.goto("/");
  await expect(page.getByText(/stale/i)).toBeVisible();
  await expect(page.getByText("Klipper-Input-Shaping-Assistant")).toBeVisible();
});

test("shows unavailable state when there is no data, other cards still render", async ({
  page,
}) => {
  await page.route("**/api/stats", (r) => r.fulfill({ json: noData }));
  await page.goto("/");
  await expect(page.getByText(/GitHub data unavailable/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: /3D printing/i }),
  ).toBeVisible();
});

test("survives the stats endpoint being down", async ({ page }) => {
  await page.route("**/api/stats", (r) => r.abort());
  await page.goto("/");
  await expect(page.getByText(/GitHub data unavailable/i)).toBeVisible();
});

const glance = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "At a glance" });

test("glance strip shows live values and links to the subsections", async ({
  page,
}) => {
  await page.route("**/api/stats", (r) => r.fulfill({ json: ok }));
  await page.goto("/");
  const g = glance(page);
  await expect(
    g.getByRole("link", { name: "58 GitHub stars" }),
  ).toHaveAttribute("href", "#github");
  await expect(
    g.getByRole("link", { name: "195 YouTube subscribers" }),
  ).toHaveAttribute("href", "#youtube");
  // MakerWorld is static (src/data/makerworld.json): its number comes from that file
  await expect(
    g.getByRole("link", { name: /MakerWorld models/ }),
  ).toHaveAttribute("href", "#makerworld");
});

test("glance strip shows a dash for unavailable sources", async ({ page }) => {
  await page.route("**/api/stats", (r) => r.fulfill({ json: noData }));
  await page.goto("/");
  const g = glance(page);
  await expect(
    g.getByRole("link", { name: "GitHub stars unavailable" }),
  ).toContainText("—");
  await expect(
    g.getByRole("link", { name: "YouTube subscribers unavailable" }),
  ).toContainText("—");
});

test("glance strip keeps its height from loading to loaded", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/stats", async (r) => {
    await held;
    await r.fulfill({ json: ok });
  });
  await page.goto("/");
  const g = glance(page);
  await expect(
    g.getByRole("link", { name: "GitHub stars loading" }),
  ).toBeVisible();
  const before = (await g.boundingBox())?.height;
  release();
  await expect(g.getByRole("link", { name: "58 GitHub stars" })).toBeVisible();
  expect((await g.boundingBox())?.height).toBe(before);
});

test("shows live youtube data", async ({ page }) => {
  await page.route("**/api/stats", (r) => r.fulfill({ json: ok }));
  await page.goto("/");
  const yt = page.locator("#youtube");
  await expect(yt.getByText("135,427")).toBeVisible();
  await expect(yt.getByText("195")).toBeVisible();
  await expect(
    yt.getByRole("link", { name: /Input shaping a Voron/ }),
  ).toHaveAttribute("href", "https://www.youtube.com/watch?v=abc123");
});

test("shows hidden when the channel hides its subscriber count", async ({
  page,
}) => {
  const hidden = {
    ...ok,
    youtube: live({ ...youtube, subscribers: null }),
  };
  await page.route("**/api/stats", (r) => r.fulfill({ json: hidden }));
  await page.goto("/");
  await expect(page.locator("#youtube").getByText("hidden")).toBeVisible();
});

test("shows youtube stale badge when the source errors but data exists", async ({
  page,
}) => {
  const stale = {
    ...ok,
    youtube: { ...ok.youtube, error: "YouTube HTTP 403 (quotaExceeded)" },
  };
  await page.route("**/api/stats", (r) => r.fulfill({ json: stale }));
  await page.goto("/");
  const yt = page.locator("#youtube");
  await expect(yt.getByText(/stale/i)).toBeVisible();
  await expect(yt.getByText("Input shaping a Voron")).toBeVisible();
  await expect(page.locator("#github").getByText(/stale/i)).toHaveCount(0);
});

test("youtube unavailable while github still renders", async ({ page }) => {
  await page.route("**/api/stats", (r) =>
    r.fulfill({ json: { ...ok, youtube: down } }),
  );
  await page.goto("/");
  await expect(page.getByText(/YouTube data unavailable/i)).toBeVisible();
  await expect(page.getByText("Klipper-Input-Shaping-Assistant")).toBeVisible();
});

test("github unavailable while youtube still renders", async ({ page }) => {
  await page.route("**/api/stats", (r) =>
    r.fulfill({ json: { ...ok, github: down } }),
  );
  await page.goto("/");
  await expect(page.getByText(/GitHub data unavailable/i)).toBeVisible();
  await expect(page.getByText("Input shaping a Voron")).toBeVisible();
});

test("sorts youtube videos and shows more", async ({ page }) => {
  await page.route("**/api/stats", (r) => r.fulfill({ json: ok }));
  await page.goto("/");
  const grid = page.locator("#youtube").getByRole("region", { name: "Videos" });
  const cards = grid.getByRole("link");
  const sortBy = (name: string) =>
    grid.getByRole("group", { name: "Sort videos" }).getByRole("button", {
      name,
    });
  const more = grid.getByRole("button", { name: /show more/ });

  // default: most viewed
  await expect(sortBy("most viewed")).toHaveAttribute("aria-pressed", "true");
  await expect(cards.first()).toContainText("Input shaping a Voron");
  await expect(cards.first()).toContainText("5,000 views · 2025-06-01");
  await expect(cards.nth(1)).toContainText("Clip 11");
  await expect(cards).toHaveCount(6);

  await sortBy("newest").click();
  await expect(sortBy("newest")).toHaveAttribute("aria-pressed", "true");
  await expect(sortBy("most viewed")).toHaveAttribute("aria-pressed", "false");
  await expect(cards.first()).toContainText("Clip 13");
  await expect(cards.first()).toContainText("2026-01-14 · ");

  await sortBy("most liked").click();
  await expect(sortBy("most liked")).toHaveAttribute("aria-pressed", "true");
  await expect(cards.first()).toContainText("Clip 09");
  await expect(cards.first()).toContainText("14 likes · ");

  // show more: 6 -> 12 -> 15, then the button goes away
  await expect(more).toHaveText("show more (9 left)");
  await more.click();
  await expect(cards).toHaveCount(12);
  await expect(more).toHaveText("show more (3 left)");
  await more.click();
  await expect(cards).toHaveCount(15);
  await expect(more).toHaveCount(0);
  await expect(grid.locator("[aria-live]")).toHaveText(
    "Sorted by most liked, showing 15 of 15",
  );

  // changing sort resets to one page
  await sortBy("newest").click();
  await expect(cards).toHaveCount(6);
  await expect(more).toHaveText("show more (9 left)");
});

test("youtube keeps its height from loading to loaded", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/stats", async (r) => {
    await held;
    await r.fulfill({ json: ok });
  });
  await page.goto("/");
  const yt = page.locator("#youtube");
  await expect(yt.locator("[aria-busy]")).toBeVisible();
  const before = (await yt.boundingBox())?.height;
  release();
  await expect(yt.getByText("Input shaping a Voron")).toBeVisible();
  expect((await yt.boundingBox())?.height).toBe(before);
});

test("tolerates an old youtube cache without a videos list", async ({
  page,
}) => {
  const { videoCount: _, videos: __, ...rest } = youtube;
  const old = {
    ...ok,
    youtube: live({ ...rest, videos: 48, latest: youtube.videos }),
  };
  await page.route("**/api/stats", (r) => r.fulfill({ json: old }));
  await page.goto("/");
  const yt = page.locator("#youtube");
  await expect(yt.getByText("135,427")).toBeVisible();
  await expect(yt.getByRole("region", { name: "Videos" })).toHaveCount(0);
});

test("shows homelab machines, online and offline", async ({ page }) => {
  await page.route("**/api/stats", (r) => r.fulfill({ json: ok }));
  await page.goto("/");
  const hl = page.locator("#homelab");
  await expect(hl.locator("[aria-busy]")).toHaveCount(0);
  const card = (name: string) =>
    hl.locator("div.border-b", {
      has: page.getByRole("heading", { level: 4, name, exact: true }),
    });
  const web = card("web server");
  await expect(web).toContainText("x86 laptop");
  await expect(web).toContainText("online, up 23d");
  await expect(web).toContainText("CPU12%");
  await expect(web).toContainText("MEM38%");
  await expect(web).toContainText("DISK45%");
  await expect(web).toContainText("52°C");
  await expect(web).toContainText("↑upload 12 KB/s ↓download 340 KB/s");
  await expect(card("discord bot")).toContainText("up 5h");
  await expect(card("discord bot")).toContainText("TEMP—");
  const router = card("router");
  await expect(router).toContainText("offline · 5m ago");
  await expect(router).toContainText("CPU12%"); // last values kept
  await expect(router).toHaveClass(/text-dim/);
  await expect(web).not.toHaveClass(/text-dim/);
  // cards are not links
  await expect(hl.getByRole("link")).toHaveCount(0);
});

test("homelab unavailable while the rest of the page renders", async ({
  page,
}) => {
  await page.route("**/api/stats", (r) =>
    r.fulfill({ json: { ...ok, homelab: noData.homelab } }),
  );
  await page.goto("/");
  await expect(
    page.locator("#homelab").getByText("Homelab stats unavailable"),
  ).toBeVisible();
  await expect(page.getByText("Klipper-Input-Shaping-Assistant")).toBeVisible();
  await expect(page.getByText("Input shaping a Voron")).toBeVisible();
});

test("homelab treats an older service without the field as unavailable", async ({
  page,
}) => {
  const { homelab: _, ...old } = ok;
  await page.route("**/api/stats", (r) => r.fulfill({ json: old }));
  await page.goto("/");
  await expect(
    page.locator("#homelab").getByText("Homelab stats unavailable"),
  ).toBeVisible();
});

test("homelab keeps its height from loading to loaded", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/stats", async (r) => {
    await held;
    await r.fulfill({ json: ok });
  });
  await page.goto("/");
  const hl = page.locator("#homelab");
  await expect(hl.locator("[aria-busy]")).toBeVisible();
  const before = (await hl.boundingBox())?.height;
  release();
  await expect(hl.getByText("offline · 5m ago")).toBeVisible();
  expect((await hl.boundingBox())?.height).toBe(before);
});

test.describe("axe", () => {
  // see a11y.spec.ts: settled colours, not mid fade-in
  test.use({ reducedMotion: "reduce" });

  for (const colorScheme of ["dark", "light"] as const) {
    test(`no axe violations on dashboard with data (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.route("**/api/stats", (r) => r.fulfill({ json: ok }));
      await page.goto("/");
      await expect(
        page.getByText("Klipper-Input-Shaping-Assistant"),
      ).toBeVisible();
      await expect(page.getByText("Input shaping a Voron")).toBeVisible();
      await expect(page.getByText("offline · 5m ago")).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

    test(`no axe violations on expanded makerworld models (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.route("**/api/stats", (r) => r.fulfill({ json: ok }));
      await page.goto("/#makerworld");
      await expect(
        page.locator("#makerworld astro-island:not([ssr])"),
      ).toHaveCount(1);
      await page
        .locator("#makerworld")
        .getByRole("button", { name: /show more/ })
        .click();
      const results = await new AxeBuilder({ page })
        .include("#makerworld")
        .analyze();
      expect(results.violations).toEqual([]);
    });

    test(`no axe violations on dashboard without data (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.route("**/api/stats", (r) => r.fulfill({ json: noData }));
      await page.goto("/");
      await expect(page.getByText(/GitHub data unavailable/i)).toBeVisible();
      await expect(page.getByText(/YouTube data unavailable/i)).toBeVisible();
      await expect(page.getByText("Homelab stats unavailable")).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

// MakerWorld is static: expectations come from the committed src/data/makerworld.json.
type Model = {
  title: string;
  url: string;
  image?: string;
  downloads: number;
  likes: number;
  prints: number;
  published: string;
};
const mw: { items: Model[] } = JSON.parse(
  readFileSync("src/data/makerworld.json", "utf8"),
);
const fmtN = new Intl.NumberFormat("en").format;
const byNewest = (a: Model, b: Model) => b.published.localeCompare(a.published);
const mwSorts = {
  "most downloaded": (a: Model, b: Model) =>
    b.downloads - a.downloads || byNewest(a, b),
  "most liked": (a: Model, b: Model) => b.likes - a.likes || byNewest(a, b),
  "most printed": (a: Model, b: Model) => b.prints - a.prints || byNewest(a, b),
  newest: byNewest,
};
const sorted = (name: keyof typeof mwSorts) =>
  [...mw.items].sort(mwSorts[name]);

async function openMakerWorld(page: import("@playwright/test").Page) {
  await page.route("**/api/stats", (r) => r.fulfill({ json: ok }));
  await page.goto("/#makerworld");
  // client:visible island: wait for hydration before clicking
  await expect(page.locator("#makerworld astro-island:not([ssr])")).toHaveCount(
    1,
  );
  return page.locator("#makerworld").getByRole("region", { name: "Models" });
}

test("makerworld models are linked cards with local covers", async ({
  page,
}) => {
  // covers are bundled local files: nothing may be fetched from MakerWorld
  const remote: string[] = [];
  await page.route(/makerworld\.(com|bblmw\.com)/, (r) => {
    remote.push(r.request().url());
    return r.abort();
  });
  const grid = await openMakerWorld(page);
  const cards = grid.getByRole("link");
  const shown = sorted("most downloaded").slice(0, 6);
  await expect(cards).toHaveCount(shown.length);
  for (const [i, m] of shown.entries()) {
    const card = cards.nth(i);
    await expect(card).toHaveAttribute("href", m.url);
    expect(m.url).toMatch(/^https:\/\/makerworld\.com\/en\/models\/\d+-/);
    await expect(card).toHaveAttribute("target", "_blank");
    await expect(card).toHaveAttribute("rel", "noopener noreferrer");
    await expect(card).toContainText("(opens in new tab)");
    if (!m.image) continue;
    const img = card.locator("img");
    await expect(img).toHaveAttribute("alt", "");
    await expect(img).toHaveAttribute("loading", "lazy");
    await expect(img).toHaveAttribute("width", /^\d+$/);
    await expect(img).toHaveAttribute("height", /^\d+$/);
    await expect(img).toHaveAttribute("srcset", /webp/);
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
  }
  expect(remote).toEqual([]);
});

test("sorts makerworld models and shows more", async ({ page }) => {
  // the show-more steps below assume the committed data has 7 to 12 models
  expect(mw.items.length).toBeGreaterThan(6);
  expect(mw.items.length).toBeLessThanOrEqual(12);
  const total = mw.items.length;
  const grid = await openMakerWorld(page);
  const cards = grid.getByRole("link");
  const sortBy = (name: string) =>
    grid
      .getByRole("group", { name: "Sort models" })
      .getByRole("button", { name, exact: true });
  const more = grid.getByRole("button", { name: /show more/ });
  const live = grid.locator("[aria-live]");
  const first = (name: keyof typeof mwSorts) => sorted(name)[0];
  const expectOrder = async (name: keyof typeof mwSorts) => {
    for (const [i, m] of sorted(name).slice(0, 6).entries()) {
      await expect(cards.nth(i)).toContainText(m.title);
    }
  };

  // default: most downloaded (server-rendered)
  await expect(sortBy("most downloaded")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const top = first("most downloaded");
  await expect(cards.first()).toContainText(
    `${fmtN(top.downloads)} downloads · ♥ ${fmtN(top.likes)}`,
  );
  await expectOrder("most downloaded");
  await expect(cards).toHaveCount(6);

  const lead = {
    "most liked": `${fmtN(first("most liked").likes)} likes · `,
    "most printed": `${fmtN(first("most printed").prints)} prints · `,
    newest: `${first("newest").published.slice(0, 10)} · ↓ `,
  };
  for (const name of ["most liked", "most printed", "newest"] as const) {
    await sortBy(name).click();
    await expect(sortBy(name)).toHaveAttribute("aria-pressed", "true");
    await expect(sortBy("most downloaded")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(live).toHaveText(`Sorted by ${name}, showing 6 of ${total}`);
    await expect(cards.first()).toContainText(first(name).title);
    await expect(cards.first()).toContainText(lead[name]);
    await expectOrder(name);
  }

  // show more: 6 -> all, then the button goes away
  await sortBy("most liked").click();
  await expect(more).toHaveText(`show more (${total - 6} left)`);
  await more.click();
  await expect(cards).toHaveCount(total);
  await expect(more).toHaveCount(0);
  await expect(live).toHaveText(
    `Sorted by most liked, showing ${total} of ${total}`,
  );

  // changing sort resets to one page
  await sortBy("newest").click();
  await expect(cards).toHaveCount(6);
  await expect(more).toHaveText(`show more (${total - 6} left)`);
});
