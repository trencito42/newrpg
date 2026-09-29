Sunset = Sunset or {}
SunsetBoot = SunsetBoot or {}

local bootId = string.format('%06X', math.random(0, 0xFFFFFF))
local bootLocalT0 = GetGameTimer()
local epochOffset = nil -- Calibrated against NUI Date.now() - GetGameTimer()

local ringBuffer = {}
local MAX_RING_BUFFER = 200

local milestones = {}
local maxHitches = {
    client_lua = 0,
    loadscreen_cef = 0,
    auth_nui = 0,
    main_nui = 0,
}

local trackedResources = {
    'sunset_core',
    'sunset_auth',
    'sunset_auth_ui',
    'sunset_ui',
    'sunset_characters',
    'sunset_spawn',
    'sunset_appearance',
    'sunset_properties',
}
local resourceLogged = {}

function SunsetBoot.GetBootId()
    return bootId
end
exports('GetBootId', SunsetBoot.GetBootId)

function SunsetBoot.SetEpochOffset(offset)
    if not epochOffset and type(offset) == 'number' then
        epochOffset = offset
        SunsetBoot.Log('core', 'epoch:calibrated', ('offset=%d'):format(offset))
    end
end
exports('SetEpochOffset', SunsetBoot.SetEpochOffset)

local function getEpochMs()
    if epochOffset then
        return GetGameTimer() + epochOffset
    end
    local cloud = GetCloudTimeAsInt()
    if cloud and cloud > 0 then
        return cloud * 1000 + (GetGameTimer() % 1000)
    end
    return 0
end

