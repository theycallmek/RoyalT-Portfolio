import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Source } from "./types.ts";

export const emptySource = <T>(): Source<T> => ({ data: null, fetchedAt: null, error: null });

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export function applyResult<T>(prev: Source<T>, r: Result<T>, now: string): Source<T> {
  return r.ok
    ? { data: r.data, fetchedAt: now, error: null }
    : { data: prev.data, fetchedAt: prev.fetchedAt, error: r.error };
}

export function loadSource<T>(file: string): Source<T> {
  try {
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Source<T>) : emptySource<T>();
  } catch {
    return emptySource<T>();
  }
}

export function saveSource<T>(file: string, s: Source<T>): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(s));
}
