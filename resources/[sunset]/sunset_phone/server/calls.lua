PhoneCalls = {
    byId = {},
    bySource = {},
    nextId = 1,
}

local RING_MS = 30000

local function formatPhone(raw)
    if not raw then return nil end
    local str = tostring(raw):gsub('%s+', '')
    if str:match('^%d%d%d%-%d%d%d%d$') then return str end
    local digits = str:gsub('%D', '')
    if #digits == 7 and digits:sub(1, 3) == '555' then
        return ('555-%s'):format(digits:sub(4))
    elseif #digits > 0 and #digits <= 4 then
        return ('555-%04d'):format(tonumber(digits) or 0)
    end
    return str
end

local function findCharacterByPhone(phoneQuery)
    if not phoneQuery or phoneQuery == '' then return nil end
    local normalized = formatPhone(phoneQuery)
    local rawDigits = tostring(phoneQuery):gsub('%D', '')
    local row = MySQL.single.await([[
        SELECT id, firstname, lastname, phone_number
        FROM characters
        WHERE phone_number = ? OR phone_number = ?
        LIMIT 1
    ]], { tostring(phoneQuery), normalized })
    if row then return row end
    local charId = tonumber(tostring(normalized):match('^555%-(%d+)$')) or tonumber(rawDigits)
    if charId and charId > 0 and #rawDigits <= 7 then
        return MySQL.single.await([[
            SELECT id, firstname, lastname, phone_number
            FROM characters WHERE id = ? LIMIT 1
        ]], { charId })
    end
    return nil
end

local function displayName(row)
    if not row then return '' end
    return exports.sunset_core:FormatPublicName(row.firstname, row.lastname)
end

local function phoneOf(row, characterId)
    if row and row.phone_number and tostring(row.phone_number) ~= '' then
        return row.phone_number
    end
    return ('555-%04d'):format(tonumber(characterId) or 0)
end

local function push(src, payload)
    src = tonumber(src)
    if not src or not GetPlayerName(src) then return end
    TriggerClientEvent('sunset:client:phoneCall', src, payload)
end

local function voiceCallsEnabled(src)
    local okChar, char = pcall(function() return exports.sunset_core:GetCharacter(src) end)
    if not okChar or type(char) ~= 'table' or not char.id then return true end
    local ok, row = pcall(function()
        return MySQL.single.await('SELECT voice_calls FROM phone_character_prefs WHERE character_id = ?', { char.id })
    end)
    if not ok or not row or row.voice_calls == nil then return true end
    return tonumber(row.voice_calls) ~= 0
end

local function pmaUp()
    return GetResourceState('pma-voice') == 'started'
end

local function setPmaCall(src, channel)
    src = tonumber(src)
    if not src or src < 1 or not pmaUp() then return false end
    local ok = pcall(function()
        exports['pma-voice']:setPlayerCall(src, tonumber(channel) or 0)
    end)
    return ok
end

local function voiceOn(call, src)
    if not call or not src then return false end
    if src == call.caller then return call.callerVoice == true end
    if src == call.callee then return call.calleeVoice == true end
    return false
end

local function setVoiceOn(call, src, enabled)
    local on = enabled == true
    if src == call.caller then call.callerVoice = on
    elseif src == call.callee then call.calleeVoice = on end
end

local function syncParticipantVoice(call, src)
    if not pmaUp() then
        setVoiceOn(call, src, false)
        return false
    end
    if voiceOn(call, src) then
        if not setPmaCall(src, call.channel) then
            setVoiceOn(call, src, false)
            return false
        end
        return true
    end
    setPmaCall(src, 0)
    return true
end

local function clearCallVoice(call)
    setPmaCall(call.caller, 0)
    setPmaCall(call.callee, 0)
    call.callerVoice = false
    call.calleeVoice = false
end

local function peerBound(call, peer, peerCharacterId)
    peer = tonumber(peer)
    if not peer or peer < 1 or not GetPlayerName(peer) then return false end
    if PhoneCalls.bySource[peer] ~= call.id then return false end
    local ok, char = pcall(function() return exports.sunset_core:GetCharacter(peer) end)
    if ok and type(char) == 'table' and tonumber(char.id) and tonumber(char.id) ~= tonumber(peerCharacterId) then
        return false
    end
    return true
end

