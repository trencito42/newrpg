local inCharacterFlow = false
local pendingSpawnCharacter = nil
local optionalSpawnMenu = false
local flowStartTimer = nil

local function trace(stage, detail)
    if SunsetBoot and SunsetBoot.Log then
        SunsetBoot.Log('characters', stage, detail)
    else
        pcall(function() exports.sunset_core:BootLog('characters', stage, detail) end)
    end
    TriggerServerEvent('sunset:server:flowTrace', stage, detail and tostring(detail) or '')
end

local function spawnCharacter(char, preResolvedSpawn)
    local charId = char and char.id or 'unknown'
    local elapsed = flowStartTimer and (GetGameTimer() - flowStartTimer) or 0
    print(('^2[LOGIN-PERF] SPAWN_CHARACTER_INIT +%dms | charId=%s^7'):format(elapsed, tostring(charId)))

    if not char.appearance or not next(char.appearance) then
        local def = nil
        if GetResourceState('sunset_appearance') == 'started' then
            def = exports.sunset_appearance:GetDefaultAppearance(char.gender or 0)
        end
        if not def and SunsetAppearance and SunsetAppearance.default then
            def = SunsetAppearance.default(char.gender or 0)
        end
        if def then
            char.appearance = def
            CreateThread(function()
                pcall(function()
                    Sunset.AwaitCallbackTimeout('sunset:saveAppearance', 3000, def, char.gender or 0, char.id)
                end)
            end)
        end
    end

    if preResolvedSpawn and preResolvedSpawn.x then
        local totalElapsed = flowStartTimer and (GetGameTimer() - flowStartTimer) or 0
        print(('^2[LOGIN-PERF] SPAWN_RESOLVED +%dms | source=%s coords=(%.2f,%.2f,%.2f)^7'):format(
            totalElapsed, tostring(preResolvedSpawn.source), preResolvedSpawn.x, preResolvedSpawn.y, preResolvedSpawn.z))
        TriggerEvent('sunset:client:spawnCharacter', char, preResolvedSpawn)
        return
    end

    showSpawnSelection(char)
end

function showSpawnSelection(char, optional)
    local charId = char and char.id or 'unknown'
    trace('spawn_selector_open', charId)
    pendingSpawnCharacter = char
    optionalSpawnMenu = optional == true

    if not optionalSpawnMenu then
        local resolveStarted = GetGameTimer()
        local resolved, err = Sunset.AwaitCallbackTimeout('sunset:resolveAutoSpawn', 2000)
        local resolveDur = GetGameTimer() - resolveStarted
        local totalElapsed = flowStartTimer and (GetGameTimer() - flowStartTimer) or resolveDur

        if resolved and resolved.x then
            pendingSpawnCharacter = nil
            local srcName = tostring(resolved.source or 'default')
            print(('^2[LOGIN-PERF] SPAWN_RESOLVED +%dms | source=%s coords=(%.2f,%.2f,%.2f) dur=%dms^7'):format(
                totalElapsed, srcName, resolved.x, resolved.y, resolved.z, resolveDur))
            TriggerEvent('sunset:client:spawnCharacter', char, resolved)
            return
        end

        -- Deterministic hard fallback
        local def = Sunset.Config.DefaultSpawn or { x = -1037.6, y = -2737.8, z = 13.8, w = 330.0 }
        local fallbackResolved = { x = def.x, y = def.y, z = def.z, w = def.w or 0.0, source = 'default_fallback' }
        pendingSpawnCharacter = nil
        print(('^3[LOGIN-PERF] SPAWN_RESOLVED +%dms | fallback=default^7'):format(totalElapsed))
        TriggerEvent('sunset:client:spawnCharacter', char, fallbackResolved)
        return
    end

    -- User-triggered /spawnmenu
    local jail = Sunset.AwaitCallbackTimeout('sunset:getJailSpawnLock', 2000)
    if jail and jail.locked then
        pendingSpawnCharacter = char
        TriggerEvent('sunset:client:spawnCharacter', char, {
            x = jail.x, y = jail.y, z = jail.z, w = jail.w or 0.0,
        })
        return
    end

    local homes = Sunset.AwaitCallbackTimeout('sunset:getSpawnHomes', 2000) or {}
    local factionHq = Sunset.AwaitCallbackTimeout('sunset:getLeaderSpawnHq', 2000)
    exports.sunset_ui:Show('spawn', {
        hasLastLocation = false,
        homes = homes,
        factionHq = factionHq,
        dismissible = optionalSpawnMenu,
    })
