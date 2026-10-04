ClanDisplay = {}

local membershipCache = {}

local function getChar(source)
    return exports.sunset_core:GetCharacter(source)
end

local function charId(source)
    local char = getChar(source)
    return char and tonumber(char.id)
end

function ClanDisplay.getMembership(characterId)
    characterId = tonumber(characterId)
    if not characterId then return nil end
    return MySQL.single.await([[
        SELECT cm.clan_id, cm.character_id, cm.rank, cm.warns, cm.joined_at,
               c.name, c.tag, c.tag_color, c.tag_style, c.description, c.motd,
               c.owner_character_id, c.max_members, c.rank_labels, c.expires_at, c.status,
               UNIX_TIMESTAMP(c.expires_at) AS expires_unix,
               YEAR(c.expires_at) AS expires_year,
               MONTH(c.expires_at) AS expires_month,
               DAY(c.expires_at) AS expires_day,
               TIMESTAMPDIFF(DAY, NOW(), c.expires_at) AS expires_in_days,
               TIMESTAMPDIFF(SECOND, NOW(), c.expires_at) AS expires_in_seconds
        FROM clan_members cm
        INNER JOIN clans c ON c.id = cm.clan_id
        WHERE cm.character_id = ?
    ]], { characterId })
end

function ClanDisplay.baseName(source)
    local char = getChar(source)
    if char then
        local full = ((char.firstname or '') .. (char.lastname and char.lastname ~= '' and (' ' .. char.lastname) or ''))
            :gsub('^%s+', ''):gsub('%s+$', '')
        if full ~= '' then return full end
    end
    local player = exports.sunset_core:GetPlayer(source)
    if player and player.name and player.name ~= '' then return player.name end
    return ('Player_%d'):format(source or 0)
end

local OnlineClanMembers = {}
local PlayerClan = {}

function ClanDisplay.sync(source)
    local cid = charId(source)
    if not cid then return end

    local row = ClanDisplay.getMembership(cid)
    membershipCache[source] = row

    local oldClan = PlayerClan[source]
    if oldClan and OnlineClanMembers[oldClan] then
        OnlineClanMembers[oldClan][source] = nil
    end

    if row and row.clan_id then
        local cId = tonumber(row.clan_id)
        PlayerClan[source] = cId
        OnlineClanMembers[cId] = OnlineClanMembers[cId] or {}
        OnlineClanMembers[cId][source] = true
    else
        PlayerClan[source] = nil
    end

    local base = ClanDisplay.baseName(source)
    local tag, color, style = '', '#FFFFFF', 'brackets'
    if row then
        tag = tostring(row.tag or '')
        color = tostring(row.tag_color or '#FF8C00')
        style = tostring(row.tag_style or 'brackets')
    end

    local displayName = base
    if tag ~= '' then
        displayName = SunsetClans.formatTaggedName(tag, base, style)
    end

    local state = Player(source).state
    state:set('clanTag', tag ~= '' and tag or nil, true)
    state:set('clanTagColor', tag ~= '' and color or nil, true)
    state:set('clanTagStyle', tag ~= '' and style or nil, true)
    state:set('sunsetName', base, true)
    state:set('sunsetDisplayName', displayName, true)
    state:set('sunsetClanId', row and tonumber(row.clan_id) or nil, true)
end

function ClanDisplay.formatPublicName(source, baseName)
    baseName = baseName or ClanDisplay.baseName(source)
    local row = membershipCache[source]
    if not row or not row.tag or row.tag == '' then return baseName end
    return SunsetClans.formatTaggedName(row.tag, baseName, row.tag_style)
end

function ClanDisplay.getChatMeta(source)
    local row = membershipCache[source]
    if not row or not row.tag or row.tag == '' then return nil end
    return {
        clanTag = row.tag,
        clanTagColor = row.tag_color,
        clanTagStyle = row.tag_style,
    }
end

function ClanDisplay.clear(source)
    local oldClan = PlayerClan[source]
    if oldClan and OnlineClanMembers[oldClan] then
        OnlineClanMembers[oldClan][source] = nil
    end
    PlayerClan[source] = nil
    membershipCache[source] = nil
end

function ClanDisplay.getOnlineClanMembers(clanId)
    local list = {}
    clanId = tonumber(clanId)
    if clanId and OnlineClanMembers[clanId] then
        for src in pairs(OnlineClanMembers[clanId]) do
            list[#list + 1] = src
        end
    end
    return list
end

function FormatDisplayName(source, baseName)
    return ClanDisplay.formatPublicName(source, baseName)
end
exports('FormatDisplayName', FormatDisplayName)

function GetClanChatMeta(source)
    return ClanDisplay.getChatMeta(source)
end
exports('GetClanChatMeta', GetClanChatMeta)

function SyncPlayerClan(source)
    ClanDisplay.sync(source)
end
exports('SyncPlayerClan', SyncPlayerClan)

function GetPlayerBaseName(source)
    return ClanDisplay.baseName(source)
end
exports('GetPlayerBaseName', GetPlayerBaseName)

AddEventHandler('sunset:server:characterSelected', function(source)
    ClanDisplay.sync(source)
end)

AddEventHandler('playerDropped', function()
    ClanDisplay.clear(source)
end)

AddEventHandler('onResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    for _, id in ipairs(GetPlayers()) do
        ClanDisplay.sync(tonumber(id))
    end
end)

-- Calendar parts come from MySQL (same clock as expires_at). Remaining time is
-- derived here and never stored. Month names match the /clan NUI formatter.
local CLAN_MONTHS = {
    en = { 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' },
    ro = { 'ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.' },
}

function ClanDisplay.lifetimeFields(row)
    if type(row) ~= 'table' then return nil end
    local unix = tonumber(row.expires_unix)
    local days = tonumber(row.expires_in_days)
    local seconds = tonumber(row.expires_in_seconds)
    local year = tonumber(row.expires_year)
    local month = tonumber(row.expires_month)
    local day = tonumber(row.expires_day)
    if not unix and not year then return nil end
    return {
        expiresAt = unix,
        remainingDays = days,
        expiresInSeconds = seconds,
        expiresYear = year,
        expiresMonth = month,
        expiresDay = day,
    }
end

function ClanDisplay.formatExpiryDate(row, locale)
    local fields = ClanDisplay.lifetimeFields(row) or row
    local year = tonumber(fields and (fields.expiresYear or fields.expires_year))
    local month = tonumber(fields and (fields.expiresMonth or fields.expires_month))
    local day = tonumber(fields and (fields.expiresDay or fields.expires_day))
    if not year or not month or not day then return '' end
    local names = CLAN_MONTHS[locale == 'ro' and 'ro' or 'en']
    return ('%d %s %d'):format(day, names[month] or tostring(month), year)
end

function GetConnectMotd(source, char)
    local cid = char and tonumber(char.id) or nil
    if not cid and source then
        local loaded = exports.sunset_core:GetCharacter(source)
        cid = loaded and tonumber(loaded.id)
    end
    if not cid then return nil end
    local row = ClanDisplay.getMembership(cid)
    if not row then return nil end
    local message = tostring(row.motd or ''):gsub('^%s+', ''):gsub('%s+$', '')
    if message == '' then return nil end
    return {
        type = 'clan_motd',
        id = 0,
        time = '',
        clanTag = row.tag,
        clanName = row.name,
        name = row.name,
        message = message,
        command = '/cmotd',
    }
end
exports('GetConnectMotd', GetConnectMotd)
