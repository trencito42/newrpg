-- ═══════════════════════════════════════════════════════════════
--  [ADMIN OPS] Clan membership edits for sunset_admin (/setclan).
--  Domain rule: only sunset_clans writes clan_members — this thin
--  layer is called via export so staff can move players between
--  clans without touching the DB from another resource.
--  Caller (sunset_admin) validates permissions + audit logging.
-- ═══════════════════════════════════════════════════════════════

local function validateClan(clanId)
    clanId = tonumber(clanId)
    if not clanId then return nil, { localeKey = 'clans.message.clan_must_be_a_numeric_id_see_clans_or' } end
    local clan = MySQL.single.await('SELECT id, name, tag FROM clans WHERE id = ?', { clanId })
    if not clan then return nil, { localeKey = 'clans.message.clan_value_does_not_exist', formatArgs = { clanId } } end
    return clan
end

exports('AdminRemoveFromClan', function(characterId)
    characterId = tonumber(characterId)
    if not characterId then return false, { localeKey = 'clans.message.invalid_character' } end
    local removed = MySQL.update.await('DELETE FROM clan_members WHERE character_id = ?', { characterId })
    return true, removed or 0
end)

exports('AdminSetClan', function(characterId, clanId, rank)
    characterId = tonumber(characterId)
    rank = math.max(1, math.min(10, math.floor(tonumber(rank) or 1)))
    local clan, err = validateClan(clanId)
    if not clan then return nil, err end
    if not characterId then return nil, { localeKey = 'clans.message.invalid_character' } end

    MySQL.update.await('DELETE FROM clan_members WHERE character_id = ?', { characterId })
    local ok = pcall(function()
        MySQL.insert.await('INSERT INTO clan_members (clan_id, character_id, rank) VALUES (?, ?, ?)',
            { clan.id, characterId, rank })
    end)
    if not ok then
        return nil, { localeKey = 'clans.message.could_not_insert_the_clan_membership_row' }
    end
    return { clanId = clan.id, name = clan.name, tag = clan.tag, rank = rank }
end)
