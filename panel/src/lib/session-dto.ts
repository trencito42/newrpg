import { UserSession, ViewerSessionDTO } from "./types";

/** Explicit allowlist for props serialized into React client components. */
export function toViewerSessionDTO(session: UserSession | null): ViewerSessionDTO | null {
  if (!session) return null;
  return {
    accountId: session.accountId,
    username: session.username,
    language: session.language,
    adminLevel: session.adminLevel,
    helperLevel: session.helperLevel,
    selectedCharacterId: session.selectedCharacterId,
    selectedCharacterName: session.selectedCharacterName,
  };
}
