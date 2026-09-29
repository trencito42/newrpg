-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Fishing Tournament Client (client/main.lua)
--  World interaction prompt at tournament pier, HUD syncing,
--  catch feedback, and results presentation via sunset_ui.
-- ═══════════════════════════════════════════════════════════════

local Cfg = SunsetFishingTournament.Config
local isJoined = false
local tournamentActive = false
local isJoining = false

local function drawText3D(x, y, z, text)
    local onScreen, screenX, screenY = World3dToScreen2d(x, y, z)
    if not onScreen then return end

    SetTextScale(0.35, 0.35)
    SetTextFont(4)
    SetTextProportional(1)
    SetTextColour(255, 255, 255, 230)
    SetTextEntry('STRING')
    SetTextCentre(1)
    AddTextComponentString(text)
    DrawText(screenX, screenY)

    local factor = string.len(text) / 370
    DrawRect(screenX, screenY + 0.0125, 0.015 + factor, 0.03, 10, 15, 25, 180)
end

-- ═══════════════════════════════════════════════════════════════
--  Network Events from Server
-- ═══════════════════════════════════════════════════════════════

RegisterNetEvent('sunset:fishingTournament:eventStarted', function(data)
    tournamentActive = true
    isJoined = false
end)

RegisterNetEvent('sunset:fishingTournament:syncHud', function(payload)
    if not payload then return end
    isJoined = true
    tournamentActive = true
    exports.sunset_ui:Send('fishingTournamentHudShow', payload)
end)

RegisterNetEvent('sunset:fishingTournament:catchFeedback', function(data)
    if not isJoined then return end
    exports.sunset_ui:Send('fishingTournamentCatchFeedback', data)
end)

RegisterNetEvent('sunset:fishingTournament:showResults', function(resultsData)
    tournamentActive = false
    isJoined = false
    exports.sunset_ui:Send('fishingTournamentHudHide', {})

    if resultsData then
        exports.sunset_ui:Send('fishingTournamentResultsShow', resultsData)
        exports.sunset_ui:SetFocus(true, true, false, 'fishing_tournament')
    end
end)

RegisterNetEvent('sunset:events:clientEnd', function(data)
    if data and data.type == 'fishing_tournament' then
        tournamentActive = false
        isJoined = false
        exports.sunset_ui:Send('fishingTournamentHudHide', {})
    end
end)

-- ═══════════════════════════════════════════════════════════════
--  World Interaction Thread
-- ═══════════════════════════════════════════════════════════════

CreateThread(function()
    while true do
        local sleep = 1000

        if tournamentActive and not isJoined then
            local pCoords = GetEntityCoords(PlayerPedId())
            local loc = Cfg.joinLocation
            local dist = #(pCoords - loc)

            if dist < 30.0 then
                sleep = 0
                -- Draw subtle glowing cylinder marker
                DrawMarker(1, loc.x, loc.y, loc.z - 1.0,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                    1.8, 1.8, 0.6,
                    56, 189, 248, 150,
                    false, false, 2, false, nil, nil, false)

                if dist < (Cfg.interactDistance or 3.5) then
                    drawText3D(loc.x, loc.y, loc.z + 0.3,
                        '~y~[E]~s~ Join Fishing Tournament (Weight Leaderboard · Min 3 Fish)')

                    if IsControlJustPressed(0, 38) and not isJoining then -- 38 = E
                        isJoining = true
                        exports.sunset_core:TriggerCallback('sunset:fishingTournament:join', function(res)
                            isJoining = false
                            if res and res.ok then
                                isJoined = true
                                if res.status then
                                    exports.sunset_ui:Send('fishingTournamentHudShow', res.status)
                                end
                            else
                                exports.sunset_ui:Notify(res and res.error or 'Failed to join tournament.', 'error')
                            end
                        end)
                    end
                end
            end
        end

        Wait(sleep)
    end
end)

-- ═══════════════════════════════════════════════════════════════
--  Initial Sync / Reconnect
-- ═══════════════════════════════════════════════════════════════

local function checkActiveState()
    Wait(2000)
    exports.sunset_core:TriggerCallback('sunset:fishingTournament:status', function(res)
        if res and res.active then
            tournamentActive = true
            if res.joined then
                isJoined = true
                exports.sunset_ui:Send('fishingTournamentHudShow', res)
            end
        else
            tournamentActive = false
            isJoined = false
            exports.sunset_ui:Send('fishingTournamentHudHide', {})
        end
    end)
end

AddEventHandler('onClientResourceStart', function(resName)
    if resName == GetCurrentResourceName() then
        checkActiveState()
    end
end)

RegisterNetEvent('sunset:core:characterSelected', function()
    checkActiveState()
end)

AddEventHandler('onResourceStop', function(resName)
    if resName == GetCurrentResourceName() then
        exports.sunset_ui:Send('fishingTournamentHudHide', {})
        exports.sunset_ui:Send('fishingTournamentResultsHide', {})
        exports.sunset_ui:SetFocus(false, false, false, 'fishing_tournament')
    end
end)
