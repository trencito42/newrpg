local function formatPhone(raw)
    if not raw then return nil end
    local str = tostring(raw):gsub('%s+', '')
    if str:match('^%d%d%d%-%d%d%d%d$') then
        return str
    end
    local digits = str:gsub('%D', '')
    if #digits == 7 and digits:sub(1, 3) == '555' then
        return ('555-%s'):format(digits:sub(4))
    elseif #digits > 0 and #digits <= 4 then
        return ('555-%04d'):format(tonumber(digits) or 0)
    elseif #digits > 4 then
        return str
    end
    return str
end

local function getCharacterPhoneNumber(char)
    if not char then return '555-0000' end
    if char.phone_number and tostring(char.phone_number) ~= '' then
        return char.phone_number
    end
    if char.metadata and type(char.metadata) == 'table' and char.metadata.phone then
        return char.metadata.phone
    end
    local derived = ('555-%04d'):format(tonumber(char.id) or 0)
    char.phone_number = derived
    CreateThread(function()
        pcall(function()
            MySQL.update.await('UPDATE characters SET phone_number = ? WHERE id = ?', { derived, char.id })
        end)
    end)
    return derived
end

local function findCharacterByPhone(phoneQuery)
    if not phoneQuery or phoneQuery == '' then return nil end
    local normalized = formatPhone(phoneQuery)
    local rawDigits = tostring(phoneQuery):gsub('%D', '')

    -- 1. Exact match on characters.phone_number
    local row = MySQL.single.await([[
        SELECT id, firstname, lastname, phone_number
        FROM characters
        WHERE phone_number = ? OR phone_number = ? LIMIT 1
    ]], { phoneQuery, normalized })

    if row then return row end

    -- 2. If it's 555-XXXX or matches numeric ID
    local charId = tonumber(normalized:match('^555%-(%d+)$')) or tonumber(rawDigits)
    if charId and charId > 0 then
        local byId = MySQL.single.await([[
            SELECT id, firstname, lastname, phone_number
            FROM characters
            WHERE id = ? LIMIT 1
        ]], { charId })
        if byId then return byId end
    end

    return nil
end

local function findSourceByCharacterId(characterId)
    return exports.sunset_core:GetSourceByCharacterId(characterId)
end

