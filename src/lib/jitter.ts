// Small visual drift around a real percentage so live bars do not look frozen between reports.
// The real value is always the centre; the offset is a whole number within ±amp.

/** Random whole-number offset in [-amp, amp]. */
export function nextOffset(
  amp: number,
  rand: () => number = Math.random,
): number {
  return Math.floor(rand() * (2 * amp + 1)) - amp;
}

/** Real value plus offset, kept within 0..100. */
export const drifted = (real: number, offset: number) =>
  Math.min(100, Math.max(0, real + offset));

/** Wait 3 to 8 seconds before the next change, so bars move at different, calm times. */
export const nextDelay = (rand: () => number = Math.random) =>
  3000 + Math.floor(rand() * 5000);
