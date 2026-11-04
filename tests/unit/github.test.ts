import { describe, expect, it } from "vitest";
import { aggregate } from "../../server/github.ts";

const user = { login: "u", public_repos: 3, followers: 6 };
const repos = [
  {
    name: "a",
    stargazers_count: 57,
    language: "Python",
    fork: false,
    html_url: "https://github.com/u/a",
    pushed_at: "2026-10-01T00:00:00Z",
  },
  {
    name: "b",
    stargazers_count: 10,
    language: "Python",
    fork: true,
    html_url: "https://github.com/u/b",
    pushed_at: "2026-10-05T00:00:00Z",
  },
  {
    name: "c",
    stargazers_count: 1,
    language: null,
    fork: false,
    html_url: "https://github.com/u/c",
    pushed_at: "2026-09-01T00:00:00Z",
  },
];

// bytes per language for each repo, as returned by GET /repos/{owner}/{repo}/languages
const repoLangs = new Map<string, Record<string, number>>([
  ["a", { Python: 300, HTML: 100 }],
  ["b", { Python: 9999 }],
  ["c", { PHP: 200, HTML: 50 }],
]);

describe("aggregate", () => {
  const s = aggregate(user, repos, repoLangs);
  it("copies profile counts", () => {
    expect(s).toMatchObject({ login: "u", repos: 3, followers: 6 });
  });
  it("excludes forks from stars, languages and top repos", () => {
    expect(s.stars).toBe(58);
    expect(s.topRepos.map((r) => r.name)).toEqual(["a", "c"]);
  });
  it("sums language bytes across own repos, largest first, forks excluded", () => {
    expect(s.languages).toEqual([
      { name: "Python", bytes: 300 },
      { name: "PHP", bytes: 200 },
      { name: "HTML", bytes: 150 },
    ]);
  });
  it("tolerates repos with no language data", () => {
    expect(aggregate(user, repos, new Map()).languages).toEqual([]);
    expect(s.topRepos.map((r) => r.name)).toEqual(["a", "c"]);
  });
  it("lists recent pushes newest first, including forks", () => {
    expect(s.recent.map((r) => r.repo)).toEqual(["b", "a", "c"]);
  });
});
