import { type ReactNode, useState } from "react";
import { Grid } from "./GitHubSections";

export const PAGE = 6; // multiple of 3: no ragged rows in the 3-column grid
// Loaded and skeleton cards share these, so a section keeps its height when data arrives.
export const card = "row block border-b border-r border-rule p-4";
export const titleBox = "mt-3 line-clamp-2 h-[2lh] font-bold";
export const moreBtn =
  "label col-span-full border-b border-r border-rule px-4 py-3 text-center";
const sortBtn =
  "label border-r border-rule px-3 py-2 hover:text-accent aria-pressed:text-accent";

export interface SortDef<T> {
  name: string;
  compare: (a: T, b: T) => number; // keep it total (break ties) so the order is stable
  meta: (item: T) => string; // card meta line, leading with this sort's stat
}

const fmt = new Intl.NumberFormat("en");
export const plural = (n: number, word: string) =>
  `${fmt.format(n)} ${n === 1 ? word : `${word}s`}`;

// A skeleton passes no onSort: same markup, buttons disabled.
export function SortRow({
  label,
  names,
  sort,
  onSort,
  children,
}: {
  label: string;
  names: string[];
  sort: string;
  onSort?: (s: string) => void;
  children?: ReactNode;
}) {
  return (
    <fieldset
      aria-label={label}
      className="col-span-full flex min-w-0 flex-wrap border-b border-r border-rule"
    >
      {names.map((s) => (
        <button
          key={s}
          type="button"
          className={sortBtn}
          aria-pressed={s === sort}
          disabled={!onSort}
          onClick={() => onSort?.(s)}
        >
          {s}
        </button>
      ))}
      {children}
    </fieldset>
  );
}

// Sort row, cards (6 per page, first sort is the default) and "show more".
export default function SortableCards<
  T extends { url: string; title: string },
>({
  label,
  sortLabel,
  items,
  sorts,
  thumb,
}: {
  label: string;
  sortLabel: string;
  items: T[];
  sorts: SortDef<T>[];
  thumb: (item: T) => ReactNode;
}) {
  const [sort, setSort] = useState(sorts[0]);
  const [shown, setShown] = useState(PAGE);
  const list = [...items].sort(sort.compare).slice(0, shown);
  const left = items.length - list.length;

  return (
    <Grid label={label} cols="cards">
      <SortRow
        label={sortLabel}
        names={sorts.map((s) => s.name)}
        sort={sort.name}
        onSort={(name) => {
          setSort(sorts.find((s) => s.name === name) ?? sorts[0]);
          setShown(PAGE);
        }}
      >
        <p className="sr-only" aria-live="polite">
          Sorted by {sort.name}, showing {list.length} of {items.length}
        </p>
      </SortRow>
      {list.map((item) => (
        <a
          key={item.url}
          href={item.url}
          rel="noopener noreferrer"
          target="_blank"
          className={card}
        >
          {thumb(item)}
          <span className={titleBox}>{item.title}</span>
          <span className="label mt-1 block">{sort.meta(item)}</span>
          <span className="sr-only"> (opens in new tab)</span>
        </a>
      ))}
      {left > 0 && (
        <button
          type="button"
          className={`${moreBtn} hover:text-accent`}
          onClick={() => setShown((n) => n + PAGE)}
        >
          show more ({left} left)
        </button>
      )}
    </Grid>
  );
}
