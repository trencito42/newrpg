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

local function showSpawnSelection(char, optional)
    local charId = char and char.id or 'unknown'
    trace('spawn_selector_open', charId)
    pendingSpawnCharacter = char
    optionalSpawnMenu = optional == true
    local pos = char and char.position
    if type(pos) == 'string' then
        local ok, decoded = pcall(json.decode, pos)
        if ok then pos = decoded end
    end
    -- [AUTO SPAWN] On the normal login flow (optional == false) do NOT show the
    -- picker: resolve the saved preference automatically with the priority
    -- house > faction HQ > default, then spawn. The picker only appears when
    -- the player explicitly types /spawnmenu (optional == true) or an admin
    -- forces it. Last-location spawn was removed entirely.
    if not optionalSpawnMenu then
        local resolveStarted = GetGameTimer()
        local elapsed = flowStartTimer and (GetGameTimer() - flowStartTimer) or 0
        print(('^2[LOGIN-FLOW] 10 CHARACTERS: resolveAutoSpawn request sent | charId=%s elapsed=%dms^7'):format(
            tostring(charId), elapsed))
        local resolved, err = Sunset.AwaitCallback('sunset:resolveAutoSpawn')
        local resolveDur = GetGameTimer() - resolveStarted
        local totalElapsed = flowStartTimer and (GetGameTimer() - flowStartTimer) or resolveDur

        if resolved and resolved.x then
            pendingSpawnCharacter = nil
            local srcName = tostring(resolved.source or 'default')
            print(('^2[LOGIN-FLOW] 11 CHARACTERS: resolveAutoSpawn result = %s coords=(%.2f,%.2f,%.2f) | charId=%s dur=%dms elapsed=%dms^7'):format(
                srcName, resolved.x, resolved.y, resolved.z, tostring(charId), resolveDur, totalElapsed))
            trace('spawn_auto_resolved', ('%s | %dms | coords=%.2f,%.2f,%.2f'):format(
                srcName, resolveDur, resolved.x, resolved.y, resolved.z))
            if SunsetBoot and SunsetBoot.RecordMilestone then
                SunsetBoot.RecordMilestone('resolveAutoSpawn', resolveDur, ('source=%s coords=%.2f,%.2f,%.2f'):format(srcName, resolved.x, resolved.y, resolved.z))
            else
                pcall(function() exports.sunset_core:RecordMilestone('resolveAutoSpawn', resolveDur, ('source=%s'):format(srcName)) end)
            end
            exports.sunset_ui:Show('loading', { holdText = 'Loading character...' })
            TriggerEvent('sunset:client:spawnCharacter', char, resolved)
            return
        end

        -- Deterministic hard fallback: NEVER leave the player stuck or fall through to an invisible picker
        print(('^3[LOGIN-FLOW] 11 CHARACTERS: resolveAutoSpawn failed (%s) -> instant DEFAULT fallback | charId=%s elapsed=%dms^7'):format(
            tostring(err or 'nil_result'), tostring(charId), totalElapsed))
        local def = Sunset.Config.DefaultSpawn or { x = -1037.6, y = -2737.8, z = 13.8, w = 330.0 }
        local fallbackResolved = { x = def.x, y = def.y, z = def.z, w = def.w or 0.0, source = 'default_fallback' }
        pendingSpawnCharacter = nil
        exports.sunset_ui:Show('loading', { holdText = 'Loading character...' })
        TriggerEvent('sunset:client:spawnCharacter', char, fallbackResolved)
        return
    end

    -- The explicit /spawnmenu still checks jail before offering choices. This
    -- path is user-triggered and does not affect the normal login hot path.
    local jail = Sunset.AwaitCallback('sunset:getJailSpawnLock')
    if jail and jail.locked then
        pendingSpawnCharacter = char
        exports.sunset_ui:Show('loading', { holdText = 'Loading character...' })
        TriggerEvent('sunset:client:spawnCharacter', char, {
            x = jail.x, y = jail.y, z = jail.z, w = jail.w or 0.0,
        })
        return
    end

    local homes = Sunset.AwaitCallback('sunset:getSpawnHomes') or {}
    local factionHq = Sunset.AwaitCallback('sunset:getLeaderSpawnHq')
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

