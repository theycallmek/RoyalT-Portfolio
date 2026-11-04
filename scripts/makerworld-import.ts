// Import MakerWorld stats from a saved copy of your profile page.
//
// MakerWorld blocks automated browsers (Cloudflare), so the workflow is semi-manual:
//   1. In your normal browser open https://makerworld.com/en/@RoyalT/upload and wait for the models.
//   2. Ctrl+S -> "Webpage, HTML Only" -> save as makerworld-sample.html in the project root.
//   3. npm run makerworld:import            (or: npm run makerworld:import -- path/to/page.html)
// It reads the page's embedded Next.js data (__NEXT_DATA__), validates it against the site schema,
// prints what changed and writes src/data/makerworld.json.
// It keeps every design (cap 60) and downloads each cover into src/assets/makerworld/<id>.webp (960px wide max)
// and deletes covers no longer listed. Commit both the JSON and that folder.
// If MakerWorld changes its page format, the error names the missing field: update extractMakerWorld.
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { makerworldSchema } from "../src/lib/schemas.ts";

const DATA_FILE = "src/data/makerworld.json";
const MAX_ITEMS = 60;
const ASSET_DIR = "src/assets/makerworld";
const IMAGE_HOST = "makerworld.bblmw.com";
const MAX_BYTES = 15 * 1024 * 1024;

interface Design {
  id: number;
  slug: string;
  title: string;
  coverUrl?: string;
  downloadCount: number;
  likeCount: number;
  printCount?: number;
  publishTime: string;
}

function need<T>(value: T | undefined | null, field: string): T {
  if (value === undefined || value === null) {
    throw new Error(
      `MakerWorld page format changed: missing ${field}. Update scripts/makerworld-import.ts.`,
    );
  }
  return value;
}

export function extractMakerWorld(html: string, today: string) {
  const raw = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  )?.[1];
  if (!raw) {
    throw new Error(
      "No __NEXT_DATA__ in the saved page. Was it the Cloudflare check page, or saved as 'Webpage, Complete'? Save the loaded profile as 'Webpage, HTML Only'.",
    );
  }
  const props = need(JSON.parse(raw)?.props?.pageProps, "props.pageProps");
  const user = need(props.userInfo, "userInfo");
  const designs: Design[] = need(props.designs, "designs");
  const handle: string = need(user.handle, "userInfo.handle");

  return makerworldSchema.parse({
    updated: today,
    profileUrl: `https://makerworld.com/en/@${handle}`,
    models: props.uploadCount?.designCnt ?? designs.length,
    downloads: need(user.downloadCount, "userInfo.downloadCount"),
    likes: need(user.likeCount, "userInfo.likeCount"),
    items: [...designs]
      .sort(
        (a, b) =>
          b.downloadCount - a.downloadCount ||
          b.publishTime.localeCompare(a.publishTime),
      )
      .slice(0, MAX_ITEMS)
      .map((d) => ({
        title: d.title,
        url: `https://makerworld.com/en/models/${d.id}-${d.slug}`,
        ...(d.coverUrl ? { imageUrl: d.coverUrl } : {}),
        downloads: d.downloadCount,
        likes: d.likeCount,
        prints: d.printCount ?? 0,
        published: need(d.publishTime, "designs[].publishTime"),
      })),
  });
}

// The saved page is untrusted: only fetch covers from MakerWorld's own image CDN.
export function allowedImageUrl(url: string): boolean {
  if (!URL.canParse(url)) return false;
  const u = new URL(url);
  return (
    u.protocol === "https:" &&
    u.hostname === IMAGE_HOST &&
    !u.username &&
    !u.password
  );
}

export function coverFile(modelUrl: string): string | undefined {
  const id = modelUrl.match(/\/models\/(\d+)(?:-|$)/)?.[1];
  return id ? `${id}.webp` : undefined;
}

export function staleFiles(existing: string[], keep: string[]): string[] {
  return existing.filter((f) => f.endsWith(".webp") && !keep.includes(f));
}

async function downloadCover(url: string, dest: string) {
  // The CDN (Aliyun OSS) resizes on request: an animated GIF cover is 17 MB raw, about 150 KB this way.
  // If it ever ignores the parameter, the size cap and the local resize below still apply.
  const u = new URL(url);
  u.searchParams.set("x-oss-process", "image/resize,w_960");
  // redirect "error": a redirect could leave the allowed host
  const res = await fetch(u, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  if (Number(res.headers.get("content-length")) > MAX_BYTES)
    throw new Error("larger than 15 MB");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of res.body) {
    size += chunk.byteLength;
    if (size > MAX_BYTES) throw new Error("larger than 15 MB");
    chunks.push(chunk);
  }
  const input = Buffer.concat(chunks);
  await sharp(input).metadata(); // throws if it is not an image sharp can decode
  await sharp(input)
    .resize({ width: 960, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(dest);
}

async function addCovers(
  models: { url: string; imageUrl?: string; image?: string }[],
) {
  mkdirSync(ASSET_DIR, { recursive: true });
  for (const m of models) {
    const file = coverFile(m.url);
    if (!m.imageUrl || !file) continue;
    if (!allowedImageUrl(m.imageUrl)) {
      console.warn(`skipped cover (not https://${IMAGE_HOST}): ${m.imageUrl}`);
      continue;
    }
    try {
      await downloadCover(m.imageUrl, join(ASSET_DIR, file));
      m.image = file;
    } catch (e) {
      console.warn(
        `cover download failed for ${m.url}: ${(e as Error).message}`,
      );
    }
  }
  const keep = models.flatMap((m) => (m.image ? [m.image] : []));
  for (const f of staleFiles(readdirSync(ASSET_DIR), keep)) {
    rmSync(join(ASSET_DIR, f));
    console.log(`deleted stale cover ${f}`);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const file = process.argv[2] ?? "makerworld-sample.html";
  const today = new Date().toISOString().slice(0, 10);
  const next = extractMakerWorld(readFileSync(file, "utf8"), today);
  const prev = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  for (const key of ["models", "downloads", "likes"] as const) {
    const arrow =
      prev[key] === next[key] ? "unchanged" : `${prev[key]} -> ${next[key]}`;
    console.log(
      `${key.padEnd(10)} ${String(next[key]).padStart(7)}  (${arrow})`,
    );
  }
  console.log("models:");
  for (const m of next.items)
    console.log(`  ${String(m.downloads).padStart(6)} dl  ${m.title}`);
  await addCovers(next.items);
  for (const m of next.items)
    console.log(`  cover ${m.image ?? "(none)"}  ${m.title}`);
  writeFileSync(
    DATA_FILE,
    `${JSON.stringify(makerworldSchema.parse(next), null, 2)}\n`,
  );
  console.log(
    `wrote ${DATA_FILE} (updated ${today}) - rebuild or restart dev to see it`,
  );
}