end

local function closeOptionalSpawnMenu()
    if not optionalSpawnMenu then return end
    optionalSpawnMenu = false
    pendingSpawnCharacter = nil
    exports.sunset_ui:Hide()
    exports.sunset_ui:Send('showHud', {})
end

AddEventHandler('sunset:client:spawnSelectionRequired', showSpawnSelection)

local function openSpawnMenuNow(force)
    if inCharacterFlow and not force then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('characters.message.finish_the_current_login_flow_first'), 'error')
        return false
    end
    local char = exports.sunset_core:GetCharacter()
    if not char or not char.id then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('characters.message.no_character_loaded'), 'error')
        return false
    end
    if GetResourceState('sunset_appearance') == 'started' and exports.sunset_appearance:IsEditing() then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('characters.message.finish_character_appearance_first'), 'error')
        return false
    end
    showSpawnSelection(char, true)
    return true
end

RegisterNetEvent('sunset:client:openSpawnMenu', function()
    openSpawnMenuNow(true)
end)

RegisterCommand('spawnmenu', function()
    openSpawnMenuNow(false)
end, false)

exports('OpenSpawnMenu', function(force)
    return openSpawnMenuNow(force == true)
end)

CreateThread(function()
    Wait(1500)
    TriggerEvent('chat:addSuggestion', '/spawnmenu', 'Open the spawn location selector without reconnecting')
end)

AddEventHandler('sunset:nui:spawnSelect', function(data)
    if not pendingSpawnCharacter then return end
    local choice = data and data.location
    if choice ~= 'default' and choice ~= 'last' and choice ~= 'house' and choice ~= 'hq' then
        return exports.sunset_ui:Notify(exports.sunset_core:Translate('characters.message.choose_one_of_the_available_spawn_locations'), 'error')
    end
    local resolved, err = Sunset.AwaitCallbackTimeout('sunset:resolveSpawnChoice', 3000, choice, tonumber(data and data.propertyId))
    if not resolved then
        exports.sunset_ui:Send('spawnSelectFailed', {})
        return exports.sunset_ui:Notify(err or exports.sunset_core:Translate('characters.msg.that_spawn_location_is_unavailable'), 'error', 6000)
    end
    local char = pendingSpawnCharacter
    pendingSpawnCharacter = nil
    optionalSpawnMenu = false
    trace('spawn_selected', choice)
    TriggerEvent('sunset:client:spawnCharacter', char, resolved)
end)

AddEventHandler('sunset:nui:spawnClose', function()
    closeOptionalSpawnMenu()
end)

local function showCharacterList()
    local characters, err = Sunset.AwaitCallbackTimeout('sunset:getCharacters', 4000)
    if type(characters) ~= 'table' then
        exports.sunset_ui:Notify(err or exports.sunset_core:Translate('characters.msg.could_not_load_your_characters'), 'error')
        return
    end
    exports.sunset_ui:Show('characters', {
        characters = characters,
        maxSlots = Sunset.Config.MaxCharacters or 1,
    })
end

