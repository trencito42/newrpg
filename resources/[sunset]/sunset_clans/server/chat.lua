local CHAT_COOLDOWN_MS = 1200
local RateLimits = {}

local function checkRateLimit(source, key, cooldownMs)
    local now = GetGameTimer()
    local bucket = RateLimits[source] or {}
    local last = bucket[key] or 0
    if now - last < cooldownMs then return false end
    bucket[key] = now
    RateLimits[source] = bucket
    return true
end

AddEventHandler('playerDropped', function()
    RateLimits[source] = nil
end)

local function notify(source, message, kind)
    TriggerClientEvent('sunset:client:notify', source, message, kind or 'info', 6000)
end

local function charId(source)
    local char = exports.sunset_core:GetCharacter(source)
    return char and tonumber(char.id)
end

local function runClanChat(source, args)
    if source == 0 then return end

    local cid = charId(source)
    if not cid then return end

    local row = ClanDisplay.getMembership(cid)
    if not row then
        return notify(source, exports.sunset_core:TFor(source, 'clans.msg.you_are_not_in_a_clan'), 'error')
    end

    if not checkRateLimit(source, 'clan_chat', CHAT_COOLDOWN_MS) then
        return notify(source, exports.sunset_core:TFor(source, 'clans.msg.slow_down_message_rate_limited'), 'error')
    end

    local msg = GetResourceState('sunset_chat') == 'started'
        and exports.sunset_chat:ResolveLinkedText(source, args, 0)
        or table.concat(args, ' ')
    if not msg or msg == '' then
        return notify(source, exports.sunset_core:TFor(source, 'clans.msg.usage_c_message'), 'error')
    end
    local msgLen = utf8.len(msg) or #msg
    if msgLen > 250 then
        return notify(source, exports.sunset_core:TFor(source, 'clans.msg.message_too_long'), 'error')
    end

    local rank = SunsetClans.normalizeRank(row.rank)
    local labels = SunsetClans.decodeRankLabels(row.rank_labels)
    local rankLabel = SunsetClans.getRankLabel(labels, rank)
    local name = exports.sunset_core:GetPlayerBaseName(source)
    local clanId = tonumber(row.clan_id)

    local members = ClanDisplay.getOnlineClanMembers(clanId)
    local payload = {
        id = source,
        name = name,
        message = msg,
        time = os.date('%H:%M:%S'),
        type = 'c',
        clanRank = rank,
        clanRankLabel = rankLabel,
        clanTag = row.tag,
        clanTagColor = row.tag_color,
        clanTagStyle = row.tag_style,
    }
    if GetResourceState('sunset_chat') == 'started' then
        exports.sunset_chat:ApplyChatAttachment(source, payload)
    end

    for _, src in ipairs(members) do
        TriggerClientEvent('sunset:chat:message', src, payload)
    end
    if GetResourceState('sunset_chat') == 'started' then
        exports.sunset_chat:ClearChatAttachment(source)
    end
end

RegisterCommand('c', function(source, args)
    runClanChat(source, args)
end, false)

function RunChatCommand(source, name, args)
    if source == 0 then return false end
    name = string.lower(tostring(name or ''))
    args = args or {}
    if name == 'c' then
        runClanChat(source, args)
        return true
    end
    if name == 'clan' then
        TriggerClientEvent('sunset:clans:openDashboard', source)
        return true
    end
    if name == 'clans' then
        TriggerClientEvent('sunset:clans:openDirectory', source)
        return true
    end
    if name == 'group' then
        TriggerClientEvent('sunset:clans:openDashboard', source)
        return true
    end
    if name == 'cmotd' then
        exports.sunset_clans:RunMotdCommand(source, args)
        return true
    end
    return false
end
exports('RunChatCommand', RunChatCommand)