function GetActiveCallContext(source)
    source = tonumber(source)
    local id = source and PhoneCalls.bySource[source]
    local call = id and PhoneCalls.byId[id]
    if not call or call.ended or call.state ~= 'active' then return nil end
    if call.caller ~= source and call.callee ~= source then return nil end
    local peer = call.caller == source and call.callee or call.caller
    local peerName = call.caller == source and call.calleeName or call.callerName
    local peerPhone = call.caller == source and call.calleePhone or call.callerPhone
    local peerCharacterId = call.caller == source and call.calleeCharacterId or call.callerCharacterId
    if not peerBound(call, peer, peerCharacterId) then
        PhoneCalls.endForSource(source, 'disconnect')
        return { active = false, ended = true }
    end
    return {
        active = true,
        callId = call.id,
        peerSource = peer,
        peerCharacterId = peerCharacterId,
        peerName = peerName,
        peerPhone = peerPhone,
    }
end
exports('GetActiveCallContext', GetActiveCallContext)

local function payloadFor(call, src, state, reason)
    local role = (src == call.caller) and 'caller' or 'callee'
    local peerName = role == 'caller' and call.calleeName or call.callerName
    local peerPhone = role == 'caller' and call.calleePhone or call.callerPhone
    local peerCharacterId = role == 'caller' and call.calleeCharacterId or call.callerCharacterId
    return {
        callId = call.id,
        role = role,
        state = state,
        reason = reason,
        peerName = peerName,
        peerPhone = peerPhone,
        peerCharacterId = peerCharacterId,
        startedAt = call.answeredAt,
        duration = call.duration or 0,
    }
end

local function pushActive(call)
    if not call or call.ended or call.state ~= 'active' then return end
    local available = pmaUp()
    if not available then
        call.callerVoice = false
        call.calleeVoice = false
    end
    local function one(src)
        if not src then return end
        local body = payloadFor(call, src, 'ACTIVE')
        local peer = src == call.caller and call.callee or call.caller
        body.voiceAvailable = available
        body.myVoiceEnabled = available and voiceOn(call, src)
        body.peerVoiceEnabled = available and voiceOn(call, peer)
        push(src, body)
    end
    one(call.caller)
    if call.callee ~= call.caller then one(call.callee) end
end

function PhoneCalls.applySavedVoice(src, enabled)
    src = tonumber(src)
    local id = src and PhoneCalls.bySource[src]
    local call = id and PhoneCalls.byId[id]
    if not call or call.ended or call.state ~= 'active' then return end
    if not pmaUp() then
        setVoiceOn(call, src, false)
    else
        setVoiceOn(call, src, enabled == true)
        syncParticipantVoice(call, src)
    end
    pushActive(call)
end

local function logCall(call, status)
    pcall(function()
        MySQL.insert.await([[
            INSERT INTO phone_calls (caller_character_id, callee_character_id, status, duration_seconds)
            VALUES (?, ?, ?, ?)
        ]], {
            call.callerCharacterId,
            call.calleeCharacterId,
            tostring(status):sub(1, 16),
            tonumber(call.duration) or 0,
        })
    end)
end

function PhoneCalls.finish(call, status)
    if not call or call.ended then return end
    local wasActive = call.state == 'active'
    call.ended = true
    call.duration = 0
    if call.answeredAt then
        call.duration = math.max(0, os.time() - call.answeredAt)
    end
    PhoneCalls.byId[call.id] = nil
    if PhoneCalls.bySource[call.caller] == call.id then PhoneCalls.bySource[call.caller] = nil end
    if PhoneCalls.bySource[call.callee] == call.id then PhoneCalls.bySource[call.callee] = nil end
    clearCallVoice(call)

    local callerState, calleeState = 'ENDED', 'ENDED'
    local reason = status
    if status == 'busy' then
        callerState = 'BUSY'
    elseif status == 'unavailable' or status == 'invalid' then
        callerState = status == 'invalid' and 'FAILED' or 'UNAVAILABLE'
    elseif status == 'declined' then
        callerState = 'DECLINED'
        calleeState = 'ENDED'
    elseif status == 'missed' then
        callerState = 'FAILED'
        calleeState = 'ENDED'
        reason = 'no_answer'
    elseif status == 'cancelled' then
        callerState = 'ENDED'
        calleeState = 'ENDED'
    end

    if call.caller then push(call.caller, payloadFor(call, call.caller, callerState, reason)) end
    if call.callee and status ~= 'busy' and status ~= 'unavailable' and status ~= 'invalid' then
        push(call.callee, payloadFor(call, call.callee, calleeState, reason))
    end
    if call.callerCharacterId and call.calleeCharacterId then
        logCall(call, status)
    end

    if wasActive then
        local ended = 'chat.phone.ended'
        if call.caller then
            TriggerClientEvent('sunset:chat:system', call.caller, exports.sunset_core:TFor(call.caller, ended), 'info')
        end
        if call.callee and call.callee ~= call.caller then
            TriggerClientEvent('sunset:chat:system', call.callee, exports.sunset_core:TFor(call.callee, ended), 'info')
        end
    end

    if status == 'missed' and call.callee then
        pcall(function()
            exports.sunset_core:NotifyFor(call.callee, 'phone.call.missed', { name = call.callerName or call.callerPhone }, 'info', 5000)
        end)
    end