exports.sunset_core:RegisterCallback('sunset:getPhoneData', function(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    local myCharId = tonumber(char.id)
    local myPhone = getCharacterPhoneNumber(char)

    local messages = {}
    local ok, rows = pcall(function()
        return MySQL.query.await([[
            SELECT m.id, m.message, m.created_at, m.read_at, m.sender_character_id, m.receiver_character_id,
                   m.attachment_type, m.attachment_id, m.attachment_snapshot,
                   pm.url AS media_url, pm.thumbnail_url AS media_thumb,
                   TRIM(CONCAT(COALESCE(sc.firstname,''), ' ', COALESCE(sc.lastname,''))) AS sender_name,
                   TRIM(CONCAT(COALESCE(rc.firstname,''), ' ', COALESCE(rc.lastname,''))) AS receiver_name,
                   sc.phone_number AS sender_phone, rc.phone_number AS receiver_phone
            FROM (
                (SELECT id FROM phone_messages WHERE sender_character_id = ? ORDER BY id DESC LIMIT 60)
                UNION
                (SELECT id FROM phone_messages WHERE receiver_character_id = ? ORDER BY id DESC LIMIT 60)
            ) ids
            JOIN phone_messages m ON m.id = ids.id
            LEFT JOIN phone_media pm ON m.attachment_type = 'photo' AND pm.id = m.attachment_id
            LEFT JOIN characters sc ON sc.id = m.sender_character_id
            LEFT JOIN characters rc ON rc.id = m.receiver_character_id
            ORDER BY m.id DESC LIMIT 60
        ]], { myCharId, myCharId })
    end)
    if ok and rows then
        for _, row in ipairs(rows) do
            if row.attachment_type == 'photo' then
                row.attachment = PhonePublicAttachment(row)
                if row.attachment then row.attachment.type = 'photo' end
            elseif row.attachment_type == 'location' then
                row.attachment = PhonePublicAttachment(row)
            end
            row.media_url = nil
            row.media_thumb = nil
            row.attachment_snapshot = nil
        end
        messages = rows
    end

    local onlineByChar = exports.sunset_core:GetOnlineCharacters()

    -- Load personal saved contacts
    local contacts = {}
    local contactRows = MySQL.query.await([[
        SELECT pc.id, pc.contact_name, pc.phone_number, pc.contact_character_id, pc.created_at
        FROM phone_contacts pc
        WHERE pc.character_id = ?
        ORDER BY pc.contact_name ASC
    ]], { myCharId }) or {}

    local neededAvatarIds = { myCharId }

    for _, cRow in ipairs(contactRows) do
        local targetCid = tonumber(cRow.contact_character_id)
        local isOnline = false
        local targetServerId = nil

        if targetCid then
            neededAvatarIds[#neededAvatarIds + 1] = targetCid
            if onlineByChar[targetCid] then
                isOnline = true
                targetServerId = onlineByChar[targetCid]
            end
        end

        contacts[#contacts + 1] = {
            id = cRow.id,
            name = cRow.contact_name,
            phone = cRow.phone_number,
            characterId = targetCid,
            online = isOnline,
            serverId = targetServerId,
        }
    end

    for _, msg in ipairs(messages) do
        if msg.sender_character_id then neededAvatarIds[#neededAvatarIds + 1] = tonumber(msg.sender_character_id) end
        if msg.receiver_character_id then neededAvatarIds[#neededAvatarIds + 1] = tonumber(msg.receiver_character_id) end
    end

    -- The phone UI draws initials, not stored avatar images. Do not ship base64 blobs.

    -- [SEC3] only expose the online map (character id -> server id) for the characters this
    -- phone actually shows (self, contacts, message participants), not for every online player.
    do
        local wanted, filtered = {}, {}
        for _, cid in ipairs(neededAvatarIds) do wanted[tonumber(cid) or -1] = true end
        for cid, srcId in pairs(onlineByChar or {}) do
            if wanted[tonumber(cid) or -1] then filtered[cid] = srcId end
        end
        onlineByChar = filtered
    end

    return {
        myId = source,
        myCharacterId = myCharId,
        myName = exports.sunset_core:GetPlayerBaseName(source),
        levelCostRp = math.max(1, tonumber(char.level) or 1) * 4,
        levelCostMoney = math.max(1, tonumber(char.level) or 1) * 1000,
        myPhoneNumber = myPhone,
        cash = char.cash or 0,
        bank = char.bank or 0,
        level = tonumber(char.level) or 1,
        respect = tonumber(char.respect_points) or 0,
        transactions = exports.sunset_core:GetMoneyHistory(myCharId, 30),
        messages = messages,
        contacts = contacts,
        onlineByChar = onlineByChar,
        prefs = (function()
            local ok, row = pcall(function()
                return MySQL.single.await('SELECT ringtone, notify_sound, compact_notes, voice_calls, layout FROM phone_character_prefs WHERE character_id = ?', { myCharId })
            end)
            if not ok or not row then return { ringtone = 1, notifySound = 1, compactNotes = 0, voiceCalls = true } end
            local layout = nil
            if row.layout and row.layout ~= '' then
                local decodedOk, decoded = pcall(json.decode, row.layout)
                if decodedOk and type(decoded) == 'table' then layout = decoded end
            end
            return {
                ringtone = tonumber(row.ringtone) ~= 0,
                notifySound = tonumber(row.notify_sound) ~= 0,
                compactNotes = tonumber(row.compact_notes) == 1,
                voiceCalls = row.voice_calls == nil or tonumber(row.voice_calls) ~= 0,
                layout = layout,
            }
        end)(),
        missedCalls = (function()
            local seenId = 0
            pcall(function()
                seenId = tonumber(MySQL.scalar.await(
                    'SELECT calls_seen_id FROM phone_character_prefs WHERE character_id = ?',
                    { myCharId }
                )) or 0
            end)
            local ok, n = pcall(function()
                return MySQL.scalar.await([[
                    SELECT COUNT(*) FROM phone_calls
                    WHERE callee_character_id = ? AND status = 'missed' AND id > ?
                ]], { myCharId, seenId })
            end)
            return ok and tonumber(n) or 0
        end)(),
        calls = (function()
            local okCalls, rowsCalls = pcall(function()
                return MySQL.query.await([[
                    SELECT pc.id, pc.status, pc.duration_seconds, pc.created_at,
                           CASE WHEN pc.caller_character_id = ? THEN 'out' ELSE 'in' END AS direction,
                           CASE WHEN pc.caller_character_id = ? THEN pc.callee_character_id ELSE pc.caller_character_id END AS peer_character_id,
                           CASE WHEN pc.caller_character_id = ? THEN kc.phone_number ELSE cc.phone_number END AS peer_phone,
                           CASE WHEN pc.caller_character_id = ? THEN TRIM(CONCAT(COALESCE(kc.firstname,''),' ',COALESCE(kc.lastname,'')))
                                ELSE TRIM(CONCAT(COALESCE(cc.firstname,''),' ',COALESCE(cc.lastname,''))) END AS peer_name
                    FROM phone_calls pc
                    LEFT JOIN characters cc ON cc.id = pc.caller_character_id
                    LEFT JOIN characters kc ON kc.id = pc.callee_character_id
                    WHERE pc.caller_character_id = ? OR pc.callee_character_id = ?
                    ORDER BY pc.id DESC
                    LIMIT 40
                ]], { myCharId, myCharId, myCharId, myCharId, myCharId, myCharId })
            end)
            if okCalls and rowsCalls then return rowsCalls end
            return {}
        end)(),
    }
end)

exports.sunset_core:RegisterCallback('sunset:phoneAddContact', function(source, name, rawPhone)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    rawPhone = tostring(rawPhone or ''):sub(1, 24):gsub('^%s*(.-)%s*$', '%1') -- [SEC3] bound client strings
    name = tostring(name or ''):sub(1, 96):gsub('^%s*(.-)%s*$', '%1')
    if not exports.sunset_core:RateLimit(source, 'phoneAddContact', 800) then
        return nil, { localeKey = 'phone.message.database_error_while_saving_contact' }
    end

    if rawPhone == '' then
        return nil, { localeKey = 'phone.message.please_enter_a_valid_phone_number' }
    end

    local myPhone = getCharacterPhoneNumber(char)
    local formatted = formatPhone(rawPhone)

    if formatted == myPhone or formatted == tostring(char.id) then
        return nil, { localeKey = 'phone.message.you_cannot_add_your_own_phone_number' }
    end

    -- Resolve character if exists
    local matchedChar = findCharacterByPhone(rawPhone)
    local contactCharId = matchedChar and tonumber(matchedChar.id) or nil

    if not name or name == '' then
        if matchedChar then
            name = exports.sunset_core:FormatPublicName(matchedChar.firstname, matchedChar.lastname)
            if name == '' then name = 'Contact ' .. formatted end
        else
            name = 'Contact ' .. formatted
        end
    end
    name = tostring(name):match('^%s*(.-)%s*$') or name

    if #name > 48 then
        name = name:sub(1, 48)
    end

    local ok, insertId = pcall(function()
        return MySQL.insert.await([[
            INSERT INTO phone_contacts (character_id, contact_name, phone_number, contact_character_id)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                contact_name = VALUES(contact_name),
                contact_character_id = VALUES(contact_character_id)
        ]], { tonumber(char.id), name, formatted, contactCharId })
    end)

    if not ok then
        return nil, { localeKey = 'phone.message.database_error_while_saving_contact' }
    end

    local isOnline = (contactCharId and findSourceByCharacterId(contactCharId) ~= nil) or false

    -- [QUESTS] social chain: adding another player as contact.
    if contactCharId then
        TriggerEvent('sunset:quest:progress', tonumber(char.id), 'contact_added', 1)
    end

    return {
        ok = true,
        contact = {
            id = insertId,
            name = name,
            phone = formatted,
            characterId = contactCharId,
            online = isOnline,
        }
    }
end)

exports.sunset_core:RegisterCallback('sunset:phoneDeleteContact', function(source, contactId)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    contactId = tonumber(contactId)
    if not contactId then return nil, { localeKey = 'phone.message.invalid_contact_id' } end

    local affected = MySQL.update.await([[
        DELETE FROM phone_contacts
        WHERE id = ? AND character_id = ?
    ]], { contactId, tonumber(char.id) })

    if not affected or affected < 1 then
        return nil, { localeKey = 'phone.message.contact_not_found_or_already_deleted' }
    end

    return { ok = true }
end)

exports.sunset_core:RegisterCallback('sunset:phoneSend', function(source, targetCharacterId, message, targetPhoneNumber, location, attachment)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'phone.message.no_character' } end

    targetCharacterId = tonumber(targetCharacterId)
    if (not targetCharacterId or targetCharacterId == 0) and targetPhoneNumber then
        local resolved = findCharacterByPhone(targetPhoneNumber)
        if resolved then
            targetCharacterId = tonumber(resolved.id)
        end
    end

    message = tostring(message or ''):gsub('^%s+', ''):gsub('%s+$', ''):sub(1, 256)
    if targetPhoneNumber ~= nil then targetPhoneNumber = tostring(targetPhoneNumber):sub(1, 24) end -- [SEC3]
    local resolvedAttachment = nil
    if type(attachment) == 'table' and (attachment.type == 'photo' or attachment.type == 'location') then
        local resolved, attachErr = PhoneResolveAttachment(source, tonumber(char.id), attachment)
        if not resolved then return nil, attachErr or { localeKey = 'phone.message.photo_upload_failed' } end
        resolvedAttachment = resolved
    end
    if message == '' and not resolvedAttachment then return nil, { localeKey = 'phone.message.invalid_recipient_or_message' } end
    if not targetCharacterId then return nil, { localeKey = 'phone.message.invalid_recipient_or_message' } end
    -- [SEC2] SMS/112 spam throttle (112 creates a dispatch call for police/EMS)
    local isEmergencyTarget = targetCharacterId == -112 or tostring(targetPhoneNumber) == '112'
    if not exports.sunset_core:RateLimit(source, isEmergencyTarget and 'phone112' or 'phoneSend', isEmergencyTarget and 15000 or 700) then
        return nil, { localeKey = 'error.too_many_requests' }
    end

    -- Handle 112 Emergency dispatch messaging
    if targetCharacterId == -112 or tostring(targetPhoneNumber) == '112' then
        location = type(location) == 'table' and location or {}
        local street = tostring(location.street or 'Unknown street'):sub(1, 80)
        local area = tostring(location.area or 'Los Santos'):sub(1, 80)

        local dispatchOk, dispatchResult, dispatchErr = pcall(function()
            return exports.sunset_dispatch:Create112Call(source, 'emergency', message, street, area)
        end)
        if not dispatchOk then
            print(('[sunset_phone] 112 SMS dispatch error for character %s: %s'):format(char.id, tostring(dispatchResult)))
            return nil, { localeKey = 'phone.message.the_112_dispatch_is_currently_unavailable_the_message_was' }
        end
        if not dispatchResult or not dispatchResult.ok then
            return nil, dispatchErr or exports.sunset_core:TFor(source, 'phone.err.the_112_call_could_not_be')
        end

        -- Character id 0 is reserved for system messages. The columns are
        -- UNSIGNED, so the former -112 sentinel could never be persisted.
        local reply = exports.sunset_core:TFor(source, 'phone.msg.dispatch_ack', { id = tostring(dispatchResult.callId or '') })
        local historyOk, historyErr = pcall(function()
            MySQL.insert.await(
                'INSERT INTO phone_messages (sender_character_id, receiver_character_id, message) VALUES (?, ?, ?)',
                { tonumber(char.id), 0, message }
            )
            MySQL.insert.await(
                'INSERT INTO phone_messages (sender_character_id, receiver_character_id, message) VALUES (?, ?, ?)',
                { 0, tonumber(char.id), reply }
            )
        end)
        if not historyOk then
            print(('[sunset_phone] 112 SMS history error for character %s: %s'):format(char.id, tostring(historyErr)))
        end

        TriggerClientEvent('sunset:client:phoneMessage', source)
        return { ok = true, emergency = true, callId = dispatchResult.callId }
    end

    if targetCharacterId == tonumber(char.id) then return nil, { localeKey = 'phone.message.cannot_message_yourself' } end

    local exists = MySQL.scalar.await('SELECT id FROM characters WHERE id = ?', { targetCharacterId })
    if not exists then return nil, { localeKey = 'phone.message.player_character_not_found' } end

    local msgId
    if resolvedAttachment then
        msgId = MySQL.insert.await([[
            INSERT INTO phone_messages
                (sender_character_id, receiver_character_id, message, attachment_type, attachment_id, attachment_snapshot)
            VALUES (?, ?, ?, ?, ?, ?)
        ]], {
            tonumber(char.id), targetCharacterId, message,
            resolvedAttachment.type, resolvedAttachment.id, resolvedAttachment.snapshot,
        })
    else
        msgId = MySQL.insert.await(
            'INSERT INTO phone_messages (sender_character_id, receiver_character_id, message) VALUES (?, ?, ?)',
            { tonumber(char.id), targetCharacterId, message }
        )
    end

    local msgPayload = {
        id = msgId,
        sender_character_id = tonumber(char.id),
        receiver_character_id = targetCharacterId,
        message = message,
        created_at = os.date('!%Y-%m-%dT%H:%M:%SZ'),
        sender_name = exports.sunset_core:GetPlayerBaseName(source),
        sender_phone = getCharacterPhoneNumber(char),
        attachment = resolvedAttachment and resolvedAttachment.public or nil,
    }

    local targetSource = findSourceByCharacterId(targetCharacterId)
    if targetSource then
        TriggerClientEvent('sunset:chat:message', targetSource, {
            id = source,
            name = exports.sunset_core:GetPlayerBaseName(source),
            message = '',
            time = os.date('%H:%M:%S'),
            type = 'sms',
            smsNotify = true,
        })
        TriggerClientEvent('sunset:client:phoneNewMessage', targetSource, msgPayload)
    end
    TriggerClientEvent('sunset:client:phoneNewMessage', source, msgPayload)

    return { ok = true, message = msgPayload }
end)

exports.sunset_core:RegisterCallback('sunset:phoneMarkCallsSeen', function(source, callId)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    callId = tonumber(callId) or 0
    if callId < 1 then return { ok = true } end
    local ok = pcall(function()
        MySQL.update.await([[
            INSERT INTO phone_character_prefs (character_id, calls_seen_id) VALUES (?, ?)
            ON DUPLICATE KEY UPDATE calls_seen_id = GREATEST(COALESCE(calls_seen_id, 0), VALUES(calls_seen_id))
        ]], { tonumber(char.id), callId })
    end)
    if not ok then return nil, { localeKey = 'error.server_action_failed' } end
    return { ok = true, callsSeenId = callId }
end)
