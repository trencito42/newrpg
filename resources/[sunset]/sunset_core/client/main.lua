Sunset = Sunset or {}
Sunset.Player = nil
Sunset.Character = nil
Sunset.Ready = false

local BOOT_ORDER = {
    LOADSCREEN = 1,
    SESSION_REQUESTED = 2,
    AUTH_BOOT = 3,
    AUTH_FORM = 4,
    AUTHENTICATING = 5,
    CHARACTER_LOADING = 6,
    SPAWNING = 7,
    GAMEPLAY = 8,
}
local bootState = 'LOADSCREEN'

function SetBootState(nextState, reason)
    if not BOOT_ORDER[nextState] then return false end
    local currentOrder = BOOT_ORDER[bootState] or 0
    local nextOrder = BOOT_ORDER[nextState]
    local authFailure = bootState == 'AUTHENTICATING' and nextState == 'AUTH_FORM'
    if nextOrder < currentOrder and not authFailure then
        print(('^3[BOOT]^7 rejected state %s -> %s (%s)'):format(bootState, nextState, tostring(reason or '')))
        return false
    end
    if nextState == bootState then return true end
    local previous = bootState
    bootState = nextState
    if GetConvar('sv_sunset_nuidebug', '0') == '1' then
        print(('^5[BOOT]^7 state %s -> %s (%s)'):format(previous, nextState, tostring(reason or '')))
    end
    TriggerEvent('sunset:client:bootStateChanged', nextState, previous, reason)
    return true
end
exports('SetBootState', SetBootState)
exports('GetBootState', function() return bootState end)

CreateThread(function()
    -- During LOADSCREEN the game's own loading screen blocks input; no need
    -- to burn a per-frame native call. Start suppressing controls only once
    -- the loadscreen hands off to the auth UI.
    while bootState == 'LOADSCREEN' do Wait(200) end
    while bootState ~= 'GAMEPLAY' do
        DisableAllControlActions(0)
        -- NUI receives keyboard/mouse independently; keep only push-to-talk alive.
        EnableControlAction(0, 249, true)
        Wait(0)
    end
end)

