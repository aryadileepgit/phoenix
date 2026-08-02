/**
 * Defensive formatting helpers used across every dataset-pipeline card.
 * Backend responses can be partial or shaped slightly differently while the
 * FastAPI endpoints are still being built out, so nothing here ever assumes
 * a field is present — every function degrades to a safe placeholder
 * instead of throwing.
 */

/** Formats a number with locale separators, or falls back to a placeholder. */
export function safeNumber(value: unknown, fallback = "—"): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : fallback;
}

/** Returns a string as-is, or a placeholder if it's missing/not a string. */
export function safeString(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/** Uppercases a string safely; returns "" if the value isn't a usable string. */
export function safeUpper(value: unknown): string {
  return typeof value === "string" ? value.toUpperCase() : "";
}

/** Reads a boolean, defaulting to false when missing (renders as the "not ok" state, never crashes). */
export function safeBool(value: unknown): boolean {
  return typeof value === "boolean" ? value : false;
}

/** Reads an array, defaulting to an empty array when missing. */
export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Formats bytes into a human readable size, or a placeholder if unavailable. */
export function safeBytes(bytes: unknown): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Formats an ISO/date-like string into a locale date, or returns the raw value / placeholder. */
export function safeDate(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

/** Formats an ISO/date-like string into just a locale time, or a placeholder. */
export function safeTime(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleTimeString();
}

/** Percentage-safe ratio -> whole number (e.g. 0.8 -> 80), defaulting to 0. */
export function safePercent(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : 0;
}