end

function PhoneCalls.endForSource(src, status)
    src = tonumber(src)
    local id = src and PhoneCalls.bySource[src]
    local call = id and PhoneCalls.byId[id]
    if not call then return end
    local logged = status or 'disconnect'
    if call.state == 'ringing' and src == call.callee then
        logged = 'missed'
    elseif call.state == 'ringing' and src == call.caller then
        logged = 'cancelled'
    elseif call.state ~= 'active' then
        logged = logged or 'disconnect'
    else
        logged = 'answered'
    end
    PhoneCalls.finish(call, logged)
end

local function beginRing(call)
    local id = call.id
    CreateThread(function()
        Wait(RING_MS)
        local current = PhoneCalls.byId[id]
        if current and not current.ended and current.state == 'ringing' then
            PhoneCalls.finish(current, 'missed')
        end
    end)
end

exports.sunset_core:RegisterCallback('sunset:phoneCallStart', function(source, rawPhone)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    if not exports.sunset_core:RateLimit(source, 'phoneCallStart', 1200) then
        return nil, { localeKey = 'phone.call.busy' }
    end
    if PhoneCalls.bySource[source] then
        return nil, { localeKey = 'phone.call.in_call' }
    end

    rawPhone = tostring(rawPhone or ''):sub(1, 24)
    if rawPhone == '112' then
        return { ok = false, special = '112' }
    end

    local target = findCharacterByPhone(rawPhone)
    if not target or not tonumber(target.id) then
        return nil, { localeKey = 'phone.call.invalid_number' }
    end
    local targetId = tonumber(target.id)
    if targetId == tonumber(char.id) then
        return nil, { localeKey = 'phone.call.invalid_number' }
    end

    local targetSource = exports.sunset_core:GetSourceByCharacterId(targetId)
    local callerPhone = char.phone_number
    if not callerPhone or callerPhone == '' then
        callerPhone = ('555-%04d'):format(tonumber(char.id) or 0)
    end

    if not targetSource or not GetPlayerName(targetSource) then
        logCall({
            callerCharacterId = tonumber(char.id),
            calleeCharacterId = targetId,
            duration = 0,
        }, 'unavailable')
        push(source, {
            state = 'UNAVAILABLE',
            reason = 'unavailable',
            peerName = displayName(target),
            peerPhone = phoneOf(target, targetId),
            peerCharacterId = targetId,
        })
        return { ok = false, state = 'UNAVAILABLE' }
    end

    if PhoneCalls.bySource[targetSource] then
        logCall({
            callerCharacterId = tonumber(char.id),
            calleeCharacterId = targetId,
            duration = 0,
        }, 'busy')
        push(source, {
            state = 'BUSY',
            reason = 'busy',
            peerName = displayName(target),
            peerPhone = phoneOf(target, targetId),
            peerCharacterId = targetId,
        })
        return { ok = false, state = 'BUSY' }
    end

    local id = PhoneCalls.nextId
    PhoneCalls.nextId = id + 1
    local call = {
        id = id,
        state = 'ringing',
        caller = source,
        callee = targetSource,
        callerCharacterId = tonumber(char.id),
        calleeCharacterId = targetId,
        callerName = exports.sunset_core:GetPlayerBaseName(source),
        calleeName = displayName(target),
        callerPhone = callerPhone,
        calleePhone = phoneOf(target, targetId),
        channel = 100000 + id,
    }
    PhoneCalls.byId[id] = call
    PhoneCalls.bySource[source] = id
    PhoneCalls.bySource[targetSource] = id
    push(source, payloadFor(call, source, 'OUTGOING_RINGING'))
    push(targetSource, payloadFor(call, targetSource, 'INCOMING_RINGING'))
    beginRing(call)
    return { ok = true, callId = id, state = 'OUTGOING_RINGING' }
end)

