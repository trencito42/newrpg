-- One pending chat attachment per player. The snapshot is produced by sunset_inventory.
-- Staff and admin chat never receive it. The pending entry expires so a failed
-- command cannot decorate a later message.

local Pending = {}
local LINK_COMMANDS = {
    me = true, ['do'] = true, b = true, s = true, shout = true,
    w = true, whisper = true, ooc = true, f = true, r = true, d = true,
    c = true, ad = true, low = true,
}
local BLOCKED_TYPES = {
    staff_chat = true, admin_chat = true, admin_action = true,
    command_error = true, command_warn = true, command_info = true,
}

local function clear(source)
    Pending[tonumber(source)] = nil
end

local function peek(source)
    local row = Pending[tonumber(source)]
    if not row then return nil end
    if GetGameTimer() - row.at > 4000 then
        clear(source)
        return nil
    end
    return row.snap
end

function ClearChatAttachment(source)
    clear(source)
end
exports('ClearChatAttachment', ClearChatAttachment)

function PeekChatAttachment(source)
    return peek(source)
end
exports('PeekChatAttachment', PeekChatAttachment)

function QueueChatAttachment(source, raw)
    clear(source)
    if GetResourceState('sunset_inventory') ~= 'started' then
        return nil, { localeKey = 'inventory.message.invalid_trade_asset' }
    end
    local snap, err = exports.sunset_inventory:ResolveChatAttachment(source, raw)
    if not snap then return nil, err or { localeKey = 'inventory.message.invalid_trade_asset' } end
    Pending[tonumber(source)] = { snap = snap, at = GetGameTimer() }
    return snap
end
exports('QueueChatAttachment', QueueChatAttachment)

function ApplyChatAttachment(source, payload)
    if type(payload) ~= 'table' or BLOCKED_TYPES[payload.type] then return payload end
    if payload.attachment then return payload end
    local snap = peek(source)
    if snap then payload.attachment = snap end
    return payload
end
exports('ApplyChatAttachment', ApplyChatAttachment)

function BeginChatAttachment(source, line, attachment)
    if type(attachment) ~= 'table' then
        clear(source)
        return true
    end
    local cmd = tostring(line or ''):match('^(%S+)')
    cmd = cmd and cmd:lower() or ''
    if not LINK_COMMANDS[cmd] then
        clear(source)
        TriggerClientEvent('sunset:chat:system', source, exports.sunset_core:TFor(source, 'asset.message.not_on_this_channel'), 'warning')
        return true
    end
    local snap, err = QueueChatAttachment(source, { type = attachment.type, id = attachment.id })
    if not snap then
        local message = exports.sunset_core:TFor(source, (type(err) == 'table' and err.localeKey) or 'inventory.message.invalid_trade_asset')
        TriggerClientEvent('sunset:chat:system', source, message, 'error')
        return false
    end
    return true
end
exports('BeginChatAttachment', BeginChatAttachment)

AddEventHandler('playerDropped', function()
    clear(source)
end)
