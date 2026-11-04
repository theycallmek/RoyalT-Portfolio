import type { ReactNode } from "react";
import type { Source } from "../../../server/types.ts";
import { ago } from "../../lib/time";
import { useStats } from "../../lib/useStats";
import MetricIcon from "../ui/MetricIcon";
import LanguageBars from "./LanguageBars";

// Markup mirrors src/components/ui/{Grid,Cell,Row}.astro (React islands cannot use Astro components),
// except that 3 columns stay 3 on mobile here (short stat numbers fit).
const colClass = {
  1: "grid-cols-1",
  2: "grid-cols-1 lg:grid-cols-2",
  3: "grid-cols-3",
  cards: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  nodes: "grid-cols-1 md:grid-cols-3",
};

export function Grid({
  label,
  cols,
  children,
}: {
  label?: string;
  cols: keyof typeof colClass;
  children: ReactNode;
}) {
  // no scroll fade: live data re-renders these, which would restart it mid-screen
  return (
    <section className="mb-10" aria-label={label}>
      {label && <h4 className="label mb-2">{label}</h4>}
      <div className={`grid border-l border-t border-rule ${colClass[cols]}`}>
        {children}
      </div>
    </section>
  );
}

export function Cell({
  span = false,
  pad = true,
  children,
}: {
  span?: boolean;
  pad?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`border-b border-r border-rule${pad ? " p-4" : ""}${span ? " col-span-full" : ""}`}
    >
      {children}
    </div>
  );
}

function Row({
  n,
  href,
  meta,
  edge,
  children,
}: {
  n: number;
  href: string;
  meta: ReactNode;
  edge: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      rel="noopener noreferrer"
      target="_blank"
      className={`row flex items-baseline gap-4 border-b border-rule px-4 py-3 ${edge}`}
    >
      <span className="label w-6 shrink-0">{String(n).padStart(2, "0")}</span>
      <div className="min-w-0 flex-1">{children}</div>
      <span className="label shrink-0">{meta}</span>
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}

// Loading skeleton mirrors the loaded markup line for line (same classes, transparent text on a
// rule-coloured block), so the section keeps its height when data arrives: no layout shift.
export const Ghost = ({ text }: { text: string }) => (
  <span className="bg-rule text-transparent">{text}</span>
);

function GhostRow({
  n,
  twoLine,
  edge,
}: {
  n: number;
  twoLine: boolean;
  edge: string;
}) {
  return (
    <div
      className={`row flex items-baseline gap-4 border-b border-rule px-4 py-3 ${edge}`}
    >
      <span className="label w-6 shrink-0">{String(n).padStart(2, "0")}</span>
      <div className="min-w-0 flex-1">
        <span className="block font-bold">
          <Ghost text="loading-repository" />
        </span>
        {twoLine && (
          <span className="block text-sm text-dim">
            <Ghost text="Language" />
          </span>
        )}
      </div>
    </div>
  );
}

// "updated …" line plus a stale badge when the last refresh failed (data is the last good copy).
export function SourceStatus({ source }: { source: Source<unknown> }) {
  return (
    <Cell span>
      <p className="label flex flex-wrap items-center gap-3">
        {source.fetchedAt && <span>updated {ago(source.fetchedAt)}</span>}
        {source.error && (
          <>
            <span className="border border-[var(--accent)] px-1 text-accent">
              stale
            </span>
            <span>{source.error}</span>
          </>
        )}
      </p>
    </Cell>
  );
}

const FIVE = [1, 2, 3, 4, 5];

export default function GitHubSections({ profileUrl }: { profileUrl: string }) {
  const state = useStats();

  if (state.status === "loading") {
    return (
      <div aria-busy="true">
        <Grid cols={3}>
          {["Stars", "Repos", "Followers"].map((l) => (
            <Cell key={l}>
              <p className="label">{l}</p>
              <p className="mt-1 flex flex-col items-start gap-1 text-2xl font-bold sm:flex-row sm:items-center sm:gap-3 sm:text-4xl">
                <MetricIcon label={l} />
                <Ghost text="00" />
              </p>
            </Cell>
          ))}
          <Cell span>
            <p className="label">loading github data…</p>
          </Cell>
        </Grid>
        <Grid label="Repositories" cols={2}>
          <Cell span>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <p className="label">Languages</p>
              <span className="h-1.5 min-w-32 flex-1 bg-rule" />
            </div>
          </Cell>
          <Cell pad={false}>
            <p className="label border-b border-rule px-4 py-3">Top repos</p>
            {FIVE.map((n) => (
              <GhostRow key={n} n={n} twoLine edge="last:border-b-0" />
            ))}
          </Cell>
          <Cell pad={false}>
            <p className="label border-b border-rule px-4 py-3">
              Recent pushes
            </p>
            {FIVE.map((n) => (
              <GhostRow key={n} n={n} twoLine={false} edge="" />
            ))}
          </Cell>
        </Grid>
      </div>
    );
  }

  const gh = state.resp?.github;
  const data = gh?.data;
  if (!data) {
    return (
      <Grid cols={1}>
        <Cell>
          <p>GitHub data unavailable</p>
          <a
            className="mt-2 inline-block text-accent underline"
            href={profileUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            github.com/theycallmek
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        </Cell>
      </Grid>
    );
  }

  return (
    <>
      <Grid cols={3}>
        {(
          [
            ["Stars", data.stars],
            ["Repos", data.repos],
            ["Followers", data.followers],
          ] as const
        ).map(([label, value]) => (
          <Cell key={label}>
            <p className="label">{label}</p>
            <p className="mt-1 flex flex-col items-start gap-1 text-2xl font-bold sm:flex-row sm:items-center sm:gap-3 sm:text-4xl">
              <MetricIcon label={label} />
              {value}
            </p>
          </Cell>
        ))}
        <SourceStatus source={gh} />
      </Grid>
      <Grid label="Repositories" cols={2}>
        <Cell span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <p className="label">Languages</p>
            <LanguageBars languages={data.languages} />
          </div>
        </Cell>
        <Cell pad={false}>
          <p className="label border-b border-rule px-4 py-3">Top repos</p>
          {data.topRepos.map((r, i) => (
            <Row
              key={r.url}
              n={i + 1}
              href={r.url}
              meta={`★ ${r.stars}`}
              edge="last:border-b-0"
            >
              <span className="block font-bold">{r.name}</span>
              {/* always two lines so rows match the loading skeleton (no layout shift) */}
              <span className="block text-sm text-dim">
                {r.language ?? <span aria-hidden="true">&nbsp;</span>}
              </span>
            </Row>
          ))}
        </Cell>
        <Cell pad={false}>
          <p className="label border-b border-rule px-4 py-3">Recent pushes</p>
          {data.recent.map((r, i) => (
            <Row
              key={r.url + r.pushedAt}
              n={i + 1}
              href={r.url}
              meta={ago(r.pushedAt)}
              edge=""
            >
              <span className="block font-bold">{r.repo}</span>
            </Row>
          ))}
        </Cell>
      </Grid>
    </>
  );
}
