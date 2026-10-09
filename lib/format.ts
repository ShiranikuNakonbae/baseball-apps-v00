// Extension is explicit so `node --test` can load this module without a bundler.
import { CLUB_TIME_ZONE } from "./time.ts";

const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: CLUB_TIME_ZONE, dateStyle: "medium" });
const weekdayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CLUB_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

/** Fixed club timezone so server-rendered times match the client exactly. */
export function clubTimeZone() {
  return CLUB_TIME_ZONE;
}

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

export function formatDay(iso: string) {
  return weekdayFmt.format(new Date(iso)).toUpperCase();
}

export function formatTime(iso: string) {
  return timeFmt.format(new Date(iso));
}

export function formatTimeRange(startIso: string, endIso: string) {
  return `${formatTime(startIso)} – ${formatTime(endIso)}`;
}

/** Baseball notation: .348 not 0.348. Null/zero-at-bat lines render as a dash. */
export function rate(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(3).replace(/^0/, "");
}

export function percent(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${Math.round(n)}%`;
}

export function plain(value: number | string | null | undefined, digits = 2): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(digits).replace(/\.0+$/, "");
}

export function athleteName(a: { first_name: string; last_name: string }) {
  return `${a.first_name} ${a.last_name}`;
}

export function hits(line: { singles: number; doubles: number; triples: number; hr: number }) {
  return line.singles + line.doubles + line.triples + line.hr;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** datetime-local inputs need "YYYY-MM-DDTHH:mm" in club time, not server time. */
export function toDateTimeLocal(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CLUB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = String(Number(get("hour")) % 24).padStart(2, "0");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}