-- Notify player ready on spawn
CreateThread(function()
    while not NetworkIsPlayerActive(PlayerId()) do Wait(100) end

    local tNetActive = GetGameTimer()
    SunsetBoot.Log('core', 'network:active', 'network active, waiting for sunset_ui & sunset_auth_ui')
    exports('BootTrace', function(stage) SunsetBoot.Log('core', tostring(stage)) end)

    -- [A/B NOFX MODE] convar sv_sunset_nofx=1 disables loadscreen/NUI
    -- animations, filters and big backgrounds for freeze A/B testing.
    local nofx = GetConvar('sv_sunset_nofx', '0') == '1'

    -- Wait only for the auth DOM host. DOM readiness does not authorize the
    -- loadscreen handoff; an actually visible auth frame does.
    local uiDeadline = GetGameTimer() + 15000
    while (GetResourceState('sunset_auth_ui') ~= 'started' and GetResourceState('sunset_ui') ~= 'started') and GetGameTimer() < uiDeadline do
        Wait(50)
    end
    SunsetBoot.Log('core', 'ui:state', ('auth_ui=%s sunset_ui=%s'):format(
        tostring(GetResourceState('sunset_auth_ui')), tostring(GetResourceState('sunset_ui'))))

    local domDeadline = GetGameTimer() + 30000
    while GetGameTimer() < domDeadline do
        if GetResourceState('sunset_auth_ui') == 'started' and GetResourceState('sunset_auth') == 'started' then
            local ok, ready = pcall(function() return exports.sunset_auth_ui:IsDomReady() end)
            if ok and ready then break end
        end
        Wait(25)
    end

    SetBootState('SESSION_REQUESTED', 'auth DOM ready')
    SunsetBoot.Log('core', 'session:request', 'notifying server playerLoaded')
    TriggerServerEvent('sunset:server:playerLoaded')

    -- Auth decides between quick-login and the form. Keep the FiveM loadscreen
    -- until either presentation has reached its final painted position.
    local tAuthRendered = nil
    local tHandoffStart = nil
    local handoffOk, handoffErr = pcall(function()
        local readyDeadline = GetGameTimer() + 12000
        local nuiReady = false
        while GetGameTimer() < readyDeadline do
            if GetResourceState('sunset_auth_ui') == 'started' then
                local rendered = exports.sunset_auth_ui:IsVisibleRendered()
                if rendered then
                    tAuthRendered = GetGameTimer()
                    SunsetBoot.RecordMilestone('network_to_auth_rendered', tAuthRendered - tNetActive, 'auth DOM painted')
                    SunsetBoot.Log('core', 'auth_ui:rendered', ('visible frame confirmed (+%dms from net)'):format(tAuthRendered - tNetActive))
                    nuiReady = true
                    break
                end
            end
            Wait(25)
        end
        if not nuiReady then
            tAuthRendered = GetGameTimer()
            SunsetBoot.Log('core', 'auth_ui:timeout', 'NUI ready timeout (12s) — proceeding with failsafe shutdown')
        end

        tHandoffStart = GetGameTimer()
        if tAuthRendered then
            SunsetBoot.RecordMilestone('auth_rendered_to_handoff', tHandoffStart - tAuthRendered)
        end
        SunsetBoot.Log('core', 'handoff:send', 'SEND_LOADING_SCREEN_MESSAGE sunsetHandoff')
        SendLoadingScreenMessage(json.encode({ eventName = 'sunsetHandoff' }))
        if nofx then
            SendLoadingScreenMessage(json.encode({ eventName = 'nofx' }))
        end
        -- Do not hold the loadscreen on a terminal percentage. The auth UI
        -- has already reported its visible frame; shutdown follows immediately.
    end)
    if not handoffOk then
        print('^1[sunset_core]^7 loadscreen handoff failed: ' .. tostring(handoffErr))
    end

    -- Park the ped in open ocean before handing rendering control to GTA.
    -- When ShutdownLoadingScreen() fires, the engine streams the area around
    -- the ped; ocean at (0,0,-100) has virtually no geometry, so the first-frame
    -- stall is near-zero. sunset_spawn will relocate and stream the real spawn
    -- position via streamSpawnArea() once the player selects a character.
    local ped = PlayerPedId()
    SetEntityCoordsNoOffset(ped, 0.0, 0.0, -100.0, false, false, false)
    FreezeEntityPosition(ped, true)
    SetEntityVisible(ped, false, false)
    SetFocusPosAndVel(0.0, 0.0, -100.0, 0.0, 0.0, 0.0)

    local tShutdownStart = GetGameTimer()
    SunsetBoot.Log('core', 'loadscreen_shutdown:start', 'calling ShutdownLoadingScreenNui & ShutdownLoadingScreen')
    ShutdownLoadingScreenNui()
    SunsetBoot.Log('core', 'loadscreen_nui_shutdown:returned')
    ShutdownLoadingScreen()
    local tShutdownEnd = GetGameTimer()
    SunsetBoot.Log('core', 'loadscreen_shutdown:end', ('returned elapsed=%dms'):format(tShutdownEnd - tShutdownStart))
    SunsetBoot.RecordMilestone('handoff_to_loadscreen_off', tShutdownEnd - (tHandoffStart or tShutdownStart))

    -- ShutdownLoadingScreen resets the engine's NUI cursor state. Re-assert
    -- auth focus exactly once right after shutdown so the cursor comes back.
    if GetResourceState('sunset_auth_ui') == 'started' then
        pcall(function()
            if exports.sunset_auth_ui:IsAuthOpen() then
                TriggerEvent('sunset:auth_ui:reassertFocus')
            end
        end)
    end

    DoScreenFadeIn(500)
    SunsetBoot.Log('core', 'screen_fade:in_start', 'fade-in started; auth owns visible surface')

    -- Measure first responsive frames after shutdown
    CreateThread(function()
        local t0 = GetGameTimer()
        local frames = 0
        local lastGapStart = GetGameTimer()
        while frames < 300 do
            Wait(0)
            frames = frames + 1
            local now = GetGameTimer()
            lastGapStart = now
            if frames == 1 then
                SunsetBoot.Log('core', 'renderer:first_frame', ('first frame after shutdown (+%dms)'):format(now - t0))
            end
            if frames == 60 then
                SunsetBoot.Log('core', 'renderer:60_frames', ('60 frames rendered (+%dms)'):format(now - t0))
            end
        end
    end)

end)

RegisterNetEvent('sunset:client:playerReady', function(data)
    Sunset.SetLocalLocale(data and data.language or nil)
    Sunset.Player = data
    Sunset.Ready = true
    Sunset.Debug('Player ready:', data.name)
    TriggerEvent('sunset:client:onPlayerReady', data)
end)

