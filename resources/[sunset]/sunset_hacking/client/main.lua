local State = {
    CLOSED = 'CLOSED',
    ENTERING = 'ENTERING',
    ACTIVE = 'ACTIVE',
    SOLVING = 'SOLVING',
    SUCCESS = 'SUCCESS',
    EXITING = 'EXITING',
}

RegisterNetEvent('sunset:hacking:sessionCreated')
RegisterNetEvent('sunset:hacking:solutionResult')

local currentState = State.CLOSED
local activeSession = nil
local activePromise = nil

-- State tracking for non-destructive restoration
local preHackState = {
    radarHidden = false,
    playerFrozen = false,
    timecycleApplied = false,
    screenEffectApplied = false,
    activeTimecycle = nil,
    activeScreenEffect = nil,
}

-- Safe NUI Focus helper integrating with Sunset Focus Manager
local function HACK_SetNuiFocus(hasFocus, hasCursor)
    if hasFocus then
        if GetResourceState('sunset_ui') == 'started' then
            local claimed = pcall(function() return exports.sunset_ui:ClaimFocus('hacking') end)
            if not claimed then
                return false
            end
        end
        SetNuiFocus(true, hasCursor == true)
        SetNuiFocusKeepInput(false)
        return true
    else
        if GetResourceState('sunset_ui') == 'started' then
            pcall(function() exports.sunset_ui:ReleaseFocus('hacking') end)
        end
        SetNuiFocus(false, false)
        SetNuiFocusKeepInput(false)
        return true
    end
end

local function applyAtmosphere()
    local cfg = SunsetHacking.Config.Effects
    local ped = PlayerPedId()

    -- 1. Record pre-hack state
    preHackState.radarHidden = (IsRadarHidden() == 1) or not IsRadarEnabled()
    preHackState.playerFrozen = DoesEntityExist(ped) and IsEntityPositionFrozen(ped)

    -- 2. Suppress HUD, Chat and Overhead Nametags
    if GetResourceState('sunset_hud') == 'started' then
        pcall(function() exports.sunset_hud:SetHudSuppressed(true) end)
    end
    if GetResourceState('sunset_ui') == 'started' then
        pcall(function() exports.sunset_ui:HideHudChrome() end)
    end

    -- 3. Apply Timecycle
    local mod = cfg.TimecycleModifier or 'scanline_cam'
    local ok = pcall(SetTimecycleModifier, mod)
    if not ok then
        pcall(SetTimecycleModifier, cfg.FallbackTimecycle or 'CAMERA_BW')
        preHackState.activeTimecycle = cfg.FallbackTimecycle or 'CAMERA_BW'
    else
        preHackState.activeTimecycle = mod
    end
    SetTimecycleModifierStrength(cfg.TimecycleStrength or 0.85)
    preHackState.timecycleApplied = true

    -- 4. Screen Effect
    if cfg.ScreenEffect then
        pcall(StartScreenEffect, cfg.ScreenEffect, 0, true)
        preHackState.screenEffectApplied = true
        preHackState.activeScreenEffect = cfg.ScreenEffect
    end

    -- 5. Radar
    if cfg.HideRadar and not preHackState.radarHidden then
        DisplayRadar(false)
    end

    -- 6. Freeze Player
    if cfg.FreezePlayer and not preHackState.playerFrozen and DoesEntityExist(ped) then
        FreezeEntityPosition(ped, true)
    end
end

local function restoreAtmosphere()
    local ped = PlayerPedId()
    local cfg = SunsetHacking.Config.Effects

    -- 1. Restore Timecycle only if we applied it
    if preHackState.timecycleApplied then
        pcall(ClearTimecycleModifier)
        preHackState.timecycleApplied = false
        preHackState.activeTimecycle = nil
    end

    -- 2. Stop Screen Effect only if we started it
    if preHackState.screenEffectApplied and preHackState.activeScreenEffect then
        pcall(StopScreenEffect, preHackState.activeScreenEffect)
        preHackState.screenEffectApplied = false
        preHackState.activeScreenEffect = nil
    end

    -- 3. Restore Radar to prior state
    if cfg.HideRadar and not preHackState.radarHidden then
        DisplayRadar(true)
    end

    -- 4. Restore Player Frozen State to prior state
    if cfg.FreezePlayer and not preHackState.playerFrozen and DoesEntityExist(ped) then
        FreezeEntityPosition(ped, false)
    end

    -- 5. Restore HUD, Chat and Overhead Nametags
    if GetResourceState('sunset_hud') == 'started' then
        pcall(function() exports.sunset_hud:SetHudSuppressed(false) end)
    end
    if GetResourceState('sunset_ui') == 'started' then
        pcall(function() exports.sunset_ui:ShowHudChrome() end)
    end
