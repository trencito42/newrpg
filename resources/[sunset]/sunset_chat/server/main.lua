local CHAT_RANGE = 22.0
local CHAT_COOLDOWN_MS = 350
local ChatRateLimits = {}

local function t(source, key, params)
    return exports.sunset_core:TFor(source, key, params)
end

local function checkChatRateLimit(source, key, cooldownMs)
    local now = GetGameTimer()
    local bucket = ChatRateLimits[source] or {}
    local last = bucket[key] or 0
    if now - last < (cooldownMs or CHAT_COOLDOWN_MS) then return false end
    bucket[key] = now
    ChatRateLimits[source] = bucket
    return true
end

AddEventHandler('playerDropped', function()
    ChatRateLimits[source] = nil
end)

local function cleanChatText(value, maxLength)
    if type(value) ~= 'string' then return nil end
    local text = value:gsub('[%z\1-\8\11\12\14-\31\127]', '')
    text = text:match('^%s*(.-)%s*$') or ''
    if text == '' then return nil end
    return text:sub(1, maxLength or 256)
end

local function playerCoords(source)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return nil end
    return GetEntityCoords(ped)
end

local function sendNearby(source, payload, range, eventName)
    local origin = playerCoords(source)
    if not origin then return end
    range = range or CHAT_RANGE
    eventName = eventName or 'sunset:chat:message'
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local dest = playerCoords(src)
        if dest and #(origin - dest) <= range then
            TriggerClientEvent(eventName, src, payload)
        end
    end
end


local function chatIdentity(source)
    local payload = {}
    if GetResourceState('sunset_core') == 'started' then
        local ok, base = pcall(function()
            return exports.sunset_core:GetPlayerBaseName(source)
        end)
        if ok and type(base) == 'string' and base ~= '' then
            payload.name = base
        end

        local okChar, char = pcall(function()
            return exports.sunset_core:GetCharacter(source)
        end)
        if okChar and type(char) == 'table' then
            local md = char.metadata or {}
            local factionId = md.faction
            if not factionId and char.job then
                factionId = char.job
            end
            if factionId and type(factionId) == 'string' and factionId ~= '' and factionId ~= 'unemployed' then
                payload.factionId = factionId
            end
        end
    end
    -- [ADUTY] On-duty staff get a visible [HELPER]/[STAFF] prefix in chat.
    -- [SEC3] was Player(source).state.adminDuty: with sv_stateBagStrictMode=false any client can set its own
    -- state bag and would get the staff prefix. Use the server-side duty table + a real staff check.
    local okDuty, onDuty = pcall(function()
        return exports.sunset_admin:IsOnAdminDuty(source) == true and exports.sunset_admin:IsAdmin(source, 1) == true
    end)
    if okDuty and onDuty then
        local level = 0
        pcall(function() level = exports.sunset_admin:GetAdminLevel(source) or 0 end)
        payload.adminDuty = true
        payload.adminLevel = level
    end
    if GetResourceState('sunset_clans') == 'started' then
        local okMeta, meta = pcall(function()
            return exports.sunset_clans:GetClanChatMeta(source)
        end)
        if okMeta and type(meta) == 'table' then
            payload.clanTag = meta.clanTag
            payload.clanTagColor = meta.clanTagColor
            payload.clanTagStyle = meta.clanTagStyle
        end
    end
    if not payload.name then
        payload.name = GetPlayerName(source) or 'Player'
    end
    return payload
end

local function sendBroadcast(payload, eventName)
    eventName = eventName or 'sunset:chat:message'
    for _, id in ipairs(GetPlayers()) do
        TriggerClientEvent(eventName, tonumber(id), payload)
    end
end

local function sendStaffOnly(payload)
    for _, id in ipairs(GetPlayers()) do
        local src = tonumber(id)
        local ok, isAdmin = pcall(function() return exports.sunset_admin:IsAdmin(src, 1) end)
        if ok and isAdmin == true then
            TriggerClientEvent('sunset:chat:message', src, payload)
        end
    end
end

-- [SEC3] Unauthenticated / character-less clients (login screen, char select) could broadcast OOC chat
-- and spam proximity chat; every player-facing chat entry point now requires a loaded character.
local function hasCharacter(source)
    local ok, char = pcall(function() return exports.sunset_core:GetCharacter(source) end)
    return ok and type(char) == 'table' and char.id ~= nil
