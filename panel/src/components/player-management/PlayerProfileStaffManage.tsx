"use client";

import { PlayerManageTrigger } from "./PlayerManageTrigger";
import type { Locale } from "@/lib/i18n";

export function PlayerProfileStaffManage({
  locale,
  sessionAdminLevel,
  sessionHelperLevel,
  player,
}: {
  locale: Locale;
  sessionAdminLevel: number;
  sessionHelperLevel: number;
  player: {
    account_id: number;
    character_id: number;
    username: string;
    level: number;
    is_online: boolean;
    last_played: string | null;
    faction_id: string | null;
    clan_tag: string | null;
    clan_tag_color: string | null;
    clan_tag_style: string | null;
    avatar_skin?: string | null;
  };
}) {
  if (sessionAdminLevel < 1 && sessionHelperLevel < 1) return null;

  return (
    <PlayerManageTrigger
      locale={locale}
      sessionAdminLevel={sessionAdminLevel}
      sessionHelperLevel={sessionHelperLevel}
      preloadContext={false}
      player={{
        ...player,
        is_online: Boolean(player.is_online),
      }}
    />
  );
}
