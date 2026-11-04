import { useEffect, useState } from "react";
import type { HomelabNode } from "../../../server/types.ts";
import { drifted, nextDelay, nextOffset } from "../../lib/jitter";
import { prefersReducedMotion } from "../../lib/motion-pref";
import { paletteColor } from "../../lib/palette";
import { ago } from "../../lib/time";
import { useStats } from "../../lib/useStats";
import { Cell, Ghost, Grid } from "./GitHubSections";

// Each metric keeps one palette colour on every card (same hue-shifted palette as the languages bar);
// the plain accent (index 0) is reserved for the online square.
// The last number is the visual drift (±percentage points) around the real value; disk usage does not
// move second to second on a real machine, so it stays still.
const BARS = [
  ["CPU", "cpu", 1, 2],
  ["MEM", "mem", 2, 1],
  ["DISK", "disk", 3, 0],
] as const;

// Drift a real percentage by a whole number within ±amp every 3-8 s, so the bars look live between
// reports. Re-centres on the real value whenever it changes. Off for amp 0 and reduced motion.
function useDrift(real: number | null, amp: number, active: boolean) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    setOffset(0);
    if (real === null || !active || amp === 0 || prefersReducedMotion()) return;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      setOffset(nextOffset(amp));
      id = setTimeout(tick, nextDelay());
    };
    id = setTimeout(tick, nextDelay());
    return () => clearTimeout(id);
  }, [real, amp, active]);
  return real === null ? null : drifted(real, offset);
}

function Bar({
  label,
  real,
  color,
  amp,
  off,
  loading,
}: {
  label: string;
  real: number | null;
  color: number;
  amp: number;
  off: boolean;
  loading: boolean;
}) {
  const v = useDrift(real, amp, !off);
  return (
    <div className="contents">
      <span className="label">{label}</span>
      <span aria-hidden="true" className="block h-1.5 bg-rule">
        {v !== null && (
          <span
            className={`block h-full transition-[width] duration-700 ease-out ${off ? "bg-dim" : ""}`}
            style={{
              width: `${v}%`,
              ...(off ? {} : { background: paletteColor(color) }),
            }}
          />
        )}
      </span>
      <span className="whitespace-nowrap text-right tabular-nums">
        {loading ? (
          <Ghost text="00%" />
        ) : v === null ? (
          "—"
        ) : (
          <>
            {/* the drifting number is visual; assistive tech gets the real value */}
            <span aria-hidden="true">{v}%</span>
            <span className="sr-only">{real}%</span>
          </>
        )}
      </span>
    </div>
  );
}

// bytes/s (already 2 significant digits server-side) -> "340 KB/s"
function rate(n: number) {
  const [v, unit] =
    n >= 1e6 ? [n / 1e6, "MB/s"] : n >= 1e3 ? [n / 1e3, "KB/s"] : [n, "B/s"];
  return `${Number(v.toPrecision(2))} ${unit}`;
}

// One component for the loaded card and its skeleton (n undefined), so both have the same height.
function NodeCard({ n }: { n?: HomelabNode }) {
  const off = n && !n.online;
  const value = (text: string | null) =>
    n ? (text ?? "—") : <Ghost text="00%" />;
  return (
    <div
      className={`border-b border-r border-rule p-4${off ? " text-dim" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="truncate font-bold">
          {n ? n.label : <Ghost text="loading" />}
        </h4>
        <span className="label shrink-0">
          {n ? n.hw : <Ghost text="x86 laptop" />}
        </span>
      </div>
      <p className="label mt-1 flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`inline-block size-2 shrink-0 ${n?.online ? "bg-accent" : "border border-current"}`}
        />
        {!n ? (
          <Ghost text="up 00d" />
        ) : n.online ? (
          <span>
            <span className="sr-only">online, </span>up {n.uptime}
          </span>
        ) : (
          <span>
            offline · {n.reportedAt ? ago(n.reportedAt) : "no report yet"}
          </span>
        )}
      </p>
      <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 text-sm">
        {BARS.map(([label, key, color, amp]) => (
          <Bar
            key={key}
            label={label}
            real={n?.[key] ?? null}
            color={color}
            amp={amp}
            off={!!off}
            loading={!n}
          />
        ))}
        <span className="label">TEMP</span>
        <span className="col-span-2 whitespace-nowrap text-right tabular-nums">
          {value(n?.temp == null ? null : `${n.temp}°C`)}
        </span>
        <span className="label">NET</span>
        <span className="col-span-2 whitespace-nowrap text-right tabular-nums">
          {!n ? (
            <Ghost text="↑ 00 KB/s ↓ 00 KB/s" />
          ) : n.rx === null || n.tx === null ? (
            "—"
          ) : (
            <>
              <span aria-hidden="true">↑</span>
              <span className="sr-only">upload</span> {rate(n.tx)}{" "}
              <span aria-hidden="true">↓</span>
              <span className="sr-only">download</span> {rate(n.rx)}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

const THREE = [1, 2, 3];

export default function HomelabSection() {
  const state = useStats();

  if (state.status === "loading") {
    return (
      <div aria-busy="true">
        <Grid cols="nodes">
          {THREE.map((k) => (
            <NodeCard key={k} />
          ))}
        </Grid>
      </div>
    );
  }

  // An older stats service without a homelab source counts as unavailable too.
  const nodes = state.resp?.homelab?.data?.nodes;
  if (!nodes?.length) {
    return (
      <Grid cols={1}>
        <Cell>
          <p>Homelab stats unavailable</p>
        </Cell>
      </Grid>
    );
  }

  return (
    <Grid cols="nodes">
      {nodes.map((n) => (
        <NodeCard key={n.id} n={n} />
      ))}
    </Grid>
  );
}
