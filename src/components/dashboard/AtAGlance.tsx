import githubDark from "../../assets/icons/github-dark.svg";
import githubLight from "../../assets/icons/github-light.svg";
import makerworldDark from "../../assets/icons/maker-world-dark.svg";
import makerworldLight from "../../assets/icons/maker-world-light.svg";
import youtube from "../../assets/icons/youtube.svg";
import { useStats } from "../../lib/useStats";
import { Ghost } from "./GitHubSections";

const fmt = new Intl.NumberFormat("en");

// Brand icon on the number's line, sized in em so it matches the number at every breakpoint.
// Dark/light variants swap with the theme via CSS (.only-dark / .only-light in global.css).
// width/height give the intrinsic aspect ratio (no layout shift); CSS sets the rendered size.
type Img = { src: string };
function BrandIcon({
  dark,
  light,
  ratio = 1,
}: {
  dark: Img;
  light?: Img;
  ratio?: number;
}) {
  const size = "h-[0.8em] w-auto shrink-0";
  const w = Math.round(36 * ratio);
  if (!light)
    return <img src={dark.src} alt="" width={w} height={36} className={size} />;
  return (
    <>
      <img
        src={dark.src}
        alt=""
        width={w}
        height={36}
        className={`${size} only-dark`}
      />
      <img
        src={light.src}
        alt=""
        width={w}
        height={36}
        className={`${size} only-light`}
      />
    </>
  );
}

export default function AtAGlance({ models }: { models: number }) {
  const state = useStats();
  const loading = state.status === "loading";
  const cells = [
    {
      href: "#github",
      source: "GitHub",
      icon: <BrandIcon dark={githubDark} light={githubLight} />,
      metric: "stars",
      value: state.resp?.github?.data?.stars,
      live: true,
    },
    {
      href: "#youtube",
      source: "YouTube",
      icon: <BrandIcon dark={youtube} ratio={512 / 358.4} />,
      metric: "subscribers",
      value: state.resp?.youtube?.data?.subscribers, // null when the channel hides it
      live: true,
    },
    {
      href: "#makerworld",
      source: "MakerWorld",
      icon: <BrandIcon dark={makerworldDark} light={makerworldLight} />,
      metric: "models",
      value: models || null, // 0 means not filled in yet
      live: false,
    },
  ];
  return (
    <section aria-label="At a glance" className="mb-20">
      <p className="label mb-2">At a glance</p>
      <div className="grid grid-cols-3 border-l border-t border-rule">
        {cells.map((c) => {
          const pending = loading && c.live;
          const known = !pending && c.value != null;
          // DOM order gives the name "58 GitHub stars" (label in name); order-first puts the
          // platform label on top visually.
          return (
            <a
              key={c.href}
              href={c.href}
              className="row flex flex-col border-b border-r border-rule p-3 sm:p-4"
            >
              <span
                className="mt-1 flex items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-4xl"
                aria-hidden={!known}
              >
                {c.icon}
                {pending ? (
                  <Ghost text="00" />
                ) : known ? (
                  fmt.format(c.value as number)
                ) : (
                  "—"
                )}
              </span>{" "}
              <span className="label order-first block">{c.source}</span>{" "}
              <span className="label block">{c.metric}</span>
              {!known && (
                <span className="sr-only">
                  {" "}
                  {pending ? "loading" : "unavailable"}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
}
