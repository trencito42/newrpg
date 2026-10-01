"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function LanguageToggle({ currentLocale }: { currentLocale: "en" | "ro" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleToggle = (newLocale: "en" | "ro") => {
    if (newLocale === currentLocale) return;

    document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="flex items-center bg-surface-200 border border-surface-border rounded p-0.5 text-xs">
      <button
        onClick={() => handleToggle("en")}
        disabled={isPending}
        className={cn(
          "px-2 py-0.5 rounded text-[11px] font-semibold transition-colors",
          currentLocale === "en"
            ? "bg-[#2a2a2e] text-[#f1f1f1]"
            : "text-[#6f6f74] hover:text-[#f1f1f1]"
        )}
      >
        EN
      </button>
      <button
        onClick={() => handleToggle("ro")}
        disabled={isPending}
        className={cn(
          "px-2 py-0.5 rounded text-[11px] font-semibold transition-colors",
          currentLocale === "ro"
            ? "bg-[#2a2a2e] text-[#f1f1f1]"
            : "text-[#6f6f74] hover:text-[#f1f1f1]"
        )}
      >
        RO
      </button>
    </div>
  );
}
