-- Drop duplicate panel update reactions: keep in-game character row when the same account also reacted on the web panel.
DELETE r_acc
FROM panel_update_reactions r_acc
INNER JOIN players p ON p.account_id = r_acc.reactor_id AND r_acc.reactor_type = 'account'
INNER JOIN characters c ON c.player_id = p.id
INNER JOIN panel_update_reactions r_char
  ON r_char.update_id = r_acc.update_id
 AND r_char.reactor_type = 'character'
 AND r_char.reactor_id = c.id
 AND r_char.reaction = r_acc.reaction;
