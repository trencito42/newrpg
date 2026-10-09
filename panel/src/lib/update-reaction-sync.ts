import { dbExecute } from "./db";

/** One reaction per account: in-game uses character rows, panel uses account rows. */
export async function clearAccountUpdateReactionForCharacter(
  updateId: number,
  characterId: number
): Promise<void> {
  await dbExecute(
    `DELETE r FROM panel_update_reactions r
     INNER JOIN characters c ON c.id = ?
     INNER JOIN players p ON p.id = c.player_id
     WHERE r.update_id = ? AND r.reactor_type = 'account' AND r.reactor_id = p.account_id`,
    [characterId, updateId]
  );
}

export async function clearCharacterUpdateReactionsForAccount(
  updateId: number,
  accountId: number
): Promise<void> {
  await dbExecute(
    `DELETE r FROM panel_update_reactions r
     INNER JOIN characters c ON c.id = r.reactor_id AND r.reactor_type = 'character'
     INNER JOIN players p ON p.id = c.player_id
     WHERE r.update_id = ? AND p.account_id = ?`,
    [updateId, accountId]
  );
}
