-- ═══════════════════════════════════════════════════════════════
--  sunset_clans — server/shop_ops.lua
--  Domain-owned clan mutations for Racket Shop products. sunset_shop never
--  writes the clans table; it calls these exports AFTER debiting Racket
--  Credits and refunds when they fail.
--
--  Every action re-verifies, at the moment it runs: character loaded, clan
--  membership, LEADER rank, lifecycle status and the product rule. Mutations
--  are guarded single UPDATEs (slot upgrades only raise capacity; renewals only
--  touch active/grace clans) so concurrent purchases cannot double-apply.
-- ═══════════════════════════════════════════════════════════════

ClanShopOps = {}

-- Clan chat broadcast per applied product action ({value} = new value).
local BROADCAST_KEYS = {
    name = 'shop.clan.broadcast_name',
    tag = 'shop.clan.broadcast_tag',
    color = 'shop.clan.broadcast_color',
    slots = 'shop.clan.broadcast_slots',
    renew = 'shop.clan.broadcast_renew',
}

local function err(key, formatArgs)
    return { localeKey = key, formatArgs = formatArgs }
end

local function characterId(source)
    local char = exports.sunset_core:GetCharacter(source)
    return char and tonumber(char.id)
end

local function isLeaderRow(row, cid)
    if not row then return false end
    if tonumber(row.owner_character_id) == cid then return true end
    return SunsetClans.normalizeRank(row.rank) >= SunsetClans.MaxRank
end

-- Returns membership row + character id of a clan LEADER, or nil + error.
local function leaderMembership(source)
    local cid = characterId(source)
    if not cid then return nil, nil, err('clans.message.your_character_is_not_loaded_reconnect_and_try_again') end
    local row = ClanDisplay.getMembership(cid)
    if not row then return nil, nil, err('clans.message.you_are_not_in_a_clan') end
    if not isLeaderRow(row, cid) then return nil, nil, err('shop.clan.not_leader') end
    return row, cid
end

local function hooks()
    return ClanShopHooks or {}
end

local function validTier(slots)
    for _, tier in ipairs(SunsetClans.SlotTiers or {}) do
        if tier.slots == slots then return true end
    end
    return false
end

-- Validates an action for the given membership row. Returns a normalized
-- value table or nil + error. Pure apart from uniqueness lookups.
local function validateAction(row, action, params)
    params = type(params) == 'table' and params or {}
    if row.status == 'expired' then return nil, err('clans.err.clan_is_expired') end

    if action == 'name' then
        if params.name == nil then return {} end -- purchase step: entitlement only
        local name = SunsetClans.cleanName(params.name)
        if not name then
            return nil, err('clans.message.clan_name_must_be_value_value_letters_numbers_spaces_dots_or_dash',
                { SunsetClans.MinNameLength, SunsetClans.MaxNameLength })
        end
        if name == row.name then return nil, err('shop.clan.same_value') end
        local taken = MySQL.scalar.await('SELECT id FROM clans WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1', { name, row.clan_id })
        if taken then return nil, err('clans.message.that_clan_name_or_tag_is_already_taken') end
        return { name = name }
    elseif action == 'tag' then
        local tag = SunsetClans.cleanTag(params.tag)
        if not tag then
            return nil, err('clans.message.clan_tag_must_be_value_value_letters_or_numbers',
                { SunsetClans.MinTagLength, SunsetClans.MaxTagLength })
        end
        if tag == row.tag then return nil, err('shop.clan.same_value') end
        local taken = MySQL.scalar.await('SELECT id FROM clans WHERE LOWER(tag) = LOWER(?) AND id <> ? LIMIT 1', { tag, row.clan_id })
        if taken then return nil, err('clans.message.that_clan_tag_is_already_taken') end
        return { tag = tag }
    elseif action == 'color' then
        local color = SunsetClans.strictColor(params.color)
        if not color then return nil, err('shop.clan.invalid_color') end
        if color == tostring(row.tag_color or ''):upper() then return nil, err('shop.clan.same_value') end
        return { color = color }
    elseif action == 'slots' then
        if row.status ~= 'active' then return nil, err('clans.err.clan_is_expired') end
        local slots = tonumber(params.slots)
        if not slots or not validTier(slots) or slots <= (SunsetClans.BaseSlots or 25) then
            return nil, err('clans.message.invalid_clan_action')
        end
        local current = tonumber(row.max_members) or (SunsetClans.BaseSlots or 25)
        if current >= slots then return nil, err('shop.purchase.already_owned') end
        local nextTier = SunsetClans.nextSlotTier(current)
        if not nextTier or nextTier.slots ~= slots then
            return nil, err('clans.message.clan_slot_upgrade_must_be_sequential')
        end
        return { slots = slots, floor = SunsetClans.slotFloor(slots) }
    elseif action == 'renew' then
        local days = math.floor(tonumber(params.days) or 0)
        if days <= 0 or days > 365 then return nil, err('clans.message.invalid_clan_action') end
        return { days = days }
    end
    return nil, err('clans.message.unknown_clan_action')
