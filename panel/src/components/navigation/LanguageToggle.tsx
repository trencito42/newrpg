"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";


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
    <div className="flex items-center bg-surface-200 rounded-lg p-0.5 text-xs">
      <button
        onClick={() => handleToggle("en")}
        disabled={isPending}
        className={cn(
          "px-2 py-0.5 rounded-sm text-[10px] font-extrabold tracking-[0.04em] transition-colors",
          t(currentLocale, "copy.components_navigation_languagetoggle.bg_brand_text_08080a")
        )}
      >
        EN
      </button>
      <button
        onClick={() => handleToggle("ro")}
        disabled={isPending}
        className={cn(
          "px-2 py-0.5 rounded-sm text-[10px] font-extrabold tracking-[0.04em] transition-colors",
          t(currentLocale, "copy.components_navigation_languagetoggle.text_8f8b83_hover_text_f2efe8")
        )}
      >
        RO
      </button>
    </div>
  );
}
