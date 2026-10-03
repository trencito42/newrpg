"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n";

const ViewerLocale = createContext<Locale | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <ViewerLocale.Provider value={locale}>{children}</ViewerLocale.Provider>;
}

/** The server layout resolves account/cookie precedence once for client widgets. */
export function useViewerLocale(): Locale {
  const locale = useContext(ViewerLocale);
  if (!locale) throw new Error("LocaleProvider is required");
  return locale;
}
