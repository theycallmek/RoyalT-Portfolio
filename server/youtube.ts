import type { YouTubeStats } from "./types.ts";

// YouTube Data API v3 returns counts as strings.
interface ApiChannel {
  snippet: { title: string };
  statistics: { viewCount: string; subscriberCount?: string; hiddenSubscriberCount: boolean; videoCount: string };
  contentDetails?: { relatedPlaylists: { uploads: string } };
}
interface ApiVideo {
  id: string;
  snippet: { title: string; publishedAt: string; thumbnails: { medium?: { url: string } } };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
}

export function aggregateYouTube(channel: ApiChannel, videos: ApiVideo[]): YouTubeStats {
  const st = channel.statistics;
  return {
    title: channel.snippet.title,
    subscribers: st.hiddenSubscriberCount ? null : Number(st.subscriberCount ?? 0),
    views: Number(st.viewCount),
    videoCount: Number(st.videoCount),
    videos: [...videos]
      .sort((a, b) => b.snippet.publishedAt.localeCompare(a.snippet.publishedAt))
      .map((v) => ({
        id: v.id,
        title: v.snippet.title,
        publishedAt: v.snippet.publishedAt,
        views: Number(v.statistics.viewCount ?? 0),
        likes: Number(v.statistics.likeCount ?? 0),
        comments: Number(v.statistics.commentCount ?? 0),
        thumbnail: v.snippet.thumbnails.medium?.url ?? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${v.id}`,
      })),
  };
}

const MAX_VIDEOS = 500;

// Follows nextPageToken until there are no more pages or `cap` items are collected.
export async function collectPages<T>(
  page: (token: string | undefined) => Promise<{ items?: T[]; nextPageToken?: string }>,
  cap: number,
): Promise<T[]> {
  const all: T[] = [];
  let token: string | undefined;
  do {
    const r = await page(token);
    all.push(...(r.items ?? []));
    token = r.nextPageToken;
  } while (token && all.length < cap);
  return all.slice(0, cap);
}

export const chunk = <T>(xs: T[], n: number): T[][] =>
  Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

// Never echo the API's message or the request URL: only status + machine-readable reason reach cache and clients.
export function youtubeError(status: number, body: unknown): string {
  const reason = (body as { error?: { errors?: { reason?: unknown }[] } } | null)?.error?.errors?.[0]?.reason;
  return typeof reason === "string" && /^\w+$/.test(reason)
    ? `YouTube HTTP ${status} (${reason})`
    : `YouTube HTTP ${status}`;
}

export async function fetchYouTube(channelId: string, key: string | undefined): Promise<YouTubeStats> {
  if (!key) throw new Error("YOUTUBE_API_KEY not set");
  const get = async <T>(path: string): Promise<T> => {
    let res: Response;
    try {
      // Key goes in a header, never the URL, so it cannot leak through URL logs or error text.
      res = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
        headers: { "x-goog-api-key": key },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      throw new Error(e instanceof Error && e.name === "TimeoutError" ? "YouTube timeout" : "YouTube network error");
    }
    if (!res.ok) throw new Error(youtubeError(res.status, await res.json().catch(() => null)));
    return (await res.json()) as T;
  };
  const { items: [channel] = [] } = await get<{ items?: ApiChannel[] }>(
    `channels?part=snippet,statistics,contentDetails&id=${encodeURIComponent(channelId)}`,
  );
  const uploads = channel?.contentDetails?.relatedPlaylists.uploads;
  if (!channel || !uploads) throw new Error("YouTube channel not found");
  // Quota: 1 unit per call, so 1 + 2 * ceil(n / 50) per refresh.
  const playlist = await collectPages(
    (token) =>
      get<{ items?: { contentDetails: { videoId: string } }[]; nextPageToken?: string }>(
        `playlistItems?part=contentDetails&maxResults=50&playlistId=${encodeURIComponent(uploads)}` +
          (token ? `&pageToken=${encodeURIComponent(token)}` : ""),
      ),
    MAX_VIDEOS,
  );
  const videos: ApiVideo[] = [];
  for (const ids of chunk(
    playlist.map((p) => p.contentDetails.videoId),
    50,
  )) {
    const { items = [] } = await get<{ items?: ApiVideo[] }>(
      `videos?part=snippet,statistics&id=${ids.map(encodeURIComponent).join(",")}`,
    );
    videos.push(...items);
  }
  return aggregateYouTube(channel, videos);
}
