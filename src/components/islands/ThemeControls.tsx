import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  ACCENTS,
  type Accent,
  type Mode,
  resolveAccent,
  resolveMode,
} from "../../lib/theme";

export default function ThemeControls() {
  const [mode, setMode] = useState<Mode>("dark");
  const [accent, setAccent] = useState<Accent>("green");
  // Server renders the hover variant; the real value is read after mount to avoid a hydration mismatch.
  const [touch, setTouch] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    setMode(resolveMode(root.dataset.mode ?? null, null));
    setAccent(resolveAccent(root.dataset.accent ?? null));
    const mq = matchMedia("(hover: hover)");
    const sync = () => setTouch(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      toggleRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("astro:after-swap", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("astro:after-swap", close);
    };
  }, [open]);

  function pickAccent(a: Accent) {
    setAccent(a);
    document.documentElement.dataset.accent = a;
    localStorage.setItem("accent", a);
  }
  function toggleMode() {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.dataset.mode = next;
    localStorage.setItem("mode", next);
  }
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next =
      ACCENTS[
        (ACCENTS.indexOf(accent) + step + ACCENTS.length) % ACCENTS.length
      ];
    pickAccent(next);
    (
      e.currentTarget.querySelector(
        `[data-accent="${next}"]`,
      ) as HTMLElement | null
    )?.focus();
  }

  const swatches = (className: string, size: string) => (
    <div
      role="radiogroup"
      aria-label="Accent color"
      className={`flex ${className}`}
      onKeyDown={onKey}
    >
      {ACCENTS.map((a) => (
        // biome-ignore lint/a11y/useSemanticElements: ARIA radio pattern on buttons, used as colour swatches with roving tabindex
        <button
          key={a}
          type="button"
          role="radio"
          aria-checked={accent === a}
          aria-label={`${a} accent`}
          data-accent={a}
          tabIndex={accent === a ? 0 : -1}
          onClick={() => pickAccent(a)}
          className={`${size} outline-offset-2 aria-checked:outline aria-checked:outline-1 aria-checked:outline-[var(--fg)]`}
          style={{ background: `var(--a-${a})` }}
        />
      ))}
    </div>
  );

  if (touch) {
    return (
      <div ref={rootRef}>
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="theme-panel"
          aria-label="Theme settings"
          className="-m-2 p-2 text-sm text-dim hover:text-fg"
        >
          ◐
        </button>
        <fieldset
          id="theme-panel"
          aria-label="Theme"
          hidden={!open}
          className="absolute inset-x-0 top-full border-b border-rule bg-bg"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
            <button
              type="button"
              onClick={toggleMode}
              aria-pressed={mode === "dark"}
              className="label py-2 hover:text-fg aria-pressed:text-fg"
            >
              Dark mode
            </button>
            {swatches("gap-3 p-1", "size-6")}
          </div>
        </fieldset>
      </div>
    );
  }

  return (
    <div className="group flex items-center">
      {/* collapsed until hover/focus; padding (when open) leaves room for the focus outline inside overflow-hidden */}
      {swatches(
        "gap-1.5 max-w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:mr-2 group-hover:max-w-24 group-hover:p-1.5 group-hover:opacity-100 group-focus-within:mr-2 group-focus-within:max-w-24 group-focus-within:p-1.5 group-focus-within:opacity-100",
        "size-3 shrink-0",
      )}
      <button
        type="button"
        onClick={toggleMode}
        aria-pressed={mode === "dark"}
        aria-label="Dark mode"
        className="text-sm text-dim hover:text-fg"
      >
        ◐
      </button>
    </div>
  );
}