local function syncLocaleToNui(locale)
    if GetResourceState('sunset_ui') == 'started' then
        pcall(function()
            exports.sunset_ui:Send('localeSet', { locale = locale })
        end)
    end
    if GetResourceState('sunset_auth_ui') == 'started' then
        pcall(function()
            exports.sunset_auth_ui:Send('localeSet', { locale = locale })
        end)
    end
end

-- [LOGIN PIPELINE] The account language arrives with playerReady (after the
-- first handler above applied it Lua-side). Push it to every NUI document before
-- the character/spawn UI opens so the UI never shows a different language than
-- Lua notifications for the first screens after login.
RegisterNetEvent('sunset:client:playerReady', function()
    syncLocaleToNui(Sunset.GetLocale())
end)

RegisterNetEvent('sunset:client:localeChanged', function(locale)
    if not Sunset.SetLocalLocale(locale) then return end
    if Sunset.Player then Sunset.Player.language = locale end
    syncLocaleToNui(locale)
    TriggerEvent('sunset:client:onLocaleChanged', locale)
end)

function GetLocale()
    return Sunset.GetLocale()
end

function Translate(key, params, ...)
    return Sunset.T(key, params, ...)
end

function HasTranslation(key)
    return Sunset.HasTranslation(key)
end

function IsValidLocale(locale)
    return Sunset.IsValidLocale(locale)
end

function SetLocale(locale)
    if not Sunset.IsValidLocale(locale) then
        return false, Sunset.T('locale.invalid')
    end

    CreateThread(function()
        local result, err = Sunset.AwaitCallback('sunset:setLocale', locale)
        if not result then
            TriggerEvent('sunset:client:localeChangeFailed', err or Sunset.T('locale.save_failed'))
        end
    end)
    return true
end

AddEventHandler('onClientResourceStart', function(resource)
    if resource == 'sunset_ui' or resource == 'sunset_auth_ui' then
        CreateThread(function()
            Wait(250)
            syncLocaleToNui(Sunset.GetLocale())
        end)
    end
end)

RegisterNetEvent('sunset:client:characterLoaded', function(charData)
    Sunset.Character = charData
    TriggerEvent('sunset:client:onCharacterLoaded', charData)
end)

RegisterNetEvent('sunset:client:updateCharacter', function(charData)
    if not charData then return end
    if Sunset.Character then
        for k, v in pairs(charData) do Sunset.Character[k] = v end
    else
        Sunset.Character = charData
    end
    if Sunset.Player then
        if charData.name then
            Sunset.Player.name = charData.name
        elseif charData.firstname then
            local formatted = charData.firstname .. ((charData.lastname and charData.lastname ~= '') and (' ' .. charData.lastname) or '')
            Sunset.Player.name = formatted
        end
    end
    TriggerEvent('sunset:client:onCharacterUpdated', Sunset.Character or charData)
end)

function GetPlayerData()
    return Sunset.Player
end
exports('GetPlayer', GetPlayerData)

function GetCharacterData()
    return Sunset.Character
end
exports('GetCharacter', GetCharacterData)

-- [RESTART SAFETY] `restart sunset_core` while connected: the server drops every
-- session (Players/Sessions are in-memory) and this client re-runs the boot
-- pipeline above (session -> auth -> character -> spawn), i.e. a clean re-login.
-- On stop make sure no modal UI keeps the cursor and the screen is not left black.
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    Sunset.Ready = false
    pcall(function() TriggerEvent('sunset:ui:forceCloseAll') end)
    if IsScreenFadedOut() and not IsScreenFadingIn() then DoScreenFadeIn(300) end
end)

-- [STARTUP GATE] Single readiness flag for UI openers (M menu, phone, jobs, inventory):
-- true only after the account is ready, a character is loaded AND the spawn flow
-- finished. Replaces ad-hoc Wait(N) / "GetCharacter() ~= nil" guesses.
local playerSpawnedFlag = false
AddEventHandler('sunset:client:playerSpawned', function() playerSpawnedFlag = true end)
exports('IsPlayerReady', function()
    return Sunset.Ready == true and Sunset.Character ~= nil and Sunset.Character.id ~= nil and playerSpawnedFlag
end)
exports('AwaitGameReady', Sunset.AwaitGameReady)
exports('RequestModelSafe', Sunset.RequestModelSafe)
exports('CreateSafeBlip', Sunset.CreateSafeBlip)