local function spawnCharacter(char)
    local charId = char and char.id or 'unknown'
    local elapsed = flowStartTimer and (GetGameTimer() - flowStartTimer) or 0
    print(('^2[LOGIN-FLOW] 09 CHARACTERS: spawnCharacter() entered | charId=%s elapsed=%dms^7'):format(
        tostring(charId), elapsed))

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
                    Sunset.AwaitCallback('sunset:saveAppearance', def, char.gender or 0, char.id)
                end)
            end)
        end
    end
    showSpawnSelection(char)
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
    local resolved, err = Sunset.AwaitCallback('sunset:resolveSpawnChoice', choice, tonumber(data and data.propertyId))
    if not resolved then
        exports.sunset_ui:Send('spawnSelectFailed', {})
        return exports.sunset_ui:Notify(err or 'That spawn location is unavailable.', 'error', 6000)
    end
    local char = pendingSpawnCharacter
    pendingSpawnCharacter = nil
    optionalSpawnMenu = false
    trace('spawn_selected', choice)
    exports.sunset_ui:Show('loading', { holdText = 'Loading character...' })
    TriggerEvent('sunset:client:spawnCharacter', char, resolved)
end)

AddEventHandler('sunset:nui:spawnClose', function()
    closeOptionalSpawnMenu()
end)

local function showCharacterList()
    local characters, err = Sunset.AwaitCallback('sunset:getCharacters')
    if type(characters) ~= 'table' then
        exports.sunset_ui:Notify(err or 'Could not load your characters', 'error')
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

    local elapsed04 = GetGameTimer() - flowStartTimer
    print(('^2[LOGIN-FLOW] 04 CHARACTERS: autoEnterGame entered | elapsed=%dms^7'):format(elapsed04))
    trace('character_request_started')

    -- [AUTH UI SPLIT] sunset_ui is started lazily after login; the character
    -- list screen lives there, so wait for it before driving the flow.
    local uiState = GetResourceState('sunset_ui')
    print(('^2[LOGIN-FLOW] 05 CHARACTERS: sunset_ui state = %s | elapsed=%dms^7'):format(
        tostring(uiState), GetGameTimer() - flowStartTimer))

    local uiDeadline = GetGameTimer() + 15000
    while GetResourceState('sunset_ui') ~= 'started' and GetGameTimer() < uiDeadline do
        Wait(100)
    end

    -- [LOGIN PIPELINE] The server callback is idempotent now, so a transient
    -- failure (DB hiccup, callback rate limit) is retried instead of bouncing an
    -- already-authenticated player back to a login form that can no longer work.
    local tEnterStart = GetGameTimer()
    local result, err
    print(('^2[LOGIN-FLOW] 06 CHARACTERS: sunset:enterGame request sent | elapsed=%dms^7'):format(
        GetGameTimer() - flowStartTimer))

    for attempt = 1, 3 do
        result, err = Sunset.AwaitCallback('sunset:enterGame')
        if result and result.character then break end
        trace('character_request_retry', ('attempt=%d err=%s'):format(attempt, tostring(err or 'empty_response')))
        if attempt < 3 then Wait(1500) end
    end
    local enterDur = GetGameTimer() - tEnterStart
    local enterTotalElapsed = GetGameTimer() - flowStartTimer

    if result and result.character then
        local charId = result.character.id
        print(('^2[LOGIN-FLOW] 07 CHARACTERS: sunset:enterGame response received | success=true callbackDur=%dms elapsed=%dms^7'):format(
            enterDur, enterTotalElapsed))
        print(('^2[LOGIN-FLOW] 08 CHARACTERS: character id = %s | name=%s %s | elapsed=%dms^7'):format(
            tostring(charId), tostring(result.character.firstname or ''), tostring(result.character.lastname or ''), enterTotalElapsed))

        if SunsetBoot and SunsetBoot.RecordMilestone then
            SunsetBoot.RecordMilestone('enterGame_callback', enterDur, ('charId=%s'):format(tostring(charId)))
        else
            pcall(function() exports.sunset_core:RecordMilestone('enterGame_callback', enterDur) end)
        end
        trace('character_request_complete', ('%s | %dms'):format(tostring(charId), enterDur))
        spawnCharacter(result.character)
        return
    end

    print(('^1[LOGIN-FLOW] 07 CHARACTERS: sunset:enterGame response failed | err=%s callbackDur=%dms elapsed=%dms^7'):format(
        tostring(err or 'empty_response'), enterDur, enterTotalElapsed))
    trace('character_request_failed', ('%s | %dms'):format(tostring(err or 'empty_response'), enterDur))
    inCharacterFlow = false
    if GetResourceState('sunset_auth') == 'started' then
        TriggerEvent('sunset:auth:openLogin')
    else
        exports.sunset_ui:Show('auth', {})
        exports.sunset_ui:SetFocus(true, true)
    end
    exports.sunset_ui:Notify(err or 'Could not load your character', 'error')
