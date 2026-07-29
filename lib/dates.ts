import type { Zoom } from "./types";

// All date math is done in UTC to keep positioning deterministic across timezones.

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function quarterOf(d: Date): number {
  return Math.floor(d.getUTCMonth() / 3) + 1;
}

export function quarterLabel(d: Date): string {
  return `Q${quarterOf(d)} ${d.getUTCFullYear()}`;
}

/** "Q3 2026" from an ISO date string (used for the quarter label field). */
export function quarterLabelFromISO(s: string): string {
  return quarterLabel(parseISO(s));
}

export function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
}

export function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 1));
}

export function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

/** Shift an ISO date string by a whole number of days (used by timeline drag). */
export function shiftISODays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatDateEN(s: string): string {
  const d = parseISO(s);
  return `${MONTHS_FULL[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatShortEN(s: string): string {
  const d = parseISO(s);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export interface TimeWindow {
  start: Date;
  end: Date;
  spanMs: number;
}

/** Build the timeline window from a set of date ranges, padded to quarter edges. */
export function buildWindow(ranges: { start: string; end: string }[]): TimeWindow {
  const now = new Date();
  let min = startOfQuarter(now);
  let max = endOfQuarter(now);
  for (const r of ranges) {
    const s = parseISO(r.start);
    const e = parseISO(r.end);
    if (s < min) min = s;
    if (e > max) max = e;
  }
  const start = startOfQuarter(min);
  const end = endOfQuarter(max);
  return { start, end, spanMs: end.getTime() - start.getTime() };
}

export interface Column {
  key: string;
  label: string;
  sublabel?: string;
  leftPct: number;
  widthPct: number;
  isQuarterStart?: boolean;
}

function pct(a: Date, b: Date, w: TimeWindow): { leftPct: number; widthPct: number } {
  const leftPct = ((a.getTime() - w.start.getTime()) / w.spanMs) * 100;
  const widthPct = ((b.getTime() - a.getTime()) / w.spanMs) * 100;
  return { leftPct, widthPct };
}

/** Column headers for a given zoom level. */
export function buildColumns(w: TimeWindow, zoom: Zoom): Column[] {
  const cols: Column[] = [];
  if (zoom === "month") {
    let cur = new Date(w.start);
    while (cur < w.end) {
      const next = addMonths(cur, 1);
      const p = pct(cur, next, w);
      cols.push({
        key: toISODate(cur),
        label: MONTHS[cur.getUTCMonth()],
        sublabel: cur.getUTCMonth() % 3 === 0 ? quarterLabel(cur) : undefined,
        isQuarterStart: cur.getUTCMonth() % 3 === 0,
        ...p,
      });
      cur = next;
    }
  } else if (zoom === "quarter") {
    let cur = startOfQuarter(w.start);
    while (cur < w.end) {
      const next = addMonths(cur, 3);
      const p = pct(cur, next, w);
      cols.push({
        key: toISODate(cur),
        label: `Q${quarterOf(cur)}`,
        sublabel: `${cur.getUTCFullYear()}`,
        isQuarterStart: true,
        ...p,
      });
      cur = next;
    }
  } else {
    // half-year
    let cur = new Date(Date.UTC(w.start.getUTCFullYear(), w.start.getUTCMonth() < 6 ? 0 : 6, 1));
    while (cur < w.end) {
      const isH1 = cur.getUTCMonth() < 6;
      const next = addMonths(cur, 6);
      const p = pct(cur, next, w);
      cols.push({
        key: toISODate(cur),
        label: isH1 ? "H1" : "H2",
        sublabel: `${cur.getUTCFullYear()}`,
        isQuarterStart: true,
        ...p,
      });
      cur = next;
    }
  }
  return cols;
}

/** Bar position for an initiative within the window. */
export function barPosition(start: string, end: string, w: TimeWindow) {
  const s = parseISO(start);
  const e = parseISO(end);
  const clampedStart = s < w.start ? w.start : s;
  const clampedEnd = e > w.end ? w.end : e;
  return pct(clampedStart, clampedEnd, w);
}

/** Left offset (%) of "today" within the window, or null if out of range. */
export function todayMarker(w: TimeWindow): number | null {
  const t = new Date();
  if (t < w.start || t > w.end) return null;
  return ((t.getTime() - w.start.getTime()) / w.spanMs) * 100;
}
