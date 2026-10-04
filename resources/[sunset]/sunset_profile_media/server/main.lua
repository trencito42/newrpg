local TokenCooldown = {}

local ALLOWED_MEDIA = {
    player_avatar = true,
    vehicle_preview = true,
    phone_photo = true,
}

local function issueLedgerToken(accountId, characterId, mediaType, entityId)
    mediaType = tostring(mediaType or '')
    if not ALLOWED_MEDIA[mediaType] then return nil, 'media_type' end
    characterId = tonumber(characterId)
    if not characterId then return nil, 'no_character' end
    local token = MySQL.scalar.await('SELECT LOWER(HEX(RANDOM_BYTES(32)))')
    if type(token) ~= 'string' or not token:match('^[0-9a-f]+$') or #token < 64 then
        return nil, 'token'
    end
    local ttl = (Config.PhoneMedia and Config.PhoneMedia.TokenTtlSec) or 90
    MySQL.insert.await([[
        INSERT INTO media_upload_tokens
            (token_hash, account_id, character_id, media_type, entity_id, expires_at)
        VALUES (SHA2(?, 256), ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))
    ]], { token, tonumber(accountId), characterId, mediaType, tonumber(entityId), ttl })
    return token, os.time() + ttl
end

local function IssueUploadToken(source, mediaType, entityId)
    local player = exports.sunset_core:GetPlayer(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not player or not char then return nil, 'no_character' end
    mediaType = tostring(mediaType or '')
    if not ALLOWED_MEDIA[mediaType] then return nil, 'media_type' end
    local waitMs = (Config.PhoneMedia and Config.PhoneMedia.CaptureCooldownMs) or 1500
    local now = GetGameTimer()
    local key = tostring(source) .. ':' .. mediaType
    if TokenCooldown[key] and now - TokenCooldown[key] < waitMs then
        return nil, 'cooldown'
    end
    TokenCooldown[key] = now
    local boundEntity = tonumber(entityId)
    if mediaType == 'player_avatar' then boundEntity = tonumber(player.account_id) end
    if mediaType == 'phone_photo' then boundEntity = tonumber(char.id) end
    local token, expires = issueLedgerToken(tonumber(player.account_id), tonumber(char.id), mediaType, boundEntity)
    if not token then return nil, expires or 'token' end
    return {
        token = token,
        uploadUrl = Config.UploadEndpoint,
        mediaType = mediaType,
        expires = expires,
    }
end

-- Marks an uploaded phone photo committed and returns the ledger URL.
-- The client-supplied URL is ignored. Only one commit can win.
local function ConsumeUploadToken(source, token, mediaType)
    token = tostring(token or '')
    if not token:match('^[0-9a-fA-F]+$') or #token < 64 then return nil, 'missing' end
    mediaType = tostring(mediaType or 'phone_photo')
    local char = exports.sunset_core:GetCharacter(source)
    if not char or not tonumber(char.id) then return nil, 'character' end
    local changed = MySQL.update.await([[
        UPDATE media_upload_tokens
        SET committed_at = UTC_TIMESTAMP()
        WHERE token_hash = SHA2(?, 256)
          AND character_id = ?
          AND media_type = ?
          AND uploaded_at IS NOT NULL
          AND committed_at IS NULL
          AND expires_at > UTC_TIMESTAMP()
    ]], { token, tonumber(char.id), mediaType })
    if (tonumber(changed) or 0) < 1 then return nil, 'missing' end
    local row = MySQL.single.await([[
        SELECT media_url, mime_type, file_size, character_id, media_type
        FROM media_upload_tokens
        WHERE token_hash = SHA2(?, 256)
        LIMIT 1
    ]], { token })
    if not row or not row.media_url then return nil, 'missing' end
    return row
end

exports('IssueUploadToken', IssueUploadToken)
exports('ConsumeUploadToken', ConsumeUploadToken)

local function computeHash(dataStr)
    return ('%08x'):format(#tostring(dataStr)) .. tostring(dataStr):sub(1, 24)
end

-- Export to request avatar capture
local function RequestAvatarCapture(source)
    local player = exports.sunset_core:GetPlayer(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not player or not char then return end

    local accountId = tonumber(player.account_id)
    local characterId = tonumber(char.id)
    if not accountId or not characterId then return end

    -- Fetch current appearance
    local row = MySQL.single.await('SELECT appearance FROM characters WHERE id = ? LIMIT 1', { characterId })
    if not row or not row.appearance then return end

    local appHash = computeHash(row.appearance)
    local currentMedia = MySQL.single.await('SELECT avatar_hash FROM panel_player_media WHERE account_id = ? LIMIT 1', { accountId })
    if currentMedia and currentMedia.avatar_hash == appHash then
        -- Already up to date
        return
    end

    local token = issueLedgerToken(accountId, characterId, 'player_avatar', accountId)
    if not token then return end
    TriggerClientEvent('sunset_profile_media:client:captureAvatar', source, {
        token = token,
        appearance = row.appearance,
        hash = appHash
    })
end
exports('RequestAvatarCapture', RequestAvatarCapture)

-- Export to request vehicle preview capture
local function RequestVehicleCapture(source, vehicleId, visualConfig)
    local player = exports.sunset_core:GetPlayer(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not player or not char then return end

    local accountId = tonumber(player.account_id)
    local characterId = tonumber(char.id)
    local vehId = tonumber(vehicleId)
    if not accountId or not vehId then return end

    local configStr = type(visualConfig) == 'table' and json.encode(visualConfig) or tostring(visualConfig or '')
    local visualHash = computeHash(configStr)

    local currentMedia = MySQL.single.await('SELECT visual_hash FROM panel_vehicle_media WHERE vehicle_id = ? LIMIT 1', { vehId })
    if currentMedia and currentMedia.visual_hash == visualHash then
        return
    end

    local token = issueLedgerToken(accountId, characterId, 'vehicle_preview', vehId)
    if not token then return end
    TriggerClientEvent('sunset_profile_media:client:captureVehicle', source, {
        token = token,
        vehicleId = vehId,
        visualConfig = visualConfig,
        hash = visualHash
    })
end
exports('RequestVehicleCapture', RequestVehicleCapture)

-- Register player command for manual avatar refresh
RegisterCommand('refreshavatar', function(source)
    if source <= 0 then return end
    RequestAvatarCapture(source)
    TriggerClientEvent('chat:addMessage', source, {
        args = { '^2[Avatar]^0', 'Profilul vizual este in curs de actualizare...' }
    })
end, false)

-- Hook character loaded
RegisterNetEvent('sunset_core:server:characterLoaded', function(source)
    local src = source
    SetTimeout(5000, function()
        if GetPlayerPing(src) > 0 then
            RequestAvatarCapture(src)
        end
    end)
end)
