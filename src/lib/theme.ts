export const ACCENTS = ["green", "orange", "blue", "pink"] as const;
export type Accent = (typeof ACCENTS)[number];
export type Mode = "dark" | "light";

const isMode = (v: string | null): v is Mode => v === "dark" || v === "light";

export function resolveMode(saved: string | null, system: string | null): Mode {
  if (isMode(saved)) return saved;
  if (isMode(system)) return system;
  return "dark";
}

export function resolveAccent(saved: string | null): Accent {
  return (ACCENTS as readonly string[]).includes(saved ?? "")
    ? (saved as Accent)
    : "green";
}
