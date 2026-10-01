"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { LOCALE_COOKIE_NAME } from "@/lib/constants";

export function LanguageToggle({ currentLocale }: { currentLocale: "en" | "ro" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleToggle = (newLocale: "en" | "ro") => {
    if (newLocale === currentLocale) return;

    // Set cookie client-side
    document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="flex items-center space-x-1 bg-surface-100 border border-surface-border rounded-lg p-1 text-xs font-medium">
      <Globe className="w-3.5 h-3.5 text-gray-400 ml-1 mr-0.5" />
      <button
        onClick={() => handleToggle("en")}
        disabled={isPending}
        className={`px-2 py-1 rounded transition-colors ${
          currentLocale === "en"
            ? "bg-brand text-gray-950 font-bold"
            : "text-gray-300 hover:text-white"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => handleToggle("ro")}
        disabled={isPending}
        className={`px-2 py-1 rounded transition-colors ${
          currentLocale === "ro"
            ? "bg-brand text-gray-950 font-bold"
            : "text-gray-300 hover:text-white"
        }`}
      >
        RO
      </button>
    </div>
  );
}
