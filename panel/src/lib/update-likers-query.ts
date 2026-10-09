/** Likers list: one row per account; prefer in-game character identity over panel account row. */
export const UPDATE_LIKERS_SQL = `
  SELECT display_name, username, faction_id, clan_tag, clan_color, clan_tag_style
  FROM (
    SELECT
      r.created_at,
      COALESCE(pl.account_id, r.reactor_id) AS account_key,
      CASE
        WHEN r.reactor_type = 'character' THEN TRIM(CONCAT(COALESCE(c.firstname, ''), ' ', COALESCE(c.lastname, '')))
        ELSE COALESCE(a_direct.username, '')
      END AS display_name,
      COALESCE(a_char.username, a_direct.username) AS username,
      CASE
        WHEN r.reactor_type = 'character' THEN JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction'))
        ELSE JSON_UNQUOTE(JSON_EXTRACT(c_acct.metadata, '$.faction'))
      END AS faction_id,
      CASE WHEN r.reactor_type = 'character' THEN cl.tag ELSE cl_acct.tag END AS clan_tag,
      CASE WHEN r.reactor_type = 'character' THEN cl.tag_color ELSE cl_acct.tag_color END AS clan_color,
      CASE WHEN r.reactor_type = 'character' THEN cl.tag_style ELSE cl_acct.tag_style END AS clan_tag_style,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(pl.account_id, r.reactor_id)
        ORDER BY CASE WHEN r.reactor_type = 'character' THEN 0 ELSE 1 END, r.created_at DESC
      ) AS rn
    FROM panel_update_reactions r
    LEFT JOIN characters c ON r.reactor_type = 'character' AND c.id = r.reactor_id
    LEFT JOIN players pl ON pl.id = c.player_id
    LEFT JOIN accounts a_char ON a_char.id = pl.account_id
    LEFT JOIN accounts a_direct ON r.reactor_type = 'account' AND a_direct.id = r.reactor_id
    LEFT JOIN players p_acct ON r.reactor_type = 'account' AND p_acct.account_id = r.reactor_id
    LEFT JOIN characters c_acct ON c_acct.id = (
      SELECT c2.id FROM characters c2
      WHERE c2.player_id = p_acct.id
      ORDER BY c2.level DESC, c2.slot ASC, c2.id DESC
      LIMIT 1
    )
    LEFT JOIN clan_members clanm ON clanm.character_id = c.id
    LEFT JOIN clans cl ON cl.id = clanm.clan_id
    LEFT JOIN clan_members clanm_acct ON clanm_acct.character_id = c_acct.id
    LEFT JOIN clans cl_acct ON cl_acct.id = clanm_acct.clan_id
    WHERE r.update_id = ? AND r.reaction = 'like'
  ) ranked
  WHERE ranked.rn = 1
  ORDER BY ranked.created_at DESC
  LIMIT 20`;
