"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "overview", labelKey: "playerManagement.tab_overview" },
  { id: "inventory", labelKey: "playerManagement.tab_inventory" },
  { id: "moderation", labelKey: "playerManagement.tab_moderation" },
  { id: "activity", labelKey: "playerManagement.tab_activity" },
  { id: "chat_logs", labelKey: "playerManagement.tab_chat_logs" },
] as const;

export type StaffPlayerTabId = (typeof TABS)[number]["id"];

export function StaffPlayerProfileTabs({
  locale,
  children,
  chatLogsPanel,
}: {
  locale: Locale;
  children: ReactNode;
  chatLogsPanel?: ReactNode;
}) {
  const params = useSearchParams();
  const tab = (params.get("tab") as StaffPlayerTabId) || "overview";
  const active = TABS.some((x) => x.id === tab) ? tab : "overview";

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-lg bg-[rgba(255,255,255,0.04)] overflow-x-auto">
        {TABS.map(({ id, labelKey }) => (
          <a
            key={id}
            href={`?tab=${id}`}
            className={cn(
              "shrink-0 px-3 min-h-[40px] flex items-center text-[11px] font-semibold rounded-md transition-colors",
              active === id ? "bg-[rgba(215,181,88,0.2)] text-[#d7b558]" : "text-[#8F8B83] hover:text-[#F2EFE8]"
            )}
          >
            {t(locale, labelKey)}
          </a>
        ))}
      </div>
      {active === "chat_logs" ? (
        chatLogsPanel || (
          <div className="p-6 rounded-xl border border-surface-border bg-[#0E0E10] text-sm text-[#8F8B83]">
            {t(locale, "playerManagement.chat_logs_placeholder")}
          </div>
        )
      ) : (
        children
      )}
    </div>
  );
}
