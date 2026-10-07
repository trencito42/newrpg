"use client";

import { StaffChatLogsClient } from "@/components/staff/StaffChatLogsClient";
import type { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  playerUsername: string;
  characterId?: number | null;
};

export function PlayerChatLogsTab({ locale, playerUsername, characterId }: Props) {
  if (!characterId) {
    return null;
  }
  return (
    <StaffChatLogsClient
      locale={locale}
      playerUsername={playerUsername}
      characterId={characterId}
      embedded
    />
  );
}