end

local function checkMute(source)
    if GetResourceState('sunset_admin') == 'started' then
        local ok, isMuted, remainingMin, reason = pcall(function()
            return exports.sunset_admin:IsMuted(source)
        end)
        if ok and isMuted then
            TriggerClientEvent('sunset:chat:system', source, t(source, 'chat.muted_remaining', {
                minutes = remainingMin or 1,
                reason = reason or t(source, 'chat.default_mute_reason'),
            }), 'error')
            return true
        end
    end
    return false
end

RegisterNetEvent('sunset:chat:send', function(message, channel)
    local src = source
    if not hasCharacter(src) then return end -- [SEC3]
    if checkMute(src) then return end
    channel = tostring(channel or 'all'):lower()

    -- [STAFF CHAT] /a or STAFF channel — staff-only, level 1+
    if channel == 'staff' then
        local ok, isStaff = pcall(function() return exports.sunset_admin:IsStaff(src) end)
        if not ok or isStaff ~= true then
            TriggerClientEvent('sunset:chat:system', src, t(src, 'chat.staff_only'), 'error')
            return
        end
        if not checkChatRateLimit(src, 'say', CHAT_COOLDOWN_MS) then
            TriggerClientEvent('sunset:chat:system', src, t(src, 'chat.rate_limited'), 'warning')
            return
        end
        message = cleanChatText(message, 256)
        if not message then return end
        local identity = chatIdentity(src)
        local aLvl = exports.sunset_admin:GetAdminLevel(src) or 0
        local hLvl = exports.sunset_admin:GetHelperLevel(src) or 0
        for _, id in ipairs(GetPlayers()) do
            local pid = tonumber(id)
            if pid and exports.sunset_admin:IsStaff(pid) then
                TriggerClientEvent('sunset:chat:message', pid, {
                    id = src,
                    name = identity.name,
                    message = message,
                    time = os.date('%H:%M:%S'),
                    type = 'staff_chat',
                    staffRole = aLvl > 0 and t(pid, 'chat.role.admin', { level = aLvl }) or t(pid, 'chat.role.helper', { level = hLvl }),
                })
            end
        end
        return
    end

    local isOoc = channel == 'ooc'
    local rateKey = isOoc and 'ooc' or 'say'
    if not checkChatRateLimit(src, rateKey, CHAT_COOLDOWN_MS) then
        TriggerClientEvent('sunset:chat:system', src, t(src, 'chat.rate_limited'), 'warning')
        return
    end
    message = cleanChatText(message, 256)
    if not message then return end

    local identity = chatIdentity(src)
    local payload = {
        id = src,
        name = identity.name,
        factionId = identity.factionId,
        clanTag = identity.clanTag,
        clanTagColor = identity.clanTagColor,
        clanTagStyle = identity.clanTagStyle,
        message = message,
        time = os.date('%H:%M:%S'),
        type = isOoc and 'ooc' or 'say',
    }
    if isOoc then
        sendBroadcast(payload)
    else
        sendNearby(src, payload)
    end
end)

local function runMeCommand(source, args)
    if not hasCharacter(source) then return end -- [SEC3]
    if checkMute(source) then return end
    local msg = cleanChatText(table.concat(args, ' '), 256)
    if not msg then return end
    local identity = chatIdentity(source)
    sendNearby(source, {
        id = source,
        name = identity.name,
        factionId = identity.factionId,
        clanTag = identity.clanTag,
        clanTagColor = identity.clanTagColor,
        clanTagStyle = identity.clanTagStyle,
        message = msg,
        time = os.date('%H:%M:%S'),
        type = 'me',
    })
end

-- /a [message] — admin chat (Admin Level 1+)
RegisterCommand('a', function(source, args)
    if source == 0 then return end
    local ok, isAdmin = pcall(function() return exports.sunset_admin:IsAdmin(source, 1) end)
    if not ok or isAdmin ~= true then
        exports.sunset_core:CommandDenyAdmin(source, 'a')
        return
    end
    local msg = cleanChatText(table.concat(args, ' '), 256)
    if not msg then
        TriggerClientEvent('sunset:chat:system', source, t(source, 'chat.usage.admin'), 'warning')
        return
    end
    local identity = chatIdentity(source)
    local level = 0
    pcall(function() level = exports.sunset_admin:GetAdminLevel(source) or 0 end)
    for _, id in ipairs(GetPlayers()) do
        local pid = tonumber(id)
        if pid and exports.sunset_admin:IsAdmin(pid, 1) then
            TriggerClientEvent('sunset:chat:message', pid, {
                id = source,
                name = identity.name,
                message = msg,
                time = os.date('%H:%M:%S'),
                type = 'admin_chat',
                adminLevel = level,
            })
        end
    end
end, false)

