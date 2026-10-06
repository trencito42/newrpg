import { t, type Locale } from "@/lib/i18n";

export type ForumLocale = "en" | "ro";

/** Normalize forum timestamp payloads to epoch seconds. */
export function toEpochSeconds(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 1e12) return Math.floor(value / 1000);
    if (value > 1e9) return Math.floor(value);
    return null;
  }
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n > 1e12) return Math.floor(n / 1000);
    if (n > 1e9) return Math.floor(n);
    return null;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

export function formatForumClock(value: unknown, locale: ForumLocale = "en"): string {
  const sec = toEpochSeconds(value);
  if (sec == null) return "--";
  const d = new Date(sec * 1000);
  return d.toLocaleTimeString(locale === "ro" ? "ro-RO" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function dayKey(sec: number): string {
  const d = new Date(sec * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatForumDaySeparator(value: unknown, locale: ForumLocale): string | null {
  const sec = toEpochSeconds(value);
  if (sec == null) return null;
  const now = new Date();
  const todayKey = dayKey(Math.floor(now.getTime() / 1000));
  const yesterdayKey = dayKey(Math.floor(now.getTime() / 1000) - 86400);
  const key = dayKey(sec);
  const lang = locale as Locale;
  if (key === todayKey) return t(lang, "forumUi.today");
  if (key === yesterdayKey) return t(lang, "forumUi.yesterday");
  const d = new Date(sec * 1000);
  return d.toLocaleDateString(locale === "ro" ? "ro-RO" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
