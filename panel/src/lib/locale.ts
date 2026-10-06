import type { Locale } from "./i18n";

export type PanelLocale = Locale;

/** Validates raw cookie/DB values; returns null if not a supported panel locale. */
export function parsePanelLocale(value: string | null | undefined): PanelLocale | null {
  if (value === "en" || value === "ro") return value;
  return null;
}

/**
 * Single source of truth for viewer locale resolution (pure, testable).
 * Authenticated: account language only. Anonymous: cookie, then EN.
 */
export function resolveViewerLocale(
  sessionLanguage: string | null | undefined,
  cookieLanguage: string | null | undefined
): PanelLocale {
  const account = parsePanelLocale(sessionLanguage);
  if (account) return account;

  const cookie = parsePanelLocale(cookieLanguage);
  if (cookie) return cookie;

  return "en";
}

export const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
