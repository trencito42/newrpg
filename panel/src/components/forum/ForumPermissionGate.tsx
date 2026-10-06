"use client";
import { t, type Locale } from "@/lib/i18n";

import Link from "next/link";
import { Lock, LogIn, ShieldOff } from "lucide-react";

type Reason = "unauthenticated" | "private" | "locked" | "faction" | "clan";

interface ForumPermissionGateProps {
  reason: Reason;
  locale?: Locale;
}

const GATE_KEY: Record<Reason, string> = {
  unauthenticated: "forumUi.gate_unauthenticated",
  private: "forumUi.gate_private",
  locked: "forumUi.gate_locked",
  faction: "forumUi.gate_faction",
  clan: "forumUi.gate_clan",
};

const ICON: Record<Reason, React.ComponentType<{ className?: string }>> = {
  unauthenticated: LogIn,
  private: ShieldOff,
  locked: Lock,
  faction: ShieldOff,
  clan: ShieldOff,
};

export function ForumPermissionGate({ reason, locale = "en" }: ForumPermissionGateProps) {
  const Icon = ICON[reason];
  const message = t(locale, GATE_KEY[reason] as never);

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
