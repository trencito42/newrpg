"use client";

import { useState, type ReactNode } from "react";
import { Locale, t } from "@/lib/i18n";

export function PlayerProfileLayout({
  locale,
  community,
  overview,
  showCommunityOnDesktop = true,
}: {
  locale: Locale;
  community: ReactNode;
  overview: ReactNode;
  showCommunityOnDesktop?: boolean;
}) {
  const [mobileTab, setMobileTab] = useState<"overview" | "activity">("overview");

  return (
    <>
      {/* Desktop: community then overview */}
      <div className="hidden md:block space-y-4 sm:space-y-5">
        {overview}
        {showCommunityOnDesktop && community}
      </div>

      {/* Mobile: Overview | Activity */}
      <div className="md:hidden space-y-3">
        <div className="flex gap-1 p-1 rounded-lg bg-[rgba(255,255,255,0.04)]">
          {(["overview", "activity"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id)}
              className={`flex-1 min-h-[44px] text-xs font-semibold rounded-md transition-colors ${
                mobileTab === id ? "bg-[rgba(215,181,88,0.2)] text-[#d7b558]" : "text-[#8F8B83]"
              }`}
            >
              {id === "overview" ? t(locale, "community.overview") : t(locale, "community.activity_title")}
            </button>
          ))}
        </div>
        {mobileTab === "overview" ? overview : community}
      </div>
    </>
  );
}
