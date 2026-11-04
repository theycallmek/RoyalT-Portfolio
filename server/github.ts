import type { GitHubStats } from "./types.ts";

interface ApiUser { login: string; public_repos: number; followers: number }
interface ApiRepo {
  name: string;
  stargazers_count: number;
  language: string | null;
  fork: boolean;
  html_url: string;
  pushed_at: string;
}

type LangBytes = Record<string, number>;

export function aggregate(user: ApiUser, repos: ApiRepo[], repoLangs: Map<string, LangBytes>): GitHubStats {
  const own = repos.filter((r) => !r.fork);
  const langs = new Map<string, number>();
  for (const r of own)
    for (const [name, bytes] of Object.entries(repoLangs.get(r.name) ?? {}))
      langs.set(name, (langs.get(name) ?? 0) + bytes);
  return {
    login: user.login,
    repos: user.public_repos,
    followers: user.followers,
    stars: own.reduce((n, r) => n + r.stargazers_count, 0),
    languages: [...langs].map(([name, bytes]) => ({ name, bytes })).sort((a, b) => b.bytes - a.bytes),
    topRepos: [...own]
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5)
      .map((r) => ({ name: r.name, stars: r.stargazers_count, language: r.language, url: r.html_url })),
    recent: [...repos]
      .sort((a, b) => b.pushed_at.localeCompare(a.pushed_at))
      .slice(0, 5)
      .map((r) => ({ repo: r.name, pushedAt: r.pushed_at, url: r.html_url })),
  };
}

// Per-repo language bytes, refetched only when the repo has new pushes (keeps us far under the 60 req/h limit).
const langCache = new Map<string, { pushedAt: string; langs: LangBytes }>();

export async function fetchGitHub(login: string, token?: string): Promise<GitHubStats> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "portfolio-stats",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
    return (await res.json()) as T;
  };
  const u = encodeURIComponent(login);
  const [user, repos] = await Promise.all([
    get<ApiUser>(`/users/${u}`),
    get<ApiRepo[]>(`/users/${u}/repos?per_page=100&sort=pushed`),
  ]);
  const repoLangs = new Map<string, LangBytes>();
  await Promise.all(
    repos
      .filter((r) => !r.fork)
      .map(async (r) => {
        let hit = langCache.get(r.name);
        if (hit?.pushedAt !== r.pushed_at) {
          hit = { pushedAt: r.pushed_at, langs: await get<LangBytes>(`/repos/${u}/${encodeURIComponent(r.name)}/languages`) };
          langCache.set(r.name, hit);
        }
        repoLangs.set(r.name, hit.langs);
      }),
  );
  return aggregate(user, repos, repoLangs);
}
