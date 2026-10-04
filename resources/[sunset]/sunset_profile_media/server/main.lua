local UploadTokens = {}
local TokenCooldown = {}

math.randomseed((os.time() % 2147483646) + 1)

local ALLOWED_MEDIA = {
    player_avatar = true,
    vehicle_preview = true,
    phone_photo = true,
}

local function randomToken()
    local alphabet = '0123456789abcdef'
    local parts = {}
    for i = 1, 48 do
        local index = math.random(1, #alphabet)
        parts[i] = alphabet:sub(index, index)
    end
    return table.concat(parts)
end

local function generateUploadToken(accountId, characterId, mediaType, entityId)
    mediaType = tostring(mediaType or '')
    if not ALLOWED_MEDIA[mediaType] then return nil end
    local token = randomToken()
    local ttl = (Config.PhoneMedia and Config.PhoneMedia.TokenTtlSec) or 90
    UploadTokens[token] = {
        accountId = accountId,
        characterId = characterId,
        mediaType = mediaType,
        entityId = entityId,
        expires = os.time() + ttl,
    }
    return token
end

local function IssueUploadToken(source, mediaType)
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
    local token = generateUploadToken(tonumber(player.account_id), tonumber(char.id), mediaType, tonumber(char.id))
    if not token then return nil, 'token' end
    return {
        token = token,
        uploadUrl = Config.UploadEndpoint,
        mediaType = mediaType,
        expires = UploadTokens[token].expires,
    }
end

local function ConsumeUploadToken(source, token, mediaType)
    token = tostring(token or '')
    local row = UploadTokens[token]
    UploadTokens[token] = nil
    if not row then return nil, 'missing' end
    if row.expires < os.time() then return nil, 'expired' end
    if mediaType and row.mediaType ~= mediaType then return nil, 'media_type' end
    local char = exports.sunset_core:GetCharacter(source)
    if not char or tonumber(char.id) ~= tonumber(row.characterId) then return nil, 'character' end
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

    local token = generateUploadToken(accountId, characterId, 'player_avatar', accountId)
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

    local token = generateUploadToken(accountId, characterId, 'vehicle_preview', vehId)
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
