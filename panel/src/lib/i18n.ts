import en from "../locales/en.json";
import ro from "../locales/ro.json";

export type Locale = "en" | "ro";

const dictionaries: Record<Locale, any> = { en, ro };

export function getDictionary(locale: Locale = "en") {
  return dictionaries[locale] || dictionaries.en;
}

/**
 * Returns a translated string given a dot-notated key (e.g. 'nav.home').
 * Supports variable interpolation: {variable}.
 */
export function t(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const lookup = (language: Locale): unknown => key.split(".").reduce<unknown>((value, part) =>
    value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, part)
      ? (value as Record<string, unknown>)[part] : undefined, dictionaries[language]);
  const primary = lookup(locale);
  const strict = process.env.I18N_STRICT === "1" || process.env.NEXT_PUBLIC_I18N_STRICT === "1";
  const context = `[i18n] locale=${locale} key=${key}`;
  if (strict && (typeof primary !== "string" || !primary.trim())) {
    throw new Error(`${context}: missing translation`);
  }
  const value = typeof primary === "string" && primary.trim() ? primary : lookup("en");
  if (typeof value !== "string" || !value.trim()) {
    console.error(`${context}: missing translation`);
    const readable = key.split(".").pop()?.replace(/_/g, " ") || "";
    return readable.charAt(0).toUpperCase() + readable.slice(1);
  }
  return value.replace(/\{(\w+)\}/g, (token, name: string) => {
    if (params && Object.prototype.hasOwnProperty.call(params, name)) return String(params[name]);
    if (strict) throw new Error(`${context}: missing parameter {${name}}`);
    return token;
  });
}

/**
 * Formats currency in SA:MP / FiveM format: $1,250,000.
 */
export function formatCurrency(amount: number): string {
  return `$${new Intl.NumberFormat("en-US").format(amount || 0)}`;
}

/**
 * Formats a regular number with thousands separators.
 */
export function formatNumber(num: number, locale: Locale = "en"): string {
  return new Intl.NumberFormat(locale === "ro" ? "ro-RO" : "en-US").format(num || 0);
}

/**
 * Formats dates consistently in UTC or viewer locale.
 */
export function formatDate(
  dateInput: string | number | Date | null | undefined,
  locale: Locale = "en",
  includeTime = true
): string {
  if (!dateInput) return "N/A";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "N/A";

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {}),
  };

  return new Intl.DateTimeFormat(locale === "ro" ? "ro-RO" : "en-US", options).format(d);
}

/**
 * Calculates human-readable relative time (e.g. '5 minutes ago', 'in 2 days').
 */
export function formatRelativeTime(
  dateInput: string | number | Date,
  locale: Locale = "en"
): string {
  const d = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale === "ro" ? "ro" : "en", {
    numeric: "auto",
  });

  const absSec = Math.abs(diffSec);
  if (absSec < 60) return rtf.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHours = Math.round(diffMin / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
}