local function pushRingBuffer(entry)
    ringBuffer[#ringBuffer + 1] = entry
    if #ringBuffer > MAX_RING_BUFFER then
        table.remove(ringBuffer, 1)
    end
end

function SunsetBoot.FormatLine(component, stage, details)
    local relMs = GetGameTimer() - bootLocalT0
    local epoch = getEpochMs()
    local detailStr = (details and tostring(details) ~= '') and (' ' .. tostring(details)) or ''
    return ('[BOOTV boot=%s %d +%dms] [%s] %s%s'):format(bootId, epoch, relMs, tostring(component or 'core'), tostring(stage or 'info'), detailStr)
end

function SunsetBoot.Log(component, stage, details)
    local line = SunsetBoot.FormatLine(component, stage, details)
    pushRingBuffer(line)
    if SunsetBoot.IsDebug() then
        print('^5' .. line .. '^7')
    end
end
exports('BootLog', SunsetBoot.Log)

function SunsetBoot.LogVerbose(component, stage, details)
    local line = SunsetBoot.FormatLine(component, stage, details)
    pushRingBuffer(line)
    if SunsetBoot.IsVerbose() then
        print('^6' .. line .. '^7')
    end
end
exports('BootLogVerbose', SunsetBoot.LogVerbose)

function SunsetBoot.RecordMilestone(phase, durationMs, details)
    milestones[phase] = {
        name = phase,
        duration = tonumber(durationMs) or 0,
        details = details and tostring(details) or nil,
        timestamp = GetGameTimer(),
    }
end
exports('RecordMilestone', SunsetBoot.RecordMilestone)

function SunsetBoot.RecordHitch(sourceName, gapMs, details)
    gapMs = tonumber(gapMs) or 0
    if maxHitches[sourceName] ~= nil and gapMs > maxHitches[sourceName] then
        maxHitches[sourceName] = gapMs
    end
    if SunsetBoot.IsDebug() then
        local line = ('[HITCH boot=%s] %s GAP %dms %s'):format(
            bootId,
            tostring(sourceName):upper(),
            gapMs,
            details and tostring(details) or ''
        )
        pushRingBuffer(line)
        print('^3' .. line .. '^7')
    end
end
exports('RecordHitch', SunsetBoot.RecordHitch)

-- Resource start observer during boot
CreateThread(function()
    while true do
        local allStarted = true
        for _, res in ipairs(trackedResources) do
            if not resourceLogged[res] then
                local state = GetResourceState(res)
                if state == 'started' then
                    resourceLogged[res] = true
                    SunsetBoot.Log('core', 'resource:started', ('resource=%s'):format(res))
                else
                    allStarted = false
                end
            end
        end
        if allStarted or exports.sunset_core:GetBootState() == 'GAMEPLAY' then
            break
        end
        Wait(100)
    end
end)

-- Lightweight Client Lua Hitch Watchdog
CreateThread(function()
    while not NetworkIsPlayerActive(PlayerId()) do Wait(50) end

    local lastTimer = GetGameTimer()
    local gameplayTimestamp = nil

    while true do
        Wait(0)
        local now = GetGameTimer()
        local delta = now - lastTimer
        lastTimer = now

        local state = exports.sunset_core:GetBootState()
        if state == 'GAMEPLAY' and not gameplayTimestamp then
            gameplayTimestamp = now
        end

        if SunsetBoot.IsDebug() and delta > 100 then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local fadeState = 'fadedIn'
            if IsScreenFadedOut() then
                fadeState = 'fadedOut'
            elseif IsScreenFadingOut() then
                fadeState = 'fadingOut'
            elseif IsScreenFadingIn() then
                fadeState = 'fadingIn'
            end

            local details = ('bootState=%s ped=(%.1f,%.1f,%.1f) waitingWorldCollision=%s collisionLoaded=%s screenFade=%s frozen=%s visible=%s'):format(
                tostring(state),
                coords.x, coords.y, coords.z,
                tostring(IsEntityWaitingForWorldCollision(ped)),
                tostring(HasCollisionLoadedAroundEntity(ped)),
                fadeState,
                tostring(IsEntityPositionFrozen(ped)),
                tostring(IsEntityVisible(ped))
            )
            SunsetBoot.RecordHitch('client_lua', delta, details)
        end

        -- Stop watchdog ~15 seconds after reaching GAMEPLAY
        if gameplayTimestamp and (now - gameplayTimestamp) > 15000 then
            break
        end
    end
end)

-- Summary Generator
local summaryPrinted = false
local function printBootSummary()
    if summaryPrinted then return end
    summaryPrinted = true

    if not SunsetBoot.IsDebug() then return end

    local totalBootMs = GetGameTimer() - bootLocalT0

    -- Find bottleneck among recorded milestones
    local bottleneckPhase = 'none'
    local bottleneckDuration = 0
    local bottleneckDetails = ''

    local orderedMilestones = {
        'network_to_auth_rendered',
        'auth_rendered_to_handoff',
        'handoff_to_loadscreen_off',
        'auth_quick_login',
        'enterGame_callback',
        'resolveAutoSpawn',
        'model_load',
        'SetPlayerModel',
        'ApplyAppearance',
        'prepareSpawn_bucket_rtt',
        'streamSpawnArea_primary',
        'streamSpawnArea_fallback',
        'gameplay_reveal',
    }

    local lines = {}
    lines[#lines + 1] = '================ BOOT SUMMARY ================'
    lines[#lines + 1] = ('boot=%s'):format(bootId)

    for _, phase in ipairs(orderedMilestones) do
        local m = milestones[phase]
        if m then
            local nameLabel = string.format('%-28s', phase:gsub('_', ' '))
            local durLabel = string.format('%6dms', m.duration)
            local extra = m.details and (' ' .. m.details) or ''
            lines[#lines + 1] = ('%s %s%s'):format(nameLabel, durLabel, extra)
            if m.duration > bottleneckDuration then
                bottleneckDuration = m.duration
                bottleneckPhase = phase:gsub('_', ' ')
                bottleneckDetails = m.details or ''
            end
        end
    end

    lines[#lines + 1] = ('%-28s %6dms'):format('TOTAL BOOT ELAPSED', totalBootMs)
    lines[#lines + 1] = ('%-28s %6dms'):format('largest client frame hitch', maxHitches.client_lua or 0)
    lines[#lines + 1] = ('%-28s %6dms'):format('largest loadscreen CEF hitch', maxHitches.loadscreen_cef or 0)
    lines[#lines + 1] = ('%-28s %6dms'):format('largest auth NUI hitch', maxHitches.auth_nui or 0)
    lines[#lines + 1] = ('%-28s %6dms'):format('largest main NUI hitch', maxHitches.main_nui or 0)
    lines[#lines + 1] = '----------------------------------------------'
    if bottleneckDuration > 0 then
        lines[#lines + 1] = ('BOTTLENECK: %s%s, %dms'):format(
            bottleneckPhase,
            bottleneckDetails ~= '' and (' (' .. bottleneckDetails .. ')') or '',
            bottleneckDuration
        )
    else
        lines[#lines + 1] = 'BOTTLENECK: none detected (<100ms per phase)'
    end
    lines[#lines + 1] = '=============================================='

    print('^2' .. table.concat(lines, '\n') .. '^7')
end

RegisterNetEvent('sunset:client:printBootSummary', printBootSummary)
AddEventHandler('sunset:client:gameplayVisible', function()
    SetTimeout(1200, printBootSummary)
end)

-- Command /bootdiag
RegisterCommand('bootdiag', function(_, args)
    local sub = args[1] and string.lower(args[1]) or ''
    if sub == 'dump' then
        print('^5=== SUNSET BOOT DIAGNOSTICS RING BUFFER DUMP ===^7')
        print(('Total entries: %d'):format(#ringBuffer))
        for idx, line in ipairs(ringBuffer) do
            print(('  [%03d] %s'):format(idx, line))
        end
        print('^5================================================^7')
        return
    end

    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local fadeState = 'fadedIn'
    if IsScreenFadedOut() then fadeState = 'fadedOut'
    elseif IsScreenFadingOut() then fadeState = 'fadingOut'
    elseif IsScreenFadingIn() then fadeState = 'fadingIn' end

    print('^5=== SUNSET BOOT DIAGNOSTICS ===^7')
    print(('Boot ID:           %s'):format(bootId))
    print(('Boot State:        %s'):format(tostring(exports.sunset_core:GetBootState())))
    print(('Ped Position:      %.2f, %.2f, %.2f (heading: %.2f)'):format(coords.x, coords.y, coords.z, GetEntityHeading(ped)))
    print(('Frozen / Visible:  %s / %s'):format(tostring(IsEntityPositionFrozen(ped)), tostring(IsEntityVisible(ped))))
    print(('Collision Loaded:  %s (waitingWorldCollision=%s)'):format(tostring(HasCollisionLoadedAroundEntity(ped)), tostring(IsEntityWaitingForWorldCollision(ped))))
    print(('Screen Fade:       %s'):format(fadeState))
    print(('Max Hitches:       client=%dms, loadscreen=%dms, auth_nui=%dms, main_nui=%dms'):format(
        maxHitches.client_lua, maxHitches.loadscreen_cef, maxHitches.auth_nui, maxHitches.main_nui
    ))
    print('--- Recent 20 Boot Events ---')
    local startIdx = math.max(1, #ringBuffer - 19)
    for i = startIdx, #ringBuffer do
        print(('  %s'):format(ringBuffer[i]))
    end
    print('Tip: Use /bootdiag dump for full 200-event history.')
    print('^5==============================^7')
end, false)