local function autoEnterGame()
    if inCharacterFlow then return end
    inCharacterFlow = true
    if not flowStartTimer then flowStartTimer = GetGameTimer() end

    print(('^2[LOGIN-PERF] ENTER_GAME_SENT +%dms^7'):format(GetGameTimer() - flowStartTimer))
    trace('character_request_started')

    -- Single fast, deterministic attempt with 4000ms deadline
    local tEnterStart = GetGameTimer()
    local result, err = Sunset.AwaitCallbackTimeout('sunset:enterGame', 4000)
    local enterDur = GetGameTimer() - tEnterStart
    local enterTotalElapsed = GetGameTimer() - flowStartTimer

    if result and result.character then
        local charId = result.character.id
        print(('^2[LOGIN-PERF] ENTER_GAME_RESP +%dms (dur=%dms) | charId=%s^7'):format(
            enterTotalElapsed, enterDur, tostring(charId)))

        if SunsetBoot and SunsetBoot.RecordMilestone then
            SunsetBoot.RecordMilestone('enterGame_callback', enterDur, ('charId=%s'):format(tostring(charId)))
        else
            pcall(function() exports.sunset_core:RecordMilestone('enterGame_callback', enterDur) end)
        end
        trace('character_request_complete', ('%s | %dms'):format(tostring(charId), enterDur))
        spawnCharacter(result.character, result.spawn)
        return
    end

    print(('^1[LOGIN-PERF] ENTER_GAME_FAILED +%dms | err=%s^7'):format(
        enterTotalElapsed, tostring(err or 'timeout')))
    trace('character_request_failed', ('%s | %dms'):format(tostring(err or 'empty_response'), enterDur))
    inCharacterFlow = false
    if GetResourceState('sunset_auth') == 'started' then
        TriggerEvent('sunset:auth:openLogin')
    else
        exports.sunset_ui:Show('auth', {})
        exports.sunset_ui:SetFocus(true, true)
    end
    exports.sunset_ui:Notify(err or exports.sunset_core:Translate('characters.msg.could_not_load_your_character'), 'error')
end

AddEventHandler('sunset:client:authenticationComplete', function()
    flowStartTimer = GetGameTimer()
    print('^2[LOGIN-PERF] AUTH_EVENT_RECEIVED +0ms^7')
    CreateThread(autoEnterGame)
end)

AddEventHandler('sunset:client:characterFlowComplete', function()
    inCharacterFlow = false
    flowStartTimer = nil
    RenderScriptCams(false, true, 500, true, true)
    DestroyAllCams(true)
    DisplayRadar(true)
end)

AddEventHandler('sunset:client:loadingTimedOut', function()
    inCharacterFlow = false
    flowStartTimer = nil
end)

AddEventHandler('sunset:nui:characterCreate', function()
    exports.sunset_ui:Show('create', { firstLogin = false })
end)

AddEventHandler('sunset:nui:characterBack', function()
    CreateThread(showCharacterList)
end)

AddEventHandler('sunset:nui:select', function(data)
    CreateThread(function()
        local char, err = Sunset.AwaitCallbackTimeout('sunset:selectCharacter', 4000, tonumber(data and data.charId))
        if not char then
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('characters.msg.could_not_select_that_character'), 'error')
            return
        end
        spawnCharacter(char)
    end)
end)

AddEventHandler('sunset:nui:create', function(data)
    CreateThread(function()
        local char, err = Sunset.AwaitCallbackTimeout('sunset:createCharacter', 5000, data or {})
        if not char then
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('characters.msg.could_not_create_the_character'), 'error')
            return
        end
        spawnCharacter(char)
    end)
end)

AddEventHandler('sunset:nui:delete', function(data)
    CreateThread(function()
        local deleted, err = Sunset.AwaitCallbackTimeout('sunset:deleteCharacter', 4000, tonumber(data and data.charId))
        if not deleted then
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('characters.msg.could_not_delete_that_character'), 'error')
            return
        end
        exports.sunset_ui:Notify(exports.sunset_core:Translate('characters.message.character_deleted'), 'success')
        showCharacterList()
    end)
end)

-- Startup recovery: ONLY for an actual resource reload while already authenticated
CreateThread(function()
    Wait(1500)
    local isAuth = LocalPlayer.state.sunsetAuthenticated == true
    local isAuthFlow = LocalPlayer.state.sunsetAuthFlowActive == true
    local char = exports.sunset_core:GetCharacter()
    if isAuth and not isAuthFlow and not inCharacterFlow and not char and NetworkIsSessionStarted() then
        print('^2[LOGIN-PERF] CHARACTERS: Resuming character flow on resource reload^7')
        CreateThread(autoEnterGame)
    end
end)