end

function ClanShopOps.check(source, action, params)
    local row, _, leaderErr = leaderMembership(source)
    if not row then return false, leaderErr end
    local value, valueErr = validateAction(row, action, params)
    if not value then return false, valueErr end
    return true, nil, { clanId = tonumber(row.clan_id), action = action }
end

local function mutate(sql, args)
    local ok, changed = pcall(function() return MySQL.update.await(sql, args) end)
    if not ok then
        print(('^1[sunset_clans]^7 shop mutation failed: %s'):format(tostring(changed)))
        return 0
    end
    return tonumber(changed) or 0
end

function ClanShopOps.apply(source, action, params)
    local row, cid, leaderErr = leaderMembership(source)
    if not row then return nil, leaderErr end
    local value, valueErr = validateAction(row, action, params)
    if not value then return nil, valueErr end
    local clanId = tonumber(row.clan_id)
    local orderId = type(params) == 'table' and tonumber(params.orderId) or nil
    local result = { clanId = clanId, action = action }
    local changed = 0

    if action == 'name' then
        if not value.name then return nil, err('shop.clan.invalid_name') end
        changed = mutate('UPDATE clans SET name = ? WHERE id = ?', { value.name, clanId })
        result.oldName, result.name = row.name, value.name
    elseif action == 'tag' then
        changed = mutate('UPDATE clans SET tag = ? WHERE id = ?', { value.tag, clanId })
        result.oldTag, result.tag = row.tag, value.tag
    elseif action == 'color' then
        changed = mutate('UPDATE clans SET tag_color = ? WHERE id = ?', { value.color, clanId })
        result.color = value.color
    elseif action == 'slots' then
        changed = mutate('UPDATE clans SET max_members = ? WHERE id = ? AND max_members < ? AND max_members >= ? AND status = \'active\'', { value.slots, clanId, value.slots, value.floor or SunsetClans.BaseSlots or 25 })
        if changed ~= 1 then return nil, err('shop.purchase.already_owned') end
        result.slots = value.slots
    elseif action == 'renew' then
        -- Extends an active clan from its current expiry; restores a clan in
        -- grace from NOW. Expired clans are never touched.
        changed = mutate([[
            UPDATE clans
            SET expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, NOW()), NOW()), INTERVAL ? DAY),
                status = 'active'
            WHERE id = ? AND status IN ('active', 'grace')
        ]], { value.days, clanId })
        if changed ~= 1 then return nil, err('clans.err.clan_is_expired') end
        result.days = value.days
        result.restored = row.status == 'grace'
    end
    if changed ~= 1 then return nil, err('shop.purchase.failed') end

    local h = hooks()
    if h.audit then h.audit(clanId, cid, 'shop_' .. action, { orderId = orderId, value = value, previous = { name = row.name, tag = row.tag, color = row.tag_color, slots = row.max_members, status = row.status } }) end
    if h.broadcast then h.broadcast(clanId, source, { localeKey = BROADCAST_KEYS[action], params = { value = tostring(value.name or value.tag or value.color or value.slots or value.days or '') } }) end
    if h.syncMembers then h.syncMembers(clanId) end
    if h.refresh then h.refresh(clanId, source, action, value) end
    if action == 'slots' or action == 'renew' then
        TriggerEvent('sunset:quest:progress', cid, 'clan_store_bought', 1, { item = action == 'slots' and 'slots_upgrade' or 'lifetime_extension', orderId = orderId })
    end
    return result
end

function ClanShopOps.context(source)
    local cid = characterId(source)
    if not cid then return { inClan = false } end
    local row = ClanDisplay.getMembership(cid)
    if not row then return { inClan = false } end
    return {
        inClan = true,
        leader = isLeaderRow(row, cid),
        clanId = tonumber(row.clan_id),
        name = row.name,
        tag = row.tag,
        tagColor = row.tag_color,
        maxMembers = tonumber(row.max_members) or (SunsetClans.BaseSlots or 10),
        status = row.status or 'active',
        expiresAt = row.expires_at,
    }
end

exports('ShopCheckClanProduct', function(source, action, params)
    return ClanShopOps.check(source, action, params)
end)

exports('ShopApplyClanProduct', function(source, action, params)
    return ClanShopOps.apply(source, action, params)
end)

exports('GetShopClanContext', function(source)
    return ClanShopOps.context(source)
end)
