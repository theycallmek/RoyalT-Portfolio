import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../../lib/motion-pref";
import { scrambleFrame } from "../../lib/scramble";

interface Props {
  text: string;
  as?: "h1" | "h2" | "span";
  className?: string;
  duration?: number;
  /** Optional starting word, shown first and then scrambled into `text` (same length). */
  from?: string;
}

export default function ScrambleText({
  text,
  as: Tag = "span",
  className,
  duration = 700,
  from,
}: Props) {
  // Start on `from` (server render too) so the first paint is already the starting word;
  // reduced motion skips straight to `text`.
  const [display, setDisplay] = useState(from ?? text);
  const raf = useRef(0);

  const run = useCallback(() => {
    if (prefersReducedMotion()) {
      setDisplay(text);
      return;
    }
    cancelAnimationFrame(raf.current);
    const start = performance.now();
    const tick = (now: number) => {
      const p = (now - start) / duration;
      setDisplay(scrambleFrame(text, p, Math.random, from));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [text, duration, from]);

  useEffect(() => {
    run();
    return () => cancelAnimationFrame(raf.current);
  }, [run]);

  return (
    <Tag className={className} onMouseEnter={run}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{display}</span>
    </Tag>
  );
}