-- /e [message] — admin & helper staff chat
RegisterCommand('e', function(source, args)
    if source == 0 then return end
    local ok, isStaff = pcall(function() return exports.sunset_admin:IsStaff(source) end)
    if not ok or isStaff ~= true then
        TriggerClientEvent('sunset:chat:system', source, t(source, 'staff_only'), 'error')
        return
    end
    local msg = cleanChatText(table.concat(args, ' '), 256)
    if not msg then
        TriggerClientEvent('sunset:chat:system', source, t(source, 'chat.usage.staff'), 'warning')
        return
    end
    local identity = chatIdentity(source)
    local aLvl = exports.sunset_admin:GetAdminLevel(source) or 0
    local hLvl = exports.sunset_admin:GetHelperLevel(source) or 0
    for _, id in ipairs(GetPlayers()) do
        local pid = tonumber(id)
        if pid and exports.sunset_admin:IsStaff(pid) then
            TriggerClientEvent('sunset:chat:message', pid, {
                id = source,
                name = identity.name,
                message = msg,
                time = os.date('%H:%M:%S'),
                type = 'staff_chat',
                staffRole = aLvl > 0 and t(pid, 'chat.role.admin', { level = aLvl }) or t(pid, 'chat.role.helper', { level = hLvl }),
            })
        end
    end
end, false)

local function runLeaderChatCommand(source, args)
    if source == 0 then return end
    local isLeader = false
    local isAdmin = false
    pcall(function()
        if GetResourceState('sunset_factions') == 'started' then
            isLeader = exports.sunset_factions:IsFactionLeader(source) == true
        end
        if GetResourceState('sunset_admin') == 'started' then
            isAdmin = exports.sunset_admin:IsAdmin(source, 1) == true
        end
    end)
    if not isLeader and not isAdmin then
        TriggerClientEvent('sunset:chat:system', source, t(source, 'chat.leader_denied'), 'error')
        return
    end
    local msg = cleanChatText(table.concat(args, ' '), 256)
    if not msg then
        TriggerClientEvent('sunset:chat:system', source, t(source, 'chat.usage.leader'), 'warning')
        return
    end
    local identity = chatIdentity(source)
    local titleLevel = nil
    local title = nil
    if isAdmin then
        local aLvl = exports.sunset_admin:GetAdminLevel(source) or 0
        titleLevel = aLvl
    else
        local char = exports.sunset_core:GetCharacter(source)
        local fId = select(1, Sunset.GetCharacterFaction(char))
        if fId and Sunset.Factions[fId] then
            title = Sunset.Factions[fId].label or fId
        end
    end

    for _, id in ipairs(GetPlayers()) do
        local pid = tonumber(id)
        local canSee = false
        pcall(function()
            if exports.sunset_admin:IsAdmin(pid, 1) then canSee = true
            elseif exports.sunset_factions:IsFactionLeader(pid) then canSee = true end
        end)
        if canSee then
            local recipientTitle = titleLevel and t(pid, 'chat.role.admin', { level = titleLevel })
                or title or t(pid, 'chat.role.leader')
            TriggerClientEvent('sunset:chat:message', pid, {
                id = source,
                name = identity.name,
                message = msg,
                time = os.date('%H:%M:%S'),
                type = 'leader_chat',
                leaderTitle = recipientTitle,
            })
        end
    end
end

RegisterCommand('lc', function(source, args)
    runLeaderChatCommand(source, args)
end, false)

local function runDoCommand(source, args)
    if not hasCharacter(source) then return end -- [SEC3]
    if checkMute(source) then return end
    local msg = cleanChatText(table.concat(args, ' '), 256)
    if not msg then return end
    local identity = chatIdentity(source)
    sendNearby(source, {
        id = source,
        name = identity.name,
        factionId = identity.factionId,
        clanTag = identity.clanTag,
        clanTagColor = identity.clanTagColor,
        clanTagStyle = identity.clanTagStyle,
        message = msg,
        time = os.date('%H:%M:%S'),
        type = 'do',
    })
