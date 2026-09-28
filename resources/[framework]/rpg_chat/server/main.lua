local rates = {}
local MAX_LENGTH = 280

local function cleanMessage(value)
    if type(value) ~= 'string' then return nil end
    value = value:gsub('[%z\1-\8\11\12\14-\31]', ''):match('^%s*(.-)%s*$') or ''
    if value == '' or #value > MAX_LENGTH then return nil end
    return value
end

local function rateAllowed(src)
    local now = GetGameTimer()
    local state = rates[src]
    if not state or now - state.startedAt >= 5000 then
        rates[src] = { startedAt = now, count = 1 }
        return true
    end
    if state.count >= 5 then return false end
    state.count = state.count + 1
    return true
end

RegisterNetEvent('rpg:chat:submit', function(raw)
    local src = source
    if not exports.rpg_core:IsPlayerActive(src) then
        exports.rpg_core:Notify(src, 'Chat is available after spawn.', 'warning')
        return
    end
    if not rateAllowed(src) then
        exports.rpg_core:Notify(src, 'You are sending messages too quickly.', 'warning')
        return
    end
    local message = cleanMessage(raw)
    if not message then
        exports.rpg_core:Notify(src, ('Messages must be 1-%d characters.'):format(MAX_LENGTH), 'error')
        return
    end
    if message:sub(1, 1) == '/' then
        exports.rpg_core:DispatchCommand(src, message)
        return
    end
    local username = exports.rpg_core:GetUsername(src)
    if not username then return end
    local rendered = ('%s (%d): %s'):format(username, src, message)
    for _, rawTarget in ipairs(GetPlayers()) do
        local target = tonumber(rawTarget)
        if target and exports.rpg_core:IsPlayerActive(target) then
            TriggerClientEvent('rpg:chat:message', target, rendered, 'normal')
        end
    end
end)

AddEventHandler('playerDropped', function() rates[source] = nil end)

