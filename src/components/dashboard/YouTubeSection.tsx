import type { ReactNode } from "react";
import type { YouTubeVideo } from "../../../server/types.ts";
import { useStats } from "../../lib/useStats";
import MetricIcon from "../ui/MetricIcon";
import { Cell, Ghost, Grid, SourceStatus } from "./GitHubSections";
import SortableCards, {
  card,
  moreBtn,
  plural,
  type SortDef,
  SortRow,
  titleBox,
} from "./SortableCards";

const CHANNEL_URL = "https://www.youtube.com/@royalt9863";
const fmt = new Intl.NumberFormat("en");
const SIX = [1, 2, 3, 4, 5, 6];
const LABELS = ["Subscribers", "Views", "Videos"];

const newest = (a: YouTubeVideo, b: YouTubeVideo) =>
  b.publishedAt.localeCompare(a.publishedAt);
const date = (v: YouTubeVideo) => v.publishedAt.slice(0, 10);
const SORTS: SortDef<YouTubeVideo>[] = [
  {
    name: "most viewed",
    compare: (a, b) => b.views - a.views || newest(a, b),
    meta: (v) => `${plural(v.views, "view")} · ${date(v)}`,
  },
  {
    name: "newest",
    compare: newest,
    meta: (v) => `${date(v)} · ${plural(v.views, "view")}`,
  },
  {
    name: "most liked",
    compare: (a, b) => b.likes - a.likes || newest(a, b),
    meta: (v) => `${plural(v.likes, "like")} · ${date(v)}`,
  },
];
const SORT_NAMES = SORTS.map((s) => s.name);

const thumbBox = "block aspect-video w-full bg-rule";

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Cell>
      <p className="label">{label}</p>
      <p className="mt-1 flex flex-col items-start gap-1 text-xl font-bold sm:flex-row sm:items-center sm:gap-3 sm:text-4xl">
        <MetricIcon label={label} />
        {children}
      </p>
    </Cell>
  );
}

export default function YouTubeSection() {
  const state = useStats();

  if (state.status === "loading") {
    return (
      <div aria-busy="true">
        <Grid cols={3}>
          {LABELS.map((l) => (
            <Stat key={l} label={l}>
              <Ghost text="00" />
            </Stat>
          ))}
          <Cell span>
            <p className="label">loading youtube data…</p>
          </Cell>
        </Grid>
        <Grid label="Videos" cols="cards">
          <SortRow
            label="Sort videos"
            names={SORT_NAMES}
            sort={SORT_NAMES[0]}
          />
          {SIX.map((n) => (
            <div key={n} className={card}>
              <span className={thumbBox} />
              <span className={titleBox}>
                <Ghost text="loading video title" />
              </span>
              <span className="label mt-1 block">
                <Ghost text="0 views · 0000-00-00" />
              </span>
            </div>
          ))}
          <div className={moreBtn}>
            <Ghost text="show more (00 left)" />
          </div>
        </Grid>
      </div>
    );
  }

  // A response without a youtube source (older service) counts as unavailable.
  const yt = state.resp?.youtube;
  const data = yt?.data;
  if (!data) {
    return (
      <Grid cols={1}>
        <Cell>
          <p>YouTube data unavailable</p>
          <a
            className="mt-2 inline-block text-accent underline"
            href={CHANNEL_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            youtube.com/@royalt9863
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        </Cell>
      </Grid>
    );
  }

  // A cache written before the all-videos change has `videos: number` and `latest`: no grid until the next refresh.
  const all = Array.isArray(data.videos) ? data.videos : [];

  return (
    <>
      <Grid cols={3}>
        <Stat label="Subscribers">
          {data.subscribers === null ? "hidden" : fmt.format(data.subscribers)}
        </Stat>
        <Stat label="Views">{fmt.format(data.views)}</Stat>
        <Stat label="Videos">
          {typeof data.videoCount === "number"
            ? fmt.format(data.videoCount)
            : "—"}
        </Stat>
        <SourceStatus source={yt} />
      </Grid>
      {all.length > 0 && (
        <SortableCards
          label="Videos"
          sortLabel="Sort videos"
          items={all}
          sorts={SORTS}
          thumb={(v) => (
            <img
              src={v.thumbnail}
              alt=""
              width="320"
              height="180"
              loading="lazy"
              decoding="async"
              className={`${thumbBox} object-cover`}
            />
          )}
        />
      )}
    </>
  );
}
