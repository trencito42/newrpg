local State = {
    CLOSED = 'CLOSED',
    ENTERING = 'ENTERING',
    ACTIVE = 'ACTIVE',
    SOLVING = 'SOLVING',
    SUCCESS = 'SUCCESS',
    EXITING = 'EXITING',
}

local currentState = State.CLOSED
local activeSession = nil
local activePromise = nil
local originalRadar = true
local effectActive = false

-- Safe NUI Focus helper following Sunset framework conventions
local function HACK_SetNuiFocus(hasFocus, hasCursor)
    if hasFocus then
        if GetResourceState('sunset_ui') == 'started' then
            pcall(function() exports.sunset_ui:ClaimFocus('hacking') end)
        end
        SetNuiFocus(true, hasCursor == true)
        return true
    else
        if GetResourceState('sunset_ui') == 'started' then
            pcall(function() exports.sunset_ui:ReleaseFocus('hacking') end)
        end
        SetNuiFocus(false, false)
        return true
    end
end

local function applyAtmosphere()
    if effectActive then return end
    effectActive = true

    local cfg = SunsetHacking.Config.Effects
    local mod = cfg.TimecycleModifier or 'scanline_cam'
    local ok = pcall(SetTimecycleModifier, mod)
    if not ok then
        pcall(SetTimecycleModifier, cfg.FallbackTimecycle or 'CAMERA_BW')
    end
    SetTimecycleModifierStrength(cfg.TimecycleModifierStrength or 0.85)

    if cfg.ScreenEffect then
        pcall(StartScreenEffect, cfg.ScreenEffect, 0, true)
    end

    if cfg.HideRadar then
        originalRadar = IsRadarHidden() == 0 or IsRadarEnabled()
        DisplayRadar(false)
    end

    if cfg.FreezePlayer then
        local ped = PlayerPedId()
        if DoesEntityExist(ped) then
            FreezeEntityPosition(ped, true)
        end
    end
end

local function restoreAtmosphere()
    if not effectActive then return end
    effectActive = false

    local cfg = SunsetHacking.Config.Effects

    pcall(ClearTimecycleModifier)
    if cfg.ScreenEffect then
        pcall(StopScreenEffect, cfg.ScreenEffect)
    end
    pcall(StopAllScreenEffects)

    if cfg.HideRadar and originalRadar then
        DisplayRadar(true)
    end

    if cfg.FreezePlayer then
        local ped = PlayerPedId()
        if DoesEntityExist(ped) then
            FreezeEntityPosition(ped, false)
        end
    end
end

local function cleanupHackingSession(reason, success)
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
        p:resolve({
            success = success == true,
            state = reason or (success and 'success' or 'cancelled'),
            puzzleId = session and session.puzzle and session.puzzle.id,
            difficulty = session and session.difficulty or 'easy',
            timeSpent = session and (GetGameTimer() - (session.startTime or GetGameTimer())) / 1000 or 0
        })
    end
end

-- Tick loop only runs when hacking is ACTIVE / ENTERING to disable controls smoothly
local function startControlDisabler()
    CreateThread(function()
        while currentState == State.ACTIVE or currentState == State.ENTERING or currentState == State.SOLVING do
            -- Disable attacks, weapon wheel, looking around with mouse while puzzle is open
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
                if IsDisabledControlJustPressed(0, 200) or IsDisabledControlJustPressed(0, 177) then -- ESC or Backspace
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
--- @return table { success = boolean, state = string, puzzleId = string, difficulty = string, timeSpent = number }
function StartHackingPuzzle(config)
    config = config or {}

    if currentState ~= State.CLOSED then
        return { success = false, state = 'BUSY', error = 'A hacking session is already active' }
    end

    local puzzleData
    if type(config.puzzle) == 'table' then
        puzzleData = config.puzzle
    else
        puzzleData = SunsetHacking.GetPuzzle(config.puzzle or config.difficulty or 'easy')
    end

    if not puzzleData then
        return { success = false, state = 'INVALID_PUZZLE', error = 'Could not resolve puzzle definition' }
    end

    local difficulty = config.difficulty or puzzleData.difficulty or 'easy'
    local diffCfg = SunsetHacking.Config.Difficulties[difficulty] or SunsetHacking.Config.Difficulties['easy']
    local timeLimit = config.timeLimit or puzzleData.timeLimit or diffCfg.timeLimit or 40

    currentState = State.ENTERING

    local p = promise.new()
    activePromise = p
    activeSession = {
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
        currentState = State.SUCCESS
        -- Small pause for the victory visual sequence
        SetTimeout(700, function()
            cleanupHackingSession('success', true)
        end)
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