end

local function runShoutCommand(source, args)
    if not hasCharacter(source) then return end -- [SEC3]
    if checkMute(source) then return end
    local msg = cleanChatText(table.concat(args, ' '), 256)
    if not msg then return end
    local identity = chatIdentity(source)
    sendNearby(source, {
        id = source,
        name = identity.name,
        factionId = identity.factionId,
        clanTag = identity.clanTag,
        clanTagColor = identity.clanTagColor,
        clanTagStyle = identity.clanTagStyle,
        message = msg,
        time = os.date('%H:%M:%S'),
        type = 'shout',
    }, 45.0)
end

local function runWhisperCommand(source, args)
    if not hasCharacter(source) then return end -- [SEC3]
    if checkMute(source) then return end
    if not args or #args < 2 then
        TriggerClientEvent('sunset:chat:system', source, t(source, 'chat.usage.whisper'), 'warning')
        return
    end

    local targetId = tonumber(args[1])
    if not targetId or targetId <= 0 or not GetPlayerName(targetId) or not hasCharacter(targetId) then
        TriggerClientEvent('sunset:chat:system', source, t(source, 'chat.whisper.player_not_found'), 'error')
        return
    end

    local senderPed = GetPlayerPed(source)
    local targetPed = GetPlayerPed(targetId)
    if not senderPed or senderPed == 0 or not targetPed or targetPed == 0 then
        TriggerClientEvent('sunset:chat:system', source, t(source, 'chat.whisper.player_not_found'), 'error')
        return
    end

    local dist = #(GetEntityCoords(senderPed) - GetEntityCoords(targetPed))
    if dist > 4.5 then
        TriggerClientEvent('sunset:chat:system', source, t(source, 'chat.whisper.too_far'), 'error')
        return
    end

    local rawMsg = table.concat(args, ' ', 2)
    local msg = cleanChatText(rawMsg, 256)
    if not msg then return end

    local senderIdent = chatIdentity(source)
    local targetIdent = chatIdentity(targetId)

    -- Message to sender
    TriggerClientEvent('sunset:chat:message', source, {
        id = source,
        name = senderIdent.name,
        factionId = senderIdent.factionId,
        clanTag = senderIdent.clanTag,
        clanTagColor = senderIdent.clanTagColor,
        clanTagStyle = senderIdent.clanTagStyle,
        message = t(source, 'chat.whisper.to', { name = targetIdent.name, message = msg }),
        time = os.date('%H:%M:%S'),
        type = 'whisper',
    })

    -- Message to target
    if targetId ~= source then
        TriggerClientEvent('sunset:chat:message', targetId, {
            id = source,
            name = senderIdent.name,
            factionId = senderIdent.factionId,
            clanTag = senderIdent.clanTag,
            clanTagColor = senderIdent.clanTagColor,
            clanTagStyle = senderIdent.clanTagStyle,
            message = t(targetId, 'chat.whisper.from', { name = senderIdent.name, message = msg }),
            time = os.date('%H:%M:%S'),
            type = 'whisper',
        })
    end

    -- Proximity emote for bystanders within 2.2m
    local sCoords = GetEntityCoords(senderPed)
    for _, pid in ipairs(GetPlayers()) do
        local p = tonumber(pid)
        if p and p ~= source and p ~= targetId then
            local pPed = GetPlayerPed(p)
            if pPed and pPed ~= 0 and #(GetEntityCoords(pPed) - sCoords) <= 2.2 then
                TriggerClientEvent('sunset:chat:message', p, {
                    id = source,
                    name = senderIdent.name,
                    message = t(p, 'chat.whisper.nearby', { name = senderIdent.name, target = targetIdent.name }),
                    time = os.date('%H:%M:%S'),
                    type = 'me',
                })
            end
        end
    end
end

