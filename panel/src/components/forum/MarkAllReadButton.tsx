"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";

export function MarkAllReadButton({ locale }: { locale: Locale }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const response = await fetch("/api/forum/mark-all-read", { method: "POST" });
          if (response.ok) router.refresh();
        } finally {
          setPending(false);
        }
      }}
      className="hover:text-foreground transition-colors disabled:opacity-50"
    >
      {pending ? t(locale, "forumUi.marking_read") : t(locale, "forumUi.mark_all_read")}
    </button>
  );
}
