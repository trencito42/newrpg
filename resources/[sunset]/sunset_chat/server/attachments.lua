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

local function peekRow(source)
    local row = Pending[tonumber(source)]
    if not row then return nil end
    if GetGameTimer() - row.at > 4000 then
        clear(source)
        return nil
    end
    return row
end

local function peek(source)
    local row = peekRow(source)
    return row and row.snap or nil
end

function NormalizeRichText(raw, maxPoints, index)
    if type(raw) ~= 'string' then return nil, nil end
    local text = raw:gsub('[%z\1-\8\11\12\14-\31\127]', '')
    local lead = text:match('^(%s*)') or ''
    local leadPoints = utf8.len(lead)
    if not leadPoints then
        lead = ''
        leadPoints = 0
    end
    text = text:match('^%s*(.-)%s*$') or ''
    if utf8.len(text) == nil then
        text = text:gsub('[\128-\255]', '')
    end
    local len = utf8.len(text) or 0
    maxPoints = math.floor(tonumber(maxPoints) or 250)
    if maxPoints < 1 then maxPoints = 250 end
    if len > maxPoints then
        local bound = utf8.offset(text, maxPoints + 1)
        if bound then text = text:sub(1, bound - 1) end
        len = utf8.len(text) or maxPoints
    end
    if text == '' then return nil, nil end
    index = math.floor(tonumber(index) or len)
    index = index - leadPoints
    if index < 0 then index = 0 end
    if index > len then index = len end
    return text, index
end
exports('NormalizeRichText', NormalizeRichText)

local function commandBody(line, index)
    line = tostring(line or '')
    local rest = line:match('^%S+%s*(.*)$') or ''
    local prefixBytes = #line - #rest
    local prefix = prefixBytes > 0 and line:sub(1, prefixBytes) or ''
    local points = utf8.len(prefix) or prefixBytes
    return rest, math.floor(tonumber(index) or 0) - points
end

local function dropTokens(text, index, count)
    local rest = tostring(text or '')
    local removed = 0
    for _ = 1, math.floor(tonumber(count) or 0) do
        local token, spaces, tail = rest:match('^(%S+)(%s*)(.*)$')
        if not token then break end
        removed = removed + (utf8.len(token .. spaces) or #(token .. spaces))
        rest = tail or ''
    end
    return rest, math.floor(tonumber(index) or 0) - removed
end

function ClearChatAttachment(source)
    clear(source)
end
exports('ClearChatAttachment', ClearChatAttachment)

function PeekChatAttachment(source)
    local row = peekRow(source)
    if not row then return nil, nil end
    return row.snap, row.index
end
exports('PeekChatAttachment', PeekChatAttachment)

function ResolveLinkedText(source, args, skipTokens)
    local row = peekRow(source)
    local raw
    local index
    if row and type(row.line) == 'string' and row.line ~= '' then
        raw, index = commandBody(row.line, row.index)
        if skipTokens and skipTokens > 0 then
            raw, index = dropTokens(raw, index, skipTokens)
        end
    else
        raw = table.concat(args or {}, ' ', (math.floor(tonumber(skipTokens) or 0) + 1))
        index = row and row.index or nil
    end
    local text, clamped = NormalizeRichText(raw, 250, index)
    if row then row.index = clamped end
    return text
end
exports('ResolveLinkedText', ResolveLinkedText)

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
    local row = peekRow(source)
    if row and row.snap then
        payload.attachment = row.snap
        payload.attachmentIndex = row.index
    end
    return payload
end
exports('ApplyChatAttachment', ApplyChatAttachment)

function BeginChatAttachment(source, line, attachment, attachmentIndex)
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
    local row = Pending[tonumber(source)]
    if row then
        row.line = tostring(line or '')
        row.index = math.floor(tonumber(attachmentIndex) or 0)
        if row.index < 0 then row.index = 0 end
    end
    return true
end
exports('BeginChatAttachment', BeginChatAttachment)

AddEventHandler('playerDropped', function()
    clear(source)
end)