local function runCarWhisperCommand(source, args)
    if not hasCharacter(source) then return end -- [SEC3]
    if checkMute(source) then return end
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return end
    local veh = GetVehiclePedIsIn(ped, false)
    if not veh or veh == 0 then
        TriggerClientEvent('sunset:chat:system', source, t(source, 'chat.whisper.not_in_vehicle'), 'error')
        return
    end

    local rawMsg = table.concat(args, ' ')
    local msg = cleanChatText(rawMsg, 256)
    if not msg then
        TriggerClientEvent('sunset:chat:system', source, t(source, 'chat.usage.carwhisper'), 'warning')
        return
    end

    local senderIdent = chatIdentity(source)

    -- Send to all vehicle occupants
    for _, pid in ipairs(GetPlayers()) do
        local p = tonumber(pid)
        if p then
            local pPed = GetPlayerPed(p)
            if pPed and pPed ~= 0 and GetVehiclePedIsIn(pPed, false) == veh then
                TriggerClientEvent('sunset:chat:message', p, {
                    id = source,
                    name = senderIdent.name,
                    factionId = senderIdent.factionId,
                    clanTag = senderIdent.clanTag,
                    clanTagColor = senderIdent.clanTagColor,
                    clanTagStyle = senderIdent.clanTagStyle,
                    message = t(p, 'chat.carwhisper.msg', { name = senderIdent.name, message = msg }),
                    time = os.date('%H:%M:%S'),
                    type = 'whisper',
                })
            end
        end
    end
end

local function runLowCommand(source, args)
    if not hasCharacter(source) then return end -- [SEC3]
    if checkMute(source) then return end
    local msg = cleanChatText(table.concat(args, ' '), 256)
    if not msg then return end
    local identity = chatIdentity(source)
    sendNearby(source, {
        id = source,
        name = identity.name,
        factionId = identity.factionId,
        clanTag = identity.clanTag,
        clanTagColor = identity.clanTagColor,
        clanTagStyle = identity.clanTagStyle,
        message = msg,
        time = os.date('%H:%M:%S'),
        type = 'low',
    }, 6.0)
end

local function runBCommand(source, args)
    if not hasCharacter(source) then return end -- [SEC3]
    if checkMute(source) then return end
    local msg = cleanChatText(table.concat(args, ' '), 256)
    if not msg then return end
    local identity = chatIdentity(source)
    sendNearby(source, {
        id = source,
        name = identity.name,
        factionId = identity.factionId,
        clanTag = identity.clanTag,
        clanTagColor = identity.clanTagColor,
        clanTagStyle = identity.clanTagStyle,
        message = msg,
        time = os.date('%H:%M:%S'),
        type = 'b',
    }, 22.0)
end

RegisterCommand('me', function(source, args)
    runMeCommand(source, args)
end, false)

RegisterCommand('do', function(source, args)
    runDoCommand(source, args)
end, false)

RegisterCommand('s', function(source, args)
    runShoutCommand(source, args)
end, false)
RegisterCommand('shout', function(source, args)
    runShoutCommand(source, args)
end, false)

RegisterCommand('w', function(source, args)
    runWhisperCommand(source, args)
end, false)
RegisterCommand('whisper', function(source, args)
    runWhisperCommand(source, args)
end, false)

RegisterCommand('cw', function(source, args)
    runCarWhisperCommand(source, args)
end, false)
RegisterCommand('carwhisper', function(source, args)
    runCarWhisperCommand(source, args)
end, false)

RegisterCommand('l', function(source, args)
    runLowCommand(source, args)
end, false)
RegisterCommand('low', function(source, args)
    runLowCommand(source, args)
end, false)

RegisterCommand('b', function(source, args)
    runBCommand(source, args)
end, false)

function RunServerCommand(source, name, args)
    if source == 0 then return false end
    name = string.lower(tostring(name or ''))
    args = args or {}
    if name == 'lc' then runLeaderChatCommand(source, args) return true end
    if name == 'me' then runMeCommand(source, args) return true end
    if name == 'do' then runDoCommand(source, args) return true end
    if name == 's' or name == 'shout' then runShoutCommand(source, args) return true end
    if name == 'w' or name == 'whisper' then runWhisperCommand(source, args) return true end
    if name == 'cw' or name == 'carwhisper' then runCarWhisperCommand(source, args) return true end
    if name == 'l' or name == 'low' then runLowCommand(source, args) return true end
    if name == 'b' then runBCommand(source, args) return true end
    return false
end
exports('RunServerCommand', RunServerCommand)

