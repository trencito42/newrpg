"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { t, type Locale } from "@/lib/i18n";
import { PlayerManagementDrawer } from "./PlayerManagementDrawer";
import { ActionToast } from "./ActionToast";
import type {
  PlayerManagementBadge,
  PlayerManagementSanction,
  PlayerManagementTarget,
} from "@/lib/player-management/types";
import { canOpenManagement } from "@/lib/player-management/permissions";
import { normalizePlayerManagementTarget } from "@/lib/player-management/normalize-target";

interface Props {
  player: PlayerManagementTarget | Record<string, unknown>;
  sessionAdminLevel: number;
  sessionHelperLevel: number;
  locale: Locale;
  sanctionsList?: PlayerManagementSanction[];
  badges?: PlayerManagementBadge[];
  /** Preload false = fetch sanctions/badges when drawer opens */
  preloadContext?: boolean;
  className?: string;
}

export function PlayerManageTrigger({
  player,
  sessionAdminLevel,
  sessionHelperLevel,
  locale,
  sanctionsList: initialSanctions,
  badges: initialBadges,
  preloadContext = true,
  className,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sanctions, setSanctions] = useState<PlayerManagementSanction[]>(initialSanctions || []);
  const [badges, setBadges] = useState<PlayerManagementBadge[]>(initialBadges || []);
  const [target, setTarget] = useState<PlayerManagementTarget>(
    normalizePlayerManagementTarget(player)
  );
  const [loadingContext, setLoadingContext] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const session = { adminLevel: sessionAdminLevel, helperLevel: sessionHelperLevel };
  if (!canOpenManagement(session)) return null;

  const loadContext = useCallback(async () => {
    setLoadingContext(true);
    try {
      const res = await fetch(`/api/staff/players/${encodeURIComponent(target.username)}/management-context`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        setTarget(normalizePlayerManagementTarget({ ...target, ...data.player }));
        setSanctions(data.sanctions || []);
        setBadges(data.badges || []);
      }
    } finally {
      setLoadingContext(false);
    }
  }, [target.username]);

  useEffect(() => {
    if (!open) return;
    if (preloadContext && initialSanctions && initialBadges) {
      setSanctions(initialSanctions);
      setBadges(initialBadges);
      return;
    }
    void loadContext();
  }, [open, preloadContext, initialSanctions, initialBadges, loadContext]);

  const onSuccess = useCallback(() => {
    setToast({
      type: "success",
      message: t(locale, "playerManagement.action_success"),
    });
    router.refresh();
    if (!preloadContext) void loadContext();
  }, [locale, router, preloadContext, loadContext]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          "px-3 py-1.5 bg-[#D7B558] hover:bg-[#E3C572] text-[#08080A] font-semibold rounded text-xs transition-colors flex items-center gap-1.5 shadow-md"
        }
      >
        <Shield className="w-3.5 h-3.5" />
        <span>{t(locale, "players.manage_player")}</span>
      </button>

      {toast && (
        <ActionToast
          type={toast.type}
          message={toast.message}
          dismissLabel={t(locale, "common.close")}
          onDismiss={() => setToast(null)}
        />
      )}

      <PlayerManagementDrawer
        open={open}
        onClose={() => setOpen(false)}
        locale={locale}
        player={target}
        sessionAdminLevel={sessionAdminLevel}
        sessionHelperLevel={sessionHelperLevel}
        sanctionsList={sanctions}
        badges={badges}
        loadingContext={loadingContext}
        onSuccess={onSuccess}
        onError={(msg) => setToast({ type: "error", message: msg })}
      />
    </>
  );
}

/** @deprecated use PlayerManageTrigger */
export function PlayerAdminManage(props: Props) {
  return <PlayerManageTrigger {...props} />;
}