end

AddEventHandler('sunset:client:onPlayerReady', function()
    Wait(500)
    autoEnterGame()
end)

-- Authentication callbacks and playerReady are separate network messages.
-- Starting from both is intentional; inCharacterFlow makes this idempotent.
AddEventHandler('sunset:client:authenticationComplete', function()
    flowStartTimer = GetGameTimer()
    print('^2[LOGIN-FLOW] 03 CHARACTERS: authenticationComplete event received^7')
    autoEnterGame()
end)

AddEventHandler('sunset:client:characterFlowComplete', function()
    inCharacterFlow = false
    flowStartTimer = nil
    RenderScriptCams(false, true, 1000, true, true)
    DestroyAllCams(true)
    -- sunset_spawn sends enterGameplay, which owns the cross-fade and hides the
    -- entry UI when that transition completes. Hiding it again here cut the
    -- animation short and could expose a black/world frame between screens.
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
        local char, err = Sunset.AwaitCallback('sunset:selectCharacter', tonumber(data and data.charId))
        if not char then
            exports.sunset_ui:Notify(err or 'Could not select that character', 'error')
            return
        end
        spawnCharacter(char)
    end)
end)

AddEventHandler('sunset:nui:create', function(data)
    CreateThread(function()
        local char, err = Sunset.AwaitCallback('sunset:createCharacter', data or {})
        if not char then
            exports.sunset_ui:Notify(err or 'Could not create the character', 'error')
            return
        end
        spawnCharacter(char)
    end)
end)

AddEventHandler('sunset:nui:delete', function(data)
    CreateThread(function()
        local deleted, err = Sunset.AwaitCallback('sunset:deleteCharacter', tonumber(data and data.charId))
        if not deleted then
            exports.sunset_ui:Notify(err or 'Could not delete that character', 'error')
            return
        end
        exports.sunset_ui:Notify(exports.sunset_core:Translate('characters.message.character_deleted'), 'success')
        showCharacterList()
    end)
end)

-- Startup recovery: if resource is restarted / client joins while authenticated
CreateThread(function()
    Wait(500)
    local isAuth = LocalPlayer.state.sunsetAuthenticated or (GetResourceState('sunset_auth') == 'started' and exports.sunset_auth:IsAuthenticated())
    local char = exports.sunset_core:GetCharacter()
    if isAuth and not inCharacterFlow and not char then
        print('^2[LOGIN-FLOW] CHARACTERS: Resuming character flow on resource start / reload^7')
        autoEnterGame()
    end
end)