local function buildChatChannels(source)
    local channels = {
        { id = 'all', label = t(source, 'chat.channel.local'), placeholder = t(source, 'chat.channel.local_hint') },
        { id = 'ooc', label = 'OOC', placeholder = t(source, 'chat.channel.ooc_hint') },
        { id = 'me', label = 'ME', placeholder = t(source, 'chat.channel.me_hint') },
        { id = 'do', label = 'DO', placeholder = t(source, 'chat.channel.do_hint') },
    }

    local char = exports.sunset_core:GetCharacter(source)
    local factionId = select(1, Sunset.GetCharacterFaction(char))
    if factionId and Sunset.Factions[factionId] then
        local faction = Sunset.Factions[factionId]
        local label = faction.label or factionId
        if Sunset.IsEmergencyDepartment(factionId) then
            channels[#channels + 1] = {
                id = 'radio',
                label = t(source, 'chat.channel.radio'),
                placeholder = t(source, 'chat.channel.radio_hint', { faction = label }),
            }
            channels[#channels + 1] = {
                id = 'dept',
                label = t(source, 'chat.channel.department'),
                placeholder = t(source, 'chat.channel.department_hint'),
            }
        else
            channels[#channels + 1] = {
                id = 'faction',
                label = string.upper(label),
                placeholder = t(source, 'chat.channel.faction_hint', { faction = label }),
            }
        end
    end

    if GetResourceState('sunset_clans') == 'started' then
        local ok, meta = pcall(function()
            return exports.sunset_clans:GetClanChatMeta(source)
        end)
        if ok and type(meta) == 'table' and meta.clanTag and meta.clanTag ~= '' then
            channels[#channels + 1] = {
                id = 'clan',
                label = string.upper(meta.clanTag),
                placeholder = t(source, 'chat.channel.clan_hint', { clan = meta.clanTag }),
            }
        end
    end

    -- [STAFF CHAT] Admins/helpers (level 1+) get a STAFF channel
    if GetResourceState('sunset_admin') == 'started' then
        local ok, isAdmin = pcall(function() return exports.sunset_admin:IsAdmin(source, 1) end)
        if ok and isAdmin == true then
            channels[#channels + 1] = {
                id = 'staff',
                label = t(source, 'chat.channel.staff'),
                placeholder = t(source, 'chat.channel.staff_hint'),
            }
        end
    end

    return channels
end

exports.sunset_core:RegisterCallback('sunset:getChatChannels', function(source)
    return buildChatChannels(source)
end)

-- /version — available to all players, no character required.
RegisterCommand('version', function(source)
    if source == 0 then
        -- console call: print directly
        local ver = GetConvar('blaze_version', '0.0.0-dev')
        print(('[Blaze] Blaze RPG v%s'):format(ver))
        return
    end
    local ver
    if GetResourceState('sunset_core') == 'started' then
        local ok, v = pcall(function() return exports.sunset_core:GetBlazeVersion() end)
        ver = (ok and type(v) == 'string' and v ~= '') and v or GetConvar('blaze_version', '0.0.0-dev')
    else
        ver = GetConvar('blaze_version', '0.0.0-dev')
    end
    local line1 = t(source, 'core.cmd.version.line1')
    local line2 = t(source, 'core.cmd.version.line2', { version = ver })
    TriggerClientEvent('sunset:chat:system', source, line1, 'info')
    TriggerClientEvent('sunset:chat:system', source, line2, 'info')
end, false)

-- /cc — staff chat wipe (level 1+). Clears every player's chat window.
RegisterCommand('cc', function(source, args)
    if source ~= 0 then
        local allowed = false
        if GetResourceState('sunset_admin') == 'started' then
            local ok, res = pcall(function() return exports.sunset_admin:IsAdmin(source, 1) end)
            allowed = ok and res == true
        end
        if not allowed then
            exports.sunset_core:CommandDenyAdmin(source, 'cc')
            return
        end
    end
    TriggerClientEvent('sunset:chat:clear', -1)
    for _, id in ipairs(GetPlayers()) do
        local recipient = tonumber(id)
        local name = source == 0 and t(recipient, 'chat.server') or (exports.sunset_core:GetPlayerDisplayName(source) or GetPlayerName(source))
        TriggerClientEvent('sunset:chat:system', recipient, t(recipient, 'chat.cleared', { name = name }), 'info')
    end
end, false)