exports.sunset_core:RegisterCallback('sunset:phoneCallAnswer', function(source)
    local id = PhoneCalls.bySource[source]
    local call = id and PhoneCalls.byId[id]
    if not call or call.ended or call.state ~= 'ringing' or call.callee ~= source then
        return nil, { localeKey = 'phone.call.ended' }
    end
    call.state = 'active'
    call.answeredAt = os.time()
    call.callerVoice = voiceCallsEnabled(call.caller)
    call.calleeVoice = voiceCallsEnabled(call.callee)
    if pmaUp() then
        syncParticipantVoice(call, call.caller)
        syncParticipantVoice(call, call.callee)
    else
        call.callerVoice = false
        call.calleeVoice = false
    end
    pushActive(call)
    TriggerClientEvent('sunset:chat:system', call.caller, exports.sunset_core:TFor(call.caller, 'chat.phone.connected', { name = call.calleeName or call.calleePhone or '' }), 'info')
    TriggerClientEvent('sunset:chat:system', call.callee, exports.sunset_core:TFor(call.callee, 'chat.phone.connected', { name = call.callerName or call.callerPhone or '' }), 'info')
    return { ok = true, state = 'ACTIVE', callId = call.id }
end)

exports.sunset_core:RegisterCallback('sunset:phoneCallDecline', function(source)
    local id = PhoneCalls.bySource[source]
    local call = id and PhoneCalls.byId[id]
    if not call or call.ended then return { ok = true } end
    if call.state == 'ringing' and call.callee == source then
        PhoneCalls.finish(call, 'declined')
        return { ok = true }
    end
    if call.caller == source and call.state == 'ringing' then
        PhoneCalls.finish(call, 'cancelled')
        return { ok = true }
    end
    PhoneCalls.finish(call, call.state == 'active' and 'answered' or 'cancelled')
    return { ok = true }
end)

exports.sunset_core:RegisterCallback('sunset:phoneCallSetVoice', function(source, enabled)
    if not exports.sunset_core:RateLimit(source, 'phoneCallSetVoice', 400) then
        return nil, { localeKey = 'error.too_many_requests' }
    end
    local id = PhoneCalls.bySource[source]
    local call = id and PhoneCalls.byId[id]
    if not call or call.ended or call.state ~= 'active' or (call.caller ~= source and call.callee ~= source) then
        return nil, { localeKey = 'phone.call.ended' }
    end
    if not pmaUp() then
        setVoiceOn(call, source, false)
        pushActive(call)
        return { ok = true, voiceAvailable = false, myVoiceEnabled = false }
    end
    setVoiceOn(call, source, enabled == true)
    syncParticipantVoice(call, source)
    pushActive(call)
    return { ok = true, voiceAvailable = pmaUp(), myVoiceEnabled = voiceOn(call, source) }
end)

exports.sunset_core:RegisterCallback('sunset:phoneCallHangup', function(source)
    local id = PhoneCalls.bySource[source]
    local call = id and PhoneCalls.byId[id]
    if not call or call.ended then return { ok = true } end
    if call.state == 'ringing' and call.caller == source then
        PhoneCalls.finish(call, 'cancelled')
    elseif call.state == 'ringing' and call.callee == source then
        PhoneCalls.finish(call, 'declined')
    else
        PhoneCalls.finish(call, 'answered')
    end
    return { ok = true }
end)

RegisterNetEvent('sunset:phone:forceEnd', function()
    local src = source
    if not exports.sunset_core:RateLimit(src, 'phoneForceEnd', 800) then return end
    PhoneCalls.endForSource(src, 'disconnect')
end)

AddEventHandler('playerDropped', function()
    PhoneCalls.endForSource(source, 'disconnect')
end)

AddEventHandler('sunset:death:playerDowned', function(src)
    PhoneCalls.endForSource(tonumber(src), 'unavailable')
end)

AddEventHandler('sunset:server:characterSelected', function(src)
    PhoneCalls.endForSource(tonumber(src), 'disconnect')
end)

AddEventHandler('onResourceStop', function(res)
    if res == 'pma-voice' then
        for _, call in pairs(PhoneCalls.byId) do
            if call and not call.ended and call.state == 'active' then
                call.callerVoice = false
                call.calleeVoice = false
                pushActive(call)
            end
        end
        return
    end
    if res ~= GetCurrentResourceName() then return end
    local pending = {}
    for _, call in pairs(PhoneCalls.byId) do pending[#pending + 1] = call end
    for i = 1, #pending do
        PhoneCalls.finish(pending[i], 'disconnect')
    end
end)
