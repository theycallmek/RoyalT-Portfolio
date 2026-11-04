const GLYPHS = "!<>-_/[]{}=+*^?#";

// Fraction of the animation that shows the starting word before scrambling begins.
const HOLD = 0.12;

export function scrambleFrame(
  target: string,
  progress: number,
  rand: () => number = Math.random,
  from?: string,
): string {
  let p = Math.min(1, Math.max(0, progress));
  // Optional starting word (e.g. an anagram): hold it, then scramble into the target.
  if (from && from.length === target.length) {
    if (p <= HOLD) return from;
    p = (p - HOLD) / (1 - HOLD);
  }
  const resolved = Math.floor(p * target.length);
  let out = "";
  for (let i = 0; i < target.length; i++) {
    const ch = target[i];
    if (i < resolved || ch === " ") out += ch;
    else out += GLYPHS[Math.floor(rand() * GLYPHS.length)];
  }
  return out;
}
