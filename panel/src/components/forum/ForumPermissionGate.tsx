"use client";
import { t, type Locale } from "@/lib/i18n";

import Link from "next/link";
import { Lock, LogIn, ShieldOff } from "lucide-react";

type Reason = "unauthenticated" | "private" | "locked" | "faction" | "clan";

interface ForumPermissionGateProps {
  reason: Reason;
  locale?: "en" | "ro";
}

const messages: Record<Reason, { en: string; ro: string; icon: React.ComponentType<{ className?: string }> }> = {
  unauthenticated: {
    en: "You must be logged in to view this forum.",
    ro: "Trebuie să fii autentificat pentru a vedea acest forum.",
    icon: LogIn,
  },
  private: {
    en: "This is a private forum. You do not have access.",
    ro: "Acesta este un forum privat. Nu ai acces.",
    icon: ShieldOff,
  },
  locked: {
    en: "This forum is currently locked. No new topics can be created.",
    ro: "Acest forum este blocat momentan. Nu se pot crea topice noi.",
    icon: Lock,
  },
  faction: {
    en: "This forum is restricted to members of a specific faction.",
    ro: "Acest forum este restricționat membrilor unei facțiuni specifice.",
    icon: ShieldOff,
  },
  clan: {
    en: "This forum is restricted to clan members.",
    ro: "Acest forum este restricționat membrilor de clan.",
    icon: ShieldOff,
  },
};

export function ForumPermissionGate({ reason, locale = "en" }: ForumPermissionGateProps) {
  const { en, ro, icon: Icon } = messages[reason];
  const message = locale === "ro" ? ro : en;

  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <Icon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {reason === "unauthenticated" && (
        <Link
          href="/account/login"
          className="inline-block mt-4 px-4 py-2 bg-brand text-[#08080A] text-xs font-extrabold uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity"
        >
          {t(locale, "forumUi.log_in")}
        </Link>
      )}
    </div>
  );
}
