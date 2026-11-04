export interface GitHubStats {
  login: string;
  repos: number;
  followers: number;
  stars: number;
  languages: { name: string; bytes: number }[];
  topRepos: { name: string; stars: number; language: string | null; url: string }[];
  recent: { repo: string; pushedAt: string; url: string }[];
}

export interface Source<T> {
  data: T | null;
  fetchedAt: string | null;
  error: string | null;
}

export interface YouTubeStats {
  title: string;
  subscribers: number | null; // null when the channel hides its count
  views: number;
  videoCount: number; // channel's public upload count
  videos: YouTubeVideo[]; // all uploads (capped at 500), newest first
}

export interface YouTubeVideo {
  id: string;
  title: string;
  publishedAt: string;
  views: number;
  likes: number; // 0 when hidden
  comments: number; // 0 when disabled
  thumbnail: string;
  url: string;
}

// Public, rounded homelab values (server/homelab.ts project()). Nothing identifying: see the homelab plan's privacy rules.
export interface HomelabNode {
  id: string;
  label: string; // from config, e.g. "web server"
  hw: string; // from config, e.g. "x86 laptop"
  online: boolean; // reported within the last 3 minutes
  uptime: string | null; // "23d", or "5h" under a day
  cpu: number | null; // integer %
  mem: number | null; // integer %
  disk: number | null; // integer %
  temp: number | null; // integer °C, null when the machine has no sensor
  rx: number | null; // bytes/s, 2 significant digits
  tx: number | null;
  reportedAt: string | null; // last report, rounded down to the minute
}

export interface HomelabStats {
  nodes: HomelabNode[];
}

export interface StatsResponse {
  github: Source<GitHubStats>;
  youtube: Source<YouTubeStats>;
  homelab: Source<HomelabStats>;
  now: string;
}
