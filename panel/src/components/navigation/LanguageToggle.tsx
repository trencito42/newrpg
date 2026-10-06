"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE_NAME } from "@/lib/constants";
import { LOCALE_COOKIE_MAX_AGE_SECONDS } from "@/lib/locale";
import { cn } from "@/lib/utils";
import { useViewerLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

export function LanguageToggle({
  currentLocale,
  isAuthenticated,
}: {
  currentLocale: "en" | "ro";
  isAuthenticated: boolean;
}) {
  const locale = useViewerLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const setAnonymousCookie = (newLocale: "en" | "ro") => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  };

  const handleToggle = async (newLocale: "en" | "ro") => {
    if (newLocale === currentLocale || isPending) return;
    setFailed(false);

    if (isAuthenticated) {
      try {
        const res = await fetch("/api/account/language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: newLocale }),
        });
        if (!res.ok) {
          setFailed(true);
          return;
        }
        setAnonymousCookie(newLocale);
      } catch {
        setFailed(true);
        return;
      }
    } else {
      setAnonymousCookie(newLocale);
    }

    startTransition(() => {
      router.refresh();
    });
  };

  const activeClass = "bg-brand text-[#08080A]";
  const inactiveClass = "text-[#8F8B83] hover:text-[#F2EFE8]";

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center bg-surface-200 rounded-lg p-0.5 text-xs">
        <button
          type="button"
          onClick={() => handleToggle("en")}
          disabled={isPending}
          aria-pressed={currentLocale === "en"}
          className={cn(
            "px-2 py-0.5 rounded-sm text-[10px] font-extrabold tracking-[0.04em] transition-colors disabled:opacity-50",
            currentLocale === "en" ? activeClass : inactiveClass
          )}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => handleToggle("ro")}
          disabled={isPending}
          aria-pressed={currentLocale === "ro"}
          className={cn(
            "px-2 py-0.5 rounded-sm text-[10px] font-extrabold tracking-[0.04em] transition-colors disabled:opacity-50",
            currentLocale === "ro" ? activeClass : inactiveClass
          )}
        >
          RO
        </button>
      </div>
      {failed ? (
        <span className="text-[9px] text-red-400 max-w-[120px] text-right" role="alert">
          {t(locale, "common.error")}
        </span>
      ) : null}
    </div>
  );
}