end

local function cleanupHackingSession(reason, success, serverResult)
    if currentState == State.CLOSED then return end
    currentState = State.EXITING

    restoreAtmosphere()
    HACK_SetNuiFocus(false, false)

    SendNUIMessage({
        action = 'close',
        data = { reason = reason, success = success == true }
    })

    local p = activePromise
    local session = activeSession

    activePromise = nil
    activeSession = nil
    currentState = State.CLOSED

    if p then
        local timeSpent = session and (GetGameTimer() - (session.startTime or GetGameTimer())) / 1000 or 0
        p:resolve({
            success = success == true,
            state = reason or (success and 'success' or 'cancelled'),
            puzzleId = session and session.puzzle and session.puzzle.id,
            difficulty = session and session.difficulty or 'easy',
            timeSpent = (serverResult and serverResult.timeSpent) or timeSpent,
            serverValidated = serverResult ~= nil
        })
    end
end

-- Tick loop only runs while hacking is ACTIVE / ENTERING to smoothly disable action controls
local function startControlDisabler()
    CreateThread(function()
        while currentState == State.ACTIVE or currentState == State.ENTERING or currentState == State.SOLVING do
            HideHudAndRadarThisFrame()
            for i = 1, 22 do
                HideHudComponentThisFrame(i)
            end

            DisableControlAction(0, 1, true)   -- Look LR
            DisableControlAction(0, 2, true)   -- Look UD
            DisableControlAction(0, 24, true)  -- Attack
            DisableControlAction(0, 25, true)  -- Aim
            DisableControlAction(0, 142, true) -- Melee
            DisableControlAction(0, 106, true) -- Vehicle mouse control
            DisableControlAction(0, 37, true)  -- Weapon wheel
            DisableControlAction(0, 288, true) -- Phone
            DisableControlAction(0, 289, true) -- Inventory
            DisableControlAction(0, 170, true) -- F3 / Animations
            DisableControlAction(0, 166, true) -- F5
            DisableControlAction(0, 167, true) -- F6
            DisableControlAction(0, 168, true) -- F7
            DisableControlAction(0, 56, true)  -- F9
            DisableControlAction(0, 57, true)  -- F10

            -- ESC / Backspace cancel handling
            if activeSession and activeSession.allowCancel ~= false then
                if IsDisabledControlJustPressed(0, 200) or IsDisabledControlJustPressed(0, 177) then
                    cleanupHackingSession('cancelled', false)
                    break
                end
            end

            Wait(0)
        end
    end)
end

--- Starts the Watch Dogs Network Hacking Minigame
--- @param config table { puzzle = string|table, difficulty = 'easy'|'medium'|'hard', timeLimit = number, title = string, allowCancel = boolean }
--- @return table { success = boolean, state = string, puzzleId = string, difficulty = string, timeSpent = number, serverValidated = boolean }
function StartHackingPuzzle(config)
    config = config or {}

    if currentState ~= State.CLOSED then
        return { success = false, state = 'BUSY', error = 'A hacking session is already active' }
    end

    local difficulty = config.difficulty or 'easy'
    local puzzleData
    local serverSessionId = nil

    -- 1. Try resolving or creating session
    if type(config.puzzle) == 'table' then
        puzzleData = config.puzzle
    else
        -- Request server session
        local pSession = promise.new()
        local reqHandler = nil
        reqHandler = AddEventHandler('sunset:hacking:sessionCreated', function(sessData, err)
            RemoveEventHandler(reqHandler)
            pSession:resolve({ data = sessData, err = err })
        end)

        TriggerServerEvent('sunset:hacking:requestSession', {
            difficulty = difficulty,
            puzzle = config.puzzle,
            timeLimit = config.timeLimit,
            title = config.title,
            allowCancel = config.allowCancel
        })

        -- Await with short timeout fallback
        SetTimeout(2000, function()
            if pSession then pSession:resolve({ timeout = true }) end
        end)

        local sResult = Citizen.Await(pSession)
        if sResult and sResult.data and sResult.data.puzzle then
            puzzleData = sResult.data.puzzle
            serverSessionId = sResult.data.sessionId
            difficulty = sResult.data.difficulty or difficulty
        else
            -- Local fallback
            puzzleData = SunsetHacking.GetPuzzle(config.puzzle or difficulty)
        end
    end

    if not puzzleData then
        return { success = false, state = 'INVALID_PUZZLE', error = 'Could not resolve puzzle definition' }
    end

    local diffCfg = SunsetHacking.Config.Difficulties[difficulty] or SunsetHacking.Config.Difficulties.easy
    local timeLimit = config.timeLimit or puzzleData.timeLimit or diffCfg.timeLimit or 35

    currentState = State.ENTERING

    local p = promise.new()
    activePromise = p
    activeSession = {
        sessionId = serverSessionId,
        puzzle = puzzleData,
        difficulty = difficulty,
        timeLimit = timeLimit,
        title = config.title or puzzleData.title or 'CTOS_NETWORK_GRID',
        allowCancel = config.allowCancel ~= false,
        startTime = GetGameTimer(),
    }

    applyAtmosphere()

    local focusClaimed = HACK_SetNuiFocus(true, true)
    if not focusClaimed then
        restoreAtmosphere()
        currentState = State.CLOSED
        activePromise = nil
        activeSession = nil
        return { success = false, state = 'FOCUS_FAILED', error = 'Could not acquire NUI focus' }
    end

    SendNUIMessage({
        action = 'open',
        data = {
            sessionId = serverSessionId,
            puzzle = puzzleData,
            difficulty = difficulty,
            timeLimit = timeLimit,
            title = activeSession.title,
            allowCancel = activeSession.allowCancel,
        }
    })

    currentState = State.ACTIVE
    startControlDisabler()

    return Citizen.Await(p)
