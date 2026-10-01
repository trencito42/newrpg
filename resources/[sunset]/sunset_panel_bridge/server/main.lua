-- ══════════════════════════════════════════════════════════════════════════
-- sunset_panel_bridge: Official Companion Resource for Sunset RPG Web Panel
-- ══════════════════════════════════════════════════════════════════════════

local function generatePinCode()
    return string.format("%06d", math.random(100000, 999999))
end

local function generateRandomHex(length)
    local chars = 'abcdef0123456789'
    local hex = ''
    for i = 1, length do
        local randIndex = math.random(1, #chars)
        hex = hex .. string.sub(chars, randIndex, randIndex)
    end
    return hex
end

-- Command: /webpin
-- Generates a single-use 6-digit authentication PIN expiring in 5 minutes
RegisterCommand('webpin', function(source, args, rawCommand)
    if source == 0 then
        print('^3[sunset_panel_bridge]^7 /webpin must be executed by an in-game player.')
        return
    end

    local player = exports['sunset_core']:GetPlayer(source)
    if not player or not player.account_id then
        TriggerClientEvent('chat:addMessage', source, {
            color = { 255, 75, 75 },
            args = { 'PANEL', 'Nu ești conectat la un cont RPG valid sau profilul încă se încarcă.' }
        })
        return
    end

    local accountId = tonumber(player.account_id)
    local characterId = player.character_id and tonumber(player.character_id) or nil
    local pin = generatePinCode()
    local tokenHash = generateRandomHex(64)

    -- Invalidate any previous unused tokens for this account
    MySQL.update.await(
        'DELETE FROM panel_link_tokens WHERE account_id = ? AND used = 0',
        { accountId }
    )

    -- Insert new token valid for 5 minutes
    local success = pcall(function()
        MySQL.insert.await(
            [[INSERT INTO panel_link_tokens (token_hash, pin_code, account_id, character_id, expires_at)
              VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))]],
            { tokenHash, pin, accountId, characterId }
        )
    end)

    if not success then
        TriggerClientEvent('chat:addMessage', source, {
            color = { 255, 75, 75 },
            args = { 'PANEL', 'A apărut o eroare la generarea codului PIN web. Încearcă din nou.' }
        })
        return
    end

    TriggerClientEvent('chat:addMessage', source, {
        color = { 255, 179, 71 },
        multiline = true,
        args = {
            'PANEL WEB',
            string.format(
                'Codul tău de autentificare web este: ^1%s^7.\nAccesează panoul web și introdu acest cod.\n^3Expiră în 5 minute! Nu comunica acest cod nimănui.^7',
                pin
            )
        }
    })
end, false)

-- Register alias /panelpin
RegisterCommand('panelpin', function(source, args, rawCommand)
    ExecuteCommand('webpin')
end, false)

-- Export: Check if player account is currently online in FiveM runtime
exports('IsAccountOnline', function(accountId)
    accountId = tonumber(accountId)
    if not accountId then return false end
    local src = exports['sunset_core']:GetSourceByAccountId(accountId)
    return src ~= nil and src > 0
end)

-- Export: Get Live Server Stats for Web Bridge
exports('GetLiveServerStats', function()
    local onlinePlayers = #GetPlayers()
    return {
        online = true,
        playerCount = onlinePlayers,
        maxClients = GetConvarInt('sv_maxclients', 64)
    }
end)

print('^2[sunset_panel_bridge]^7 Resource initialized successfully. /webpin and /panelpin active.')
