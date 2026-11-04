import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../../lib/motion-pref";
import { paletteColor as colorOf } from "../../lib/palette";

// Largest language gets the accent (palette index 0); the rest get the hue-shifted palette colours.
interface Props {
  languages: { name: string; bytes: number }[];
}

export default function LanguageBars({ languages }: Props) {
  const [grown, setGrown] = useState(false);
  const [animate] = useState(() => !prefersReducedMotion());
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const total = languages.reduce((sum, l) => sum + l.bytes, 0) || 1;
  const rows = languages.map((l) => ({
    ...l,
    pct: Math.round((l.bytes / total) * 100),
  }));

  return (
    <>
      {/* reveal with clip-path (paint only) instead of growing widths, so nothing shifts layout */}
      <span
        aria-hidden="true"
        className="flex h-1.5 min-w-32 flex-1 bg-rule"
        style={{
          clipPath: grown || !animate ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
          transition: animate ? "clip-path 600ms ease-out" : undefined,
        }}
      >
        {rows.map((l, i) => (
          <span
            key={l.name}
            className="block h-1.5 [&+&]:ml-0.5"
            style={{
              background: colorOf(i),
              width: `${(l.bytes / total) * 100}%`,
            }}
          />
        ))}
      </span>
      <ul aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1">
        {rows.map((l, i) => (
          <li key={l.name} className="label flex items-center gap-1.5">
            <span className="block size-2" style={{ background: colorOf(i) }} />
            {l.name} {l.pct}%
          </li>
        ))}
      </ul>
      {/* the wrapper clips: a table ignores sr-only's 1px width and widened the page on mobile */}
      <div className="sr-only">
        <table>
          <caption>Languages by code size across own repositories</caption>
          <thead>
            <tr>
              <th scope="col">Language</th>
              <th scope="col">Bytes</th>
              <th scope="col">Percent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.name}>
                <td>{l.name}</td>
                <td>{l.bytes}</td>
                <td>{l.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
