import type { Status } from "@easy-job/shared";
import { format, formatDistanceStrict, formatDuration, intervalToDuration, isToday, isYesterday, type Locale } from "date-fns";
import { enGB } from "date-fns/locale";

export function statusText(status: Status): string {
  if (status === "blocked") return "needs you";
  return status;
}

export function statusColor(status: Status): string {
  if (status === "blocked") return "var(--needs)";
  if (status === "working") return "var(--working)";
  if (status === "done") return "var(--done)";
  if (status === "idle") return "var(--idle)";
  return "var(--unknown)";
}

/** enGB with one-letter units ("4h 53m", "3d", "now"): the pixel UI's columns are narrow. */
const SHORT_UNITS: Record<string, string> = {
  lessThanXSeconds: "now", xSeconds: "{{count}}s", halfAMinute: "30s", lessThanXMinutes: "{{count}}m", xMinutes: "{{count}}m",
  aboutXHours: "{{count}}h", xHours: "{{count}}h", xDays: "{{count}}d", aboutXWeeks: "{{count}}w", xWeeks: "{{count}}w",
  aboutXMonths: "{{count}}mo", xMonths: "{{count}}mo", aboutXYears: "{{count}}y", xYears: "{{count}}y", overXYears: "{{count}}y", almostXYears: "{{count}}y",
};
const short: Locale = { ...enGB, formatDistance: (token, count) => (SHORT_UNITS[token] ?? "{{count}}").replace("{{count}}", String(count)) };

/** A span as "4h 53m" (or "2d 3h" past a day, "5d" past two). */
function span(start: number, end: number): string {
  const duration = intervalToDuration({ start, end: Math.max(start, end) });
  const days = (duration.days ?? 0) + (duration.months ?? 0) * 30;
  if (days >= 2) return `${days}d`;
  const parts = days ? { days, hours: duration.hours } : { hours: duration.hours, minutes: duration.minutes };
  return formatDuration(parts, { locale: short, delimiter: " " }) || "0m";
}

/** Clock time, 24-hour. */
export const clock = (at: number | Date, seconds = false) => format(at, seconds ? "HH:mm:ss" : "HH:mm");
/** "Today", "Yesterday", else "Thu 30 Oct". */
export const dayLabel = (at: number) => (isToday(at) ? "Today" : isYesterday(at) ? "Yesterday" : format(at, "EEE d MMM"));
/** How long ago, one unit: "12m", "30h", "3d". */
export const ago = (at: number, now = Date.now()) => formatDistanceStrict(at, Math.max(at, now), { locale: short, roundingMethod: "floor" });
/** Time left until a reset: "4h 53m". */
export const until = (at?: number, now = Date.now()) => (at ? span(now, at) : "");

/** How long an Agent has waited: "just now", "12m", "1h 5m" (compact: "now", "12m", "1h"). */
export function waiting(since?: number, now = Date.now(), compact = false): string {
  if (!since) return "";
  if (now - since < 60_000) return compact ? "now" : "just now";
  return compact ? ago(since, now) : span(since, now);
}

/** "claude-opus-5-5" → "Opus 5.5", "gpt-5.1-codex" → "GPT-5.1 Codex"; unknown models pass through. */
export function modelName(model?: string, kind?: string): string {
  if (!model) return kind === "codex" ? "Codex" : kind === "cursor" ? "Cursor" : kind ? kind[0]?.toUpperCase() + kind.slice(1) : "";
  const lower = model.toLowerCase();
  const claude = lower.match(/(opus|sonnet|haiku|fable)-(\d+)(?:-(\d+))?/);
  if (claude) return `${(claude[1] ?? "").replace(/^./, (c) => c.toUpperCase())} ${claude[2]}${claude[3] ? `.${claude[3]}` : ""}`;
  const gpt = lower.match(/gpt-?([\d.]+)(-codex)?/);
  if (gpt) return `GPT-${gpt[1]}${gpt[2] ? " Codex" : ""}`;
  return model;
}
