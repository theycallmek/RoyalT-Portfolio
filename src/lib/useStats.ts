import { useEffect, useState } from "react";
import type { StatsResponse } from "../../server/types.ts";

export type StatsState = {
  status: "loading" | "ready" | "error";
  resp?: StatsResponse;
};

// One module-level fetch of /api/stats shared by every island on the page.
// 60 s: homelab agents report every minute, so bars follow real changes (the service serves cached data).
const EVERY_MS = 60 * 1000;
let state: StatsState = { status: "loading" };
const listeners = new Set<(s: StatsState) => void>();
let ctrl: AbortController | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

function set(next: StatsState) {
  state = next;
  for (const l of listeners) l(state);
}

async function load() {
  if (ctrl) return; // a request is already in flight
  const own = new AbortController();
  ctrl = own;
  try {
    const res = await fetch("/api/stats", { signal: own.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    set({ status: "ready", resp: (await res.json()) as StatsResponse });
  } catch {
    // aborted: nobody is listening; otherwise a failed refresh keeps previous data
    if (!own.signal.aborted && !state.resp) set({ status: "error" });
  } finally {
    if (ctrl === own) ctrl = undefined;
  }
}

export function useStats(): StatsState {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    if (listeners.size === 1) {
      void load();
      timer = setInterval(load, EVERY_MS);
    }
    return () => {
      listeners.delete(setS);
      if (listeners.size > 0) return;
      clearInterval(timer);
      ctrl?.abort();
      ctrl = undefined;
    };
  }, []);
  return s;
}
