// Accent-derived palette: the accent with its hue rotated, so every colour follows the visitor's
// accent choice. Index 0 is the accent itself. Needs CSS relative colour syntax (all current browsers).
export const HUE_STEPS = [0, 55, -55, 110, -110, 165];

export const paletteColor = (index: number) =>
  `oklch(from var(--accent) l c calc(h + ${HUE_STEPS[index % HUE_STEPS.length]}))`;

// For small text (labels, buttons): same hue, slightly darker in light mode (--palette-text-dl in
// global.css) so it still passes WCAG AA 4.5:1 on the light background.
export const paletteText = (index: number) =>
  `oklch(from var(--accent) calc(l + var(--palette-text-dl, 0)) c calc(h + ${HUE_STEPS[index % HUE_STEPS.length]}))`;
