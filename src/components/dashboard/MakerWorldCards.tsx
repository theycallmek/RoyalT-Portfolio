import SortableCards, { plural, type SortDef } from "./SortableCards";

const fmt = new Intl.NumberFormat("en").format;

// Built by MakerWorldSection.astro: the cover is already optimised there (getImage).
export interface Model {
  title: string;
  url: string;
  downloads: number;
  likes: number;
  prints: number;
  published: string;
  img?: { src: string; srcset: string; width: number; height: number };
}

const newest = (a: Model, b: Model) => b.published.localeCompare(a.published);
const dl = (m: Model) => `↓ ${fmt(m.downloads)}`;
const SORTS: SortDef<Model>[] = [
  {
    name: "most downloaded",
    compare: (a, b) => b.downloads - a.downloads || newest(a, b),
    meta: (m) => `${plural(m.downloads, "download")} · ♥ ${fmt(m.likes)}`,
  },
  {
    name: "most liked",
    compare: (a, b) => b.likes - a.likes || newest(a, b),
    meta: (m) => `${plural(m.likes, "like")} · ${dl(m)}`,
  },
  {
    name: "most printed",
    compare: (a, b) => b.prints - a.prints || newest(a, b),
    meta: (m) => `${plural(m.prints, "print")} · ${dl(m)}`,
  },
  {
    name: "newest",
    compare: newest,
    meta: (m) => `${m.published.slice(0, 10)} · ${dl(m)}`,
  },
];

// covers are about 4:3
const thumbBox = "block aspect-[4/3] w-full bg-rule";
const sizes =
  "(min-width: 1024px) 336px, (min-width: 640px) calc(50vw - 56px), calc(100vw - 80px)";

export default function MakerWorldCards({ items }: { items: Model[] }) {
  return (
    <SortableCards
      label="Models"
      sortLabel="Sort models"
      items={items}
      sorts={SORTS}
      thumb={(m) =>
        m.img ? (
          <img
            src={m.img.src}
            srcSet={m.img.srcset}
            sizes={sizes}
            width={m.img.width}
            height={m.img.height}
            alt=""
            loading="lazy"
            decoding="async"
            className={`${thumbBox} object-cover`}
          />
        ) : (
          <span className={thumbBox} />
        )
      }
    />
  );
}
