local function runTestHack(target, seedArg)
    target = string.lower(tostring(target or 'easy'))

    local puzzleId = nil
    local difficulty = 'easy'
    local seed = tonumber(seedArg)

    if target == 'easy' or target == 'medium' or target == 'hard' then
        difficulty = target
    elseif SunsetHacking.Puzzles[target] then
        puzzleId = target
        difficulty = SunsetHacking.Puzzles[target].difficulty or 'easy'
    else
        difficulty = 'easy'
    end

    print(('^3[sunset_hacking]^7 Initializing Watch Dogs puzzle [target=%s difficulty=%s seed=%s]...'):format(target, difficulty, tostring(seed or 'random')))

    if exports.sunset_ui and exports.sunset_ui.Notify then
        exports.sunset_ui:Notify(('Hacking initialized: %s (%s)'):format(string.upper(target), difficulty), 'info', 4000)
    end

    CreateThread(function()
        local res = StartHackingPuzzle({
            puzzle = puzzleId,
            difficulty = difficulty,
            allowCancel = true,
            title = ('TEST_TERMINAL // %s'):format(string.upper(target))
        })

        if res.success then
            print(('^2[sunset_hacking]^7 ✓ PUZZLE SOLVED in %.1fs (state=%s serverVerified=%s)'):format(res.timeSpent or 0, res.state, tostring(res.serverValidated)))
            if exports.sunset_ui and exports.sunset_ui.Notify then
                exports.sunset_ui:Notify(('✓ Bypass successful in %.1fs!'):format(res.timeSpent or 0), 'success', 5000)
            end
        else
            print(('^1[sunset_hacking]^7 ✗ PUZZLE %s (state=%s in %.1fs)'):format(string.upper(res.state or 'failed'), res.state, res.timeSpent or 0))
            if exports.sunset_ui and exports.sunset_ui.Notify then
                exports.sunset_ui:Notify(('✗ Hack %s (%s)'):format(string.upper(res.state or 'failed'), res.state), 'error', 5000)
            end
        end
    end)
end

-- Register commands only in development / debug mode or for admin staff
local function registerDebugCommands()
    RegisterCommand('testhack', function(_, args)
        if not SunsetHacking.Config.Debug and not IsPlayerAceAllowed(PlayerId(), 'command') then
            -- Check if sunset_core admin permission exists
            if exports.sunset_core and exports.sunset_core.IsAdmin and not exports.sunset_core:IsAdmin() then
                return
            end
        end
        runTestHack(args[1], args[2])
    end, false)

    RegisterCommand('hack', function(_, args)
        if not SunsetHacking.Config.Debug and not IsPlayerAceAllowed(PlayerId(), 'command') then
            if exports.sunset_core and exports.sunset_core.IsAdmin and not exports.sunset_core:IsAdmin() then
                return
            end
        end
        runTestHack(args[1], args[2])
    end, false)

    TriggerEvent('chat:addSuggestion', '/testhack', 'Test the Watch Dogs Network Hacking Minigame', {
        { name = 'difficulty/puzzle', help = 'easy | medium | hard | easy_01 | medium_02 | hard_01 etc.' },
        { name = 'seed', help = 'optional numeric seed' }
    })
    TriggerEvent('chat:addSuggestion', '/hack', 'Test the Watch Dogs Network Hacking Minigame', {
        { name = 'difficulty/puzzle', help = 'easy | medium | hard' }
    })
end

registerDebugCommands()