end
exports('StartHackingPuzzle', StartHackingPuzzle)

function CancelHackingPuzzle()
    if currentState ~= State.CLOSED then
        cleanupHackingSession('cancelled', false)
        return true
    end
    return false
end
exports('CancelHackingPuzzle', CancelHackingPuzzle)

function IsHackingActive()
    return currentState ~= State.CLOSED
end
exports('IsHackingActive', IsHackingActive)

-- NUI Callbacks
RegisterNUICallback('nui:ready', function(_, cb)
    cb('ok')
end)

RegisterNUICallback('nui:sound', function(data, cb)
    local key = data and data.key
    local snd = key and SunsetHacking.Config.Sounds[key]
    if snd then
        PlaySoundFrontend(-1, snd.name, snd.set, true)
    end
    cb('ok')
end)

RegisterNUICallback('nui:complete', function(data, cb)
    if currentState == State.ACTIVE or currentState == State.SOLVING then
        currentState = State.SOLVING

        local clientRotations = data and data.rotations
        local sessId = activeSession and activeSession.sessionId

        if sessId then
            -- Authoritative verification with server
            local pVerify = promise.new()
            local verHandler = nil
            verHandler = AddEventHandler('sunset:hacking:solutionResult', function(rSessionId, result)
                if rSessionId == sessId then
                    RemoveEventHandler(verHandler)
                    pVerify:resolve(result)
                end
            end)

            TriggerServerEvent('sunset:hacking:submitSolution', sessId, clientRotations)

            SetTimeout(2500, function()
                if pVerify then pVerify:resolve({ success = true, timeout = true }) end
            end)

            local sResult = Citizen.Await(pVerify)
            SetTimeout(600, function()
                cleanupHackingSession(sResult.success and 'success' or 'invalid_solution', sResult.success == true, sResult)
            end)
        else
            -- Standalone / offline validation
            SetTimeout(600, function()
                cleanupHackingSession('success', true)
            end)
        end
    end
    cb('ok')
end)

RegisterNUICallback('nui:fail', function(data, cb)
    local reason = data and data.reason or 'failed'
    cleanupHackingSession(reason, false)
    cb('ok')
end)

RegisterNUICallback('nui:cancel', function(_, cb)
    cleanupHackingSession('cancelled', false)
    cb('ok')
end)

-- Defensive cleanup handlers
AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then
        cleanupHackingSession('resource_stopped', false)
    end
end)

AddEventHandler('sunset:ui:forceCloseAll', function()
    if currentState ~= State.CLOSED then
        cleanupHackingSession('force_closed', false)
    end
end)

AddEventHandler('sunset:ui:emergencyClose', function()
    if currentState ~= State.CLOSED then
        cleanupHackingSession('emergency_closed', false)
    end
end)

-- Player death safety
AddEventHandler('gameEventTriggered', function(name, args)
    if name == 'CEventNetworkEntityDamage' then
        local victim = args[1]
        if victim == PlayerPedId() and IsEntityDead(victim) then
            if currentState ~= State.CLOSED then
                cleanupHackingSession('player_dead', false)
            end
        end
    end
end)
