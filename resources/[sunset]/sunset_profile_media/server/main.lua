local UploadTokens = {}

local function generateUploadToken(accountId, characterId, mediaType, entityId)
    local token = ('%s_%s_%s'):format(mediaType, accountId, os.time())
    UploadTokens[token] = {
        accountId = accountId,
        characterId = characterId,
        mediaType = mediaType,
        entityId = entityId,
        expires = os.time() + 300
    }
    return token
end

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
