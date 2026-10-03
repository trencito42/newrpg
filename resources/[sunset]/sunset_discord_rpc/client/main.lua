-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Discord Rich Presence Client
-- ═══════════════════════════════════════════════════════════════

local onlineCount = 1
local maxClients = 64

RegisterNetEvent('sunset:discord_rpc:updateStatus', function(data)
    if data and data.onlineCount then
        onlineCount = tonumber(data.onlineCount) or 1
        maxClients = tonumber(data.maxClients) or 64
    end
end)

local function getCharacterDetails()
    local char = nil
    if exports.sunset_core and exports.sunset_core.GetCharacter then
        local ok, res = pcall(function() return exports.sunset_core:GetCharacter() end)
        if ok and res then char = res end
    end
    return char
end

local function getFactionOrJobText(char)
    if not char then return 'Conectare pe Server...' end

    local factionId = char.metadata and char.metadata.faction
    local factionGrade = char.metadata and char.metadata.faction_grade or 0

    if factionId and factionId ~= '' and factionId ~= 'none' then
        local factionLabel = factionId:upper()
        if factionId == 'police' then factionLabel = 'LSPD'
        elseif factionId == 'ems' then factionLabel = 'EMS Paramedic'
        elseif factionId == 'fib' then factionLabel = 'FIB Agent'
        elseif factionId == 'taxi' then factionLabel = 'Taxi Driver'
        elseif factionId == 'tow' then factionLabel = 'Tow Service'
        end
        return ('%s (Rank %d)'):format(factionLabel, factionGrade)
    end

    local job = char.job
    if job and job ~= '' and job ~= 'unemployed' then
        local jobName = job:gsub('_', ' ')
        jobName = jobName:gsub('^%l', string.upper)
        return ('Job: %s (Lvl %d)'):format(jobName, tonumber(char.level) or 1)
    end

    return ('Cetățean (Lvl %d)'):format(tonumber(char.level) or 1)
end

CreateThread(function()
    -- Set Discord App ID
    if Config.DiscordAppId and Config.DiscordAppId ~= '' then
        SetDiscordAppId(Config.DiscordAppId)
    end

    -- Set Assets
    SetDiscordRichPresenceAsset(Config.Assets.largeImage or 'racket_logo')
    SetDiscordRichPresenceAssetText(Config.Assets.largeText or 'Racket RPG')
    SetDiscordRichPresenceAssetSmall(Config.Assets.smallImage or 'fivem_logo')
    SetDiscordRichPresenceAssetSmallText(Config.Assets.smallText or 'racket.cat')

    -- Set Action Buttons
    if Config.Buttons then
        for _, btn in ipairs(Config.Buttons) do
            if btn.index and btn.label and btn.url then
                SetDiscordRichPresenceAction(btn.index, btn.label, btn.url)
            end
        end
    end

    while true do
        -- Request updated server player count
        TriggerServerEvent('sunset:discord_rpc:requestStatus')

        local myServerId = GetPlayerServerId(PlayerId())
        local char = getCharacterDetails()
        local player = nil
        if exports.sunset_core and exports.sunset_core.GetPlayer then
            pcall(function() player = exports.sunset_core:GetPlayer() end)
        end

        if char and (char.firstname or char.name) then
            local playerName = char.name or (('%s %s'):format(char.firstname or '', char.lastname or ''):gsub('^%s*(.-)%s*$', '%1'))
            if playerName == '' and player and player.username then
                playerName = player.username
            end

            local clanTag = ''
            if char.metadata and char.metadata.clan_tag and char.metadata.clan_tag ~= '' then
                clanTag = ('[%s] '):format(char.metadata.clan_tag)
            elseif player and player.clan_tag and player.clan_tag ~= '' then
                clanTag = ('[%s] '):format(player.clan_tag)
            end

            local activity = getFactionOrJobText(char)
            local presenceText = ('%s%s (ID %d) • %s • %d/%d On'):format(
                clanTag,
                playerName,
                myServerId,
                activity,
                onlineCount,
                maxClients
            )

            SetRichPresence(presenceText)
        elseif player and player.username then
            SetRichPresence(('%s (ID %d) • În Meniu • %d/%d Jucători'):format(player.username, myServerId, onlineCount, maxClients))
        else
            SetRichPresence(('În Conectare • %d/%d Jucători • racket.cat'):format(onlineCount, maxClients))
        end

        Wait((Config.RefreshInterval or 15) * 1000)
    end
end)
