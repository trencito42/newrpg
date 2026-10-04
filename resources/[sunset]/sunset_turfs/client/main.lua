-- [NUI FOCUS] Route focus through the central manager (owner tracked, guarded release).
function TURFS_SetNuiFocus(hasFocus, hasCursor, keepInput)
    if GetResourceState('sunset_ui') ~= 'started' then return false end
    local ok, res = pcall(function()
        return exports.sunset_ui:SetFocus(hasFocus, hasCursor, keepInput == true, 'turfs')
    end)
    return ok and res ~= false
end

-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Turf Wars Client
--  SAMP-style map zones, war HUD, clan-colored enemy blips
-- ═══════════════════════════════════════════════════════════════

local LocalTurfs = {}
local ActiveWar = nil
local CurrentTurf = nil
local TurfBlips = {}
local WarPlayerBlips = {}
local WarBlipPulse = false

local BLIP_DISPLAY_PAUSE_MAP = 3 -- pause map (M) only — never minimap
local BLIP_DISPLAY_BOTH = 2
local BLIP_SPRITE_PLAYER = 1

local function hexToBlipColour(hex)
    if not hex or hex == '' then return 38 end
    hex = tostring(hex):gsub('#', '')
    if #hex ~= 6 then return 38 end
    local r = tonumber(hex:sub(1, 2), 16) or 0
    local g = tonumber(hex:sub(3, 4), 16) or 0
    local b = tonumber(hex:sub(5, 6), 16) or 0
    if g > r and g > b and g > 150 then return 2 end
    if r > g and r > b and r > 150 then return 1 end
    if b > r and b > g and b > 150 then return 3 end
    if r > 200 and g > 120 and b < 90 then return 46 end
    if r > 200 and g > 200 then return 5 end
    if g > 180 and b > 180 then return 43 end
    return 38
end

local function removeBlipHandle(blip)
    if blip and DoesBlipExist(blip) then RemoveBlip(blip) end
end

local function clearTurfBlips()
    for _, row in pairs(TurfBlips) do
        removeBlipHandle(row.area)
        removeBlipHandle(row.center)
    end
    TurfBlips = {}
end

local function clearWarPlayerBlips()
    for sid, blip in pairs(WarPlayerBlips) do
        removeBlipHandle(blip)
        WarPlayerBlips[sid] = nil
    end
end

local function turfAtWar(turfId)
    return ActiveWar and tonumber(ActiveWar.turfId) == tonumber(turfId)
end

local function turfAreaColour(turf, atWar)
    if atWar then
        return WarBlipPulse and 1 or 17
    end
    if turf.ownerClanId then
        return hexToBlipColour(turf.ownerColor)
    end
    return SunsetTurfs.FreeTurfBlipColour or 27
end

local function applyTurfBlipStyle(turf, row, atWar)
    local radius = turf.radius or 110.0
    local zoneAlpha = SunsetTurfs.TurfBlipAlpha or 80
    local zoneColour = turfAreaColour(turf, atWar)

    if atWar then
        zoneAlpha = SunsetTurfs.TurfBlipAlphaWar or 120
    end

    if row.area and DoesBlipExist(row.area) then
        SetBlipDisplay(row.area, BLIP_DISPLAY_BOTH)
        SetBlipAlpha(row.area, zoneAlpha)
        SetBlipColour(row.area, zoneColour)
        SetBlipAsShortRange(row.area, false)
        SetBlipFlashes(row.area, atWar)
    end

    if row.center and DoesBlipExist(row.center) then
        SetBlipSprite(row.center, 437)
        SetBlipDisplay(row.center, BLIP_DISPLAY_BOTH)
        SetBlipScale(row.center, 0.7)
        SetBlipColour(row.center, zoneColour)
        SetBlipAlpha(row.center, atWar and 255 or 210)
        SetBlipAsShortRange(row.center, false)
        SetBlipFlashes(row.center, atWar)
        BeginTextCommandSetBlipName('STRING')
        local suffix = atWar and ' | RAZBOI' or ''
        AddTextComponentSubstringPlayerName(exports.sunset_core:Translate('turfs.msg.turf', { id = math.floor(tonumber(turf.id) or 0), name = tostring(turf.name), owner_tag = turf.ownerTag or exports.sunset_core:Translate('turfs.word.liber'), suffix = tostring(suffix) }))
        EndTextCommandSetBlipName(row.center)
    end
end

local function refreshBlips()
    clearTurfBlips()
    for id, t in pairs(LocalTurfs) do
        if not t.coords or not t.coords.x or not t.coords.y or not t.coords.z then goto continue end
        local atWar = turfAtWar(id)
        -- Center marker only. The circular radius blip is not the attack polygon;
        -- the Turf Map (/turfs) draws the authoritative vertices.
        local centerBlip = exports.sunset_core:CreateSafeBlip(t.coords, {
            sprite = 84,
            scale = 0.7,
            shortRange = false
        })
        if centerBlip then
            TurfBlips[id] = { center = centerBlip }
            applyTurfBlipStyle(t, TurfBlips[id], atWar)
        end
        ::continue::
    end
end

local function refreshWarTurfBlipPulse()
    if not ActiveWar then return end
    local row = TurfBlips[ActiveWar.turfId]
    local turf = LocalTurfs[ActiveWar.turfId]
    if row and turf then
        applyTurfBlipStyle(turf, row, true)
    end
end

local function myWarClanRole()
    if not ActiveWar then return nil end
    local myClan = LocalPlayer.state.sunsetClanId
    if not myClan then return nil end
    if tonumber(myClan) == tonumber(ActiveWar.attackerClanId) then return 'attacker' end
    if ActiveWar.defenderClanId and tonumber(myClan) == tonumber(ActiveWar.defenderClanId) then return 'defender' end
    return nil
end

local function syncWarPlayerBlips()
    if not ActiveWar then
        clearWarPlayerBlips()
        return
    end

    local role = myWarClanRole()
    if not role then
        clearWarPlayerBlips()
        return
    end

    local turf = LocalTurfs[ActiveWar.turfId]
    if not turf or not turf.coords then
        clearWarPlayerBlips()
        return
    end

    local seen = {}
    local friendlyHex = ActiveWar.attackerColor
    local enemyHex = ActiveWar.defenderColor
    if role == 'defender' then
        friendlyHex = ActiveWar.defenderColor
        enemyHex = ActiveWar.attackerColor
    end
    local friendlyColour = hexToBlipColour(friendlyHex)
    local enemyColour = hexToBlipColour(enemyHex)

    for _, playerId in ipairs(GetActivePlayers()) do
        local ped = GetPlayerPed(playerId)
        if ped == 0 or not DoesEntityExist(ped) then goto continue end

        local sid = GetPlayerServerId(playerId)
        if sid <= 0 then goto continue end

        local pos = GetEntityCoords(ped)
        if #(pos - turf.coords) > (turf.radius or 110.0) then goto continue end

        local pClan = Player(sid).state.sunsetClanId
        if not pClan then goto continue end

        local isFriendly = (role == 'attacker' and tonumber(pClan) == tonumber(ActiveWar.attackerClanId))
            or (role == 'defender' and ActiveWar.defenderClanId and tonumber(pClan) == tonumber(ActiveWar.defenderClanId))

        seen[sid] = true
        local blip = WarPlayerBlips[sid]
        if not blip or not DoesBlipExist(blip) then
            blip = AddBlipForEntity(ped)
            WarPlayerBlips[sid] = blip
            SetBlipSprite(blip, BLIP_SPRITE_PLAYER)
            SetBlipDisplay(blip, BLIP_DISPLAY_BOTH)
            SetBlipScale(blip, 0.85)
            SetBlipAsShortRange(blip, false)
        end

        local colour = isFriendly and friendlyColour or enemyColour
        SetBlipColour(blip, colour)
        SetBlipFlashes(blip, not isFriendly)

        BeginTextCommandSetBlipName('STRING')
        if isFriendly then
            AddTextComponentSubstringPlayerName(exports.sunset_core:Translate('turfs.msg.friendly', { clan_tag = Player(sid).state.clanTag or exports.sunset_core:Translate('turfs.word.clan') }))
        else
            AddTextComponentSubstringPlayerName(exports.sunset_core:Translate('turfs.msg.enemy', { clan_tag = Player(sid).state.clanTag or exports.sunset_core:Translate('turfs.word.clan') }))
        end
        EndTextCommandSetBlipName(blip)

        ::continue::
    end

    for sid, blip in pairs(WarPlayerBlips) do
        if not seen[sid] then
            removeBlipHandle(blip)
            WarPlayerBlips[sid] = nil
        end
    end
end

local LocalAdjacency = {}
local turfDebugActive = false
local turfEditActive = false
local editTurfId = nil
local editVertices = {}

local isTurfMapOpen = false

RegisterNetEvent('sunset:turfs:syncAll', function(turfs, adjacency)
    LocalTurfs = turfs or {}
    LocalAdjacency = adjacency or {}
    refreshBlips()
    if isTurfMapOpen then
        exports.sunset_ui:Send('turfMapSync', {
            turfs = LocalTurfs,
            adjacency = LocalAdjacency
        })
    end
end)

RegisterNetEvent('sunset:turfs:warStart', function(war)
    ActiveWar = war
    refreshBlips()
    if isTurfMapOpen then
        exports.sunset_ui:Send('turfMapWarUpdate', war)
    end
    if warParticipant then
        PlaySoundFrontend(-1, 'CHECKPOINT_PERFECT', 'HUD_MINI_GAME_SOUNDSET', true)
        exports.sunset_ui:Send('warHudShow', {
            attackerName = war.attackerName,
            defenderName = war.defenderName,
            attackerColor = war.attackerColor or '#00ffcc',
            defenderColor = war.defenderColor or '#8b5cf6',
            attackerScore = war.attackerScore or 0,
            defenderScore = war.defenderScore or 0,
            scoreTarget = war.scoreTarget,
            turfName = war.turfName,
            remainingSec = war.remainingSec or 0,
            isNeutralCapture = war.isNeutralCapture,
            captureTarget = war.captureTarget,
        })
    end
    if war.isNeutralCapture then
        exports.sunset_ui:Notify(
            exports.sunset_core:Translate('turfs.msg.capturing_hold_the_zone_for_seconds', { turf_name = war.turfName or exports.sunset_core:Translate('turfs.word.turf'), capture_target = math.floor(tonumber(war.captureTarget or SunsetTurfs.NeutralCaptureSec or 180) or 0), value = math.floor(tonumber(1) or 0) }),
            'info',
            9000
        )
    end
end)

RegisterNetEvent('sunset:turfs:warTick', function(war)
    if ActiveWar and ActiveWar.turfId == war.turfId then
        ActiveWar = war
    end
    if isTurfMapOpen then
        exports.sunset_ui:Send('turfMapWarUpdate', war)
    end
end)

RegisterNetEvent('sunset:turfs:warEnd', function(data)
    if ActiveWar and ActiveWar.turfId == data.turfId then
        ActiveWar = nil
    end
    clearWarPlayerBlips()
    refreshBlips()
    if isTurfMapOpen then
        exports.sunset_ui:Send('turfMapWarEnd', data)
    end
    exports.sunset_ui:Send('warHudHide', {})
    exports.sunset_ui:Send('warRespawnHide', {})
    exports.sunset_ui:Send('warScoreboardHide', {})
    exports.sunset_ui:Send('warArmoryHide', {})
    if warParticipant then
        warParticipant = false
        local myRole = myWarRole or 'defender'
        PlaySoundFrontend(-1, 'RACE_PLACED', 'HUD_AWARDS', true)
        TriggerEvent('sunset:turfs:warEndedLocal')
        exports.sunset_ui:Send('warEndShow', {
            turfId = data.turfId,
            turfName = data.turfName,
            attackerName = data.attackerName,
            defenderName = data.defenderName,
            attackerWon = data.attackerWon,
            attackerScore = data.attackerScore,
            defenderScore = data.defenderScore,
            mvp = data.mvp,
            myRole = myRole,
            resultType = data.resultType,
            isNeutralCapture = data.isNeutralCapture,
            captureTarget = data.captureTarget,
            territoryRemainsFree = data.territoryRemainsFree,
        })
        exports.sunset_ui:SetFocus(true, true)
    end
    myWarRole = nil
end)

-- Zone presence & detection loop (polygon containment)
CreateThread(function()
    Wait(2000)
    TriggerServerEvent('sunset:turfs:requestSync')

    AddEventHandler('sunset:client:playerSpawned', function()
        SetTimeout(1500, function()
            TriggerServerEvent('sunset:turfs:requestSync')
        end)
    end)

    while true do
        Wait(600)
        local ped = PlayerPedId()
        if ped and ped ~= 0 then
            local pos = GetEntityCoords(ped)
            local insideAny = nil

            for _, t in pairs(LocalTurfs) do
                if t.polygon and #t.polygon >= 3 then
                    local zOk = (pos.z >= (t.minZ or -50.0)) and (pos.z <= (t.maxZ or 500.0))
                    if zOk and SunsetTurfs.IsPointInPolygon(pos, t.polygon) then
                        insideAny = t
                        break
                    end
                else
                    if #(pos - t.coords) <= (t.radius or 110.0) then
                        insideAny = t
                        break
                    end
                end
            end

            if insideAny and insideAny ~= CurrentTurf then
                CurrentTurf = insideAny
                local ownerStr = insideAny.ownerClanId
                    and ('[%s] %s'):format(insideAny.ownerTag, insideAny.ownerName)
                    or 'Free'
                exports.sunset_ui:Notify(
                    exports.sunset_core:Translate('turfs.msg.territory', { name = tostring(insideAny.name), owner_str = tostring(ownerStr) }),
                    'info',
                    4500
                )
            elseif not insideAny and CurrentTurf then
                CurrentTurf = nil
            end
        end
    end
end)

-- In-world Developer Polygon Debug Renderer & Interactive Editor
CreateThread(function()
    while true do
        if turfDebugActive or turfEditActive then
            local pPed = PlayerPedId()
            local pCoords = GetEntityCoords(pPed)

            -- 1. Render all active polygons if debug is on
            if turfDebugActive and not turfEditActive then
                for id, t in pairs(LocalTurfs) do
                    if t.polygon and #t.polygon >= 3 then
                        local pts = t.polygon
                        local n = #pts
                        for i = 1, n do
                            local p1 = pts[i]
                            local p2 = pts[(i % n) + 1]
                            local z = t.coords.z
                            DrawLine(p1.x, p1.y, z - 2.0, p2.x, p2.y, z - 2.0, 0, 255, 204, 255)
                            DrawLine(p1.x, p1.y, z + 8.0, p2.x, p2.y, z + 8.0, 0, 255, 204, 255)
                            DrawLine(p1.x, p1.y, z - 2.0, p1.x, p1.y, z + 8.0, 0, 200, 255, 200)
                        end
                    end
                end
            end

            -- 2. Render live editor vertices
            if turfEditActive then
                local n = #editVertices
                for i = 1, n do
                    local pt = editVertices[i]
                    DrawMarker(28, pt.x, pt.y, pt.z, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.2, 1.2, 1.2, 255, 50, 80, 200, false, false, 2, false, nil, nil, false)
                    DrawLine(pt.x, pt.y, pt.z - 5.0, pt.x, pt.y, pt.z + 15.0, 255, 100, 100, 255)
                    if i > 1 then
                        local prev = editVertices[i - 1]
                        DrawLine(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z, 255, 255, 0, 255)
                    end
                end
                if n >= 3 then
                    local first = editVertices[1]
                    local last = editVertices[n]
                    DrawLine(last.x, last.y, last.z, first.x, first.y, first.z, 0, 255, 150, 255)
                end

                -- Draw Editor On-Screen Controls Text
                SetTextFont(0)
                SetTextScale(0.35, 0.35)
                SetTextColour(255, 255, 255, 240)
                SetTextOutline()
                BeginTextCommandDisplayText('STRING')
                AddTextComponentSubstringPlayerName(exports.sunset_core:Translate('turfs.msg.y_turf_editor_s_vertices_g', { edit_turf_id = math.floor(tonumber(editTurfId or 0) or 0), count = math.floor(tonumber(n) or 0) }))
                EndTextCommandDisplayText(0.02, 0.02)

                -- Key bindings for editor
                DisableControlAction(0, 38, true) -- E
                DisableControlAction(0, 73, true) -- X
                DisableControlAction(0, 20, true) -- Z
                DisableControlAction(0, 18, true) -- ENTER
                DisableControlAction(0, 177, true) -- BACKSPACE

                if IsDisabledControlJustPressed(0, 38) then -- E: Add point
                    local pos = GetEntityCoords(pPed)
                    table.insert(editVertices, { x = math.floor(pos.x * 10) / 10, y = math.floor(pos.y * 10) / 10, z = math.floor(pos.z * 10) / 10 })
                    PlaySoundFrontend(-1, 'NAV_UP_DOWN', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
                elseif IsDisabledControlJustPressed(0, 73) then -- X: Remove last
                    if #editVertices > 0 then
                        table.remove(editVertices)
                        PlaySoundFrontend(-1, 'CANCEL', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
                    end
                elseif IsDisabledControlJustPressed(0, 20) then -- Z: Clear
                    editVertices = {}
                    PlaySoundFrontend(-1, 'CANCEL', 'HUD_FRONTEND_DEFAULT_SOUNDSET', true)
                elseif IsDisabledControlJustPressed(0, 18) then -- ENTER: Save
                    if #editVertices >= 3 then
                        CreateThread(function()
                            local ok, msg = Sunset.AwaitCallback('sunset:turfs:savePolygon', editTurfId, editVertices)
                            if ok then
                                exports.sunset_ui:Notify(msg or exports.sunset_core:Translate('turfs.msg.polygon_saved_successfully'), 'success', 6000)
                                turfEditActive = false
                                editVertices = {}
                            else
                                exports.sunset_ui:Notify(msg or exports.sunset_core:Translate('turfs.msg.failed_to_save_polygon'), 'error', 6000)
                            end
                        end)
                    else
                        exports.sunset_ui:Notify(exports.sunset_core:Translate('turfs.message.polygon_must_have_at_least_3_vertices'), 'error', 4000)
                    end
                elseif IsDisabledControlJustPressed(0, 177) then -- BACKSPACE / ESC: Cancel
                    turfEditActive = false
                    editVertices = {}
                    exports.sunset_ui:Notify(exports.sunset_core:Translate('turfs.message.turf_editing_cancelled'), 'info', 4000)
                end
            end

            Wait(0)
        else
            Wait(1000)
        end
    end
end)

RegisterCommand('turfdebug', function()
    if GetConvarInt('sunset_dev', 0) ~= 1 then return end -- dev-only (setr sunset_dev 1)
    turfDebugActive = not turfDebugActive
    exports.sunset_ui:Notify(exports.sunset_core:Translate('turfs.msg.turf_polygon_wireframe_visualizer', { turf_debug_active = turfDebugActive and exports.sunset_core:Translate('turfs.word.activat') or exports.sunset_core:Translate('turfs.word.dezactivat') }), turfDebugActive and 'success' or 'info', 4000)
end, false)

local function startEditingTurf(turfId)
    turfId = tonumber(turfId)
    if not turfId or not LocalTurfs[turfId] then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('turfs.message.usage_turfedit_1_18_see_turflist'), 'warning', 4000)
        return
    end

    editTurfId = turfId
    local existing = LocalTurfs[turfId].polygon
    editVertices = {}
    if existing and #existing >= 3 then
        for _, pt in ipairs(existing) do
            table.insert(editVertices, { x = pt.x, y = pt.y, z = pt.z or LocalTurfs[turfId].coords.z })
        end
    end
    turfEditActive = true
    exports.sunset_ui:Notify(exports.sunset_core:Translate('turfs.msg.editing_polygon_for_turf_stand_at', { turf_id = math.floor(tonumber(turfId) or 0), name = tostring(LocalTurfs[turfId].name) }), 'info', 8000)
end

RegisterCommand('turfedit', function(_, args)
    startEditingTurf(args[1])
end, false)

RegisterCommand('editturf', function(_, args)
    startEditingTurf(args[1])
end, false)

CreateThread(function()
    while true do
        if ActiveWar then
            WarBlipPulse = not WarBlipPulse
            refreshWarTurfBlipPulse()
            Wait(650)
        else
            Wait(1200)
        end
    end
end)

CreateThread(function()
    while true do
        if ActiveWar and myWarClanRole() then
            syncWarPlayerBlips()
            Wait(450)
        else
            clearWarPlayerBlips()
            Wait(1000)
        end
    end
end)

-- ═══════════════════════════════════════════════════════════════
--  [WAR REDESIGN] Participant flow: join -> armory (loadout) ->
--  fight -> death -> respawn in zone with HP/armor -> war end screen.
-- ═══════════════════════════════════════════════════════════════
warParticipant = false            -- server said we're in the war
myWarRole = nil                   -- 'attacker' | 'defender'
local warWeapons = {}             -- loadout weapon hashes to strip at war end
local armoryOpen = false
local respawnPending = false

local function closeArmory()
    if not armoryOpen then return end
    armoryOpen = false
    exports.sunset_ui:Send('warArmoryHide', {})
    exports.sunset_ui:SetFocus(false, false)
end

RegisterNetEvent('sunset:turfs:warJoined', function(data)
    warParticipant = true
    myWarRole = data and data.role or 'defender'
    exports.sunset_ui:Notify(exports.sunset_core:Translate('turfs.message.you_joined_the_war_armory_for_loadout_z_war'), 'warning', 9000)
    -- [MOBILIZATION] Loud targeted alert for defenders: your turf is under
    -- attack, get there (rally window before zone scoring).
    if myWarRole == 'defender' then
        PlaySoundFrontend(-1, 'Event_Start_Text', 'HUD_MINI_GAME_SOUNDSET', true)
        exports.sunset_ui:Notify(exports.sunset_core:Translate('turfs.message.your_territory_is_under_attack_rally_now_scoring_starts'), 'error', 12000)
    end
    -- [WAR FIX] warStart (-1 broadcast) arrives BEFORE the ticker registers us
    -- as participant, so the participant-gated warHudShow never fired for the
    -- attacker who started the war. Show the HUD here from the cached war data.
    if ActiveWar and ActiveWar.turfId == (data and data.turfId or ActiveWar.turfId) then
        exports.sunset_ui:Send('warHudShow', {
            attackerName = ActiveWar.attackerName,
            defenderName = ActiveWar.defenderName,
            attackerScore = ActiveWar.attackerScore or 0,
            defenderScore = ActiveWar.defenderScore or 0,
            scoreTarget = ActiveWar.scoreTarget,
            turfName = ActiveWar.turfName,
            remainingSec = ActiveWar.remainingSec or 0,
            isNeutralCapture = ActiveWar.isNeutralCapture,
            captureTarget = ActiveWar.captureTarget,
        })
    end
    -- Auto-open the armory on first join so players discover the loadout menu.
    if not armoryOpen and not IsNuiFocused() then
        CreateThread(function()
            local info = Sunset.AwaitCallback('sunset:turfs:armoryData')
            if info and warParticipant then
                armoryOpen = true
                exports.sunset_ui:Send('warArmoryShow', info)
                exports.sunset_ui:SetFocus(true, true)
            end
        end)
    end
end)

RegisterCommand('armory', function()
    if not warParticipant then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('turfs.message.you_are_not_in_an_active_war'), 'error')
        return
    end
    if armoryOpen then closeArmory() return end
    CreateThread(function()
        local info = Sunset.AwaitCallback('sunset:turfs:armoryData')
        if not info then exports.sunset_ui:Notify(exports.sunset_core:Translate('turfs.message.the_armory_is_not_available_right_now'), 'error') return end
        armoryOpen = true
        exports.sunset_ui:Send('warArmoryShow', info)
        exports.sunset_ui:SetFocus(true, true)
    end)
end, false)

-- [ARMORY FIX] Legacy alias: players used to type /armurie and got an
-- "unknown command" error since the alias went missing. /armory is canonical.
RegisterCommand('armurie', function()
    ExecuteCommand('armory')
end, false)

AddEventHandler('sunset:nui:warArmoryClose', function()
    closeArmory()
end)

AddEventHandler('sunset:nui:warTakeLoadout', function(data)
    CreateThread(function()
        local ok, name = Sunset.AwaitCallback('sunset:turfs:takeLoadout', data and data.loadoutId)
        if ok then
            exports.sunset_ui:Notify(exports.sunset_core:Translate('turfs.msg.package_equipped', { name = tostring(name or '') }), 'success')
            closeArmory()
        else
            exports.sunset_ui:Notify(name or exports.sunset_core:Translate('turfs.msg.could_not_equip_the_package'), 'error')
        end
    end)
end)

RegisterNetEvent('sunset:turfs:grantLoadout', function(payload)
    local ped = PlayerPedId()
    if payload.heal then
        SetEntityHealth(ped, GetEntityMaxHealth(ped))
    end
    if payload.armor and payload.armor > 0 then
        SetPedArmour(ped, math.min(100, payload.armor))
    end
    for _, w in ipairs(payload.weapons or {}) do
        local hash = type(w.weapon) == 'number' and w.weapon or joaat(w.weapon)
        GiveWeaponToPed(ped, hash, w.ammo or 120, false, true)
        -- [WAR FIX] Track granted hashes so they can be stripped when the war
        -- ends (previously the sniper kit stayed forever after the war).
        warWeapons[hash] = true
        -- [CARRY EXCEPTION] Register with the inventory weapon-consistency loop
        -- so it does not strip war loadout weapons (they are not inventory rows).
        if GetResourceState('sunset_inventory') == 'started' then
            pcall(function() exports.sunset_inventory:AddCarryException(hash) end)
        end
    end
end)

-- [WAR FIX] Strip every loadout weapon granted during the war.
local function stripWarWeapons()
    local ped = PlayerPedId()
    for hash in pairs(warWeapons) do
        if HasPedGotWeapon(ped, hash, false) then
            RemoveWeaponFromPed(ped, hash)
        end
        warWeapons[hash] = nil
        if GetResourceState('sunset_inventory') == 'started' then
            pcall(function() exports.sunset_inventory:AddCarryException(hash, true) end)
        end
    end
    SetPedArmour(ped, 0)
    SetCurrentPedWeapon(ped, joaat('WEAPON_UNARMED'), true)
end

-- War respawn: server picks the coords and re-grants the chosen loadout.
RegisterNetEvent('sunset:turfs:doWarRespawn', function(payload)
    respawnPending = false
    exports.sunset_ui:Send('warRespawnHide', {})
    -- [FOCUS FIX] Guarantee mouse/cursor release after the war respawn, even if
    -- some panel (armory/respawn UI) still held focus through the death.
    exports.sunset_ui:SetFocus(false, false)
    -- Clear sunset_death downed state (same pattern as the jail intake flow)
    -- so bleedout anim/controls do not race the war respawn.
    pcall(function() exports.sunset_death:ClearDead() end)
    NetworkResurrectLocalPlayer(payload.coords.x, payload.coords.y, payload.coords.z, 0.0, true, false)
    local ped = PlayerPedId()
    ClearPedTasksImmediately(ped)
    SetEntityHealth(ped, GetEntityMaxHealth(ped))
    SetPedArmour(ped, math.min(100, payload.armor or 50))
    for _, w in ipairs(payload.weapons or {}) do
        local hash = type(w.weapon) == 'number' and w.weapon or joaat(w.weapon)
        GiveWeaponToPed(ped, hash, w.ammo or 120, false, true)
    end
    SetPlayerControl(PlayerId(), true, 0)
end)

local function startWarRespawnCountdown()
    if respawnPending then return end
    respawnPending = true
    closeArmory()
    CreateThread(function()
        local secs = SunsetTurfs.RespawnDelaySec or 5
        exports.sunset_ui:Send('warRespawnShow', { seconds = secs })
        while secs > 0 and warParticipant do
            Wait(1000)
            secs = secs - 1
            exports.sunset_ui:Send('warRespawnShow', { seconds = secs })
        end
        if warParticipant then
            Sunset.AwaitCallback('sunset:turfs:warRespawn')
        else
            respawnPending = false
            exports.sunset_ui:Send('warRespawnHide', {})
        end
    end)
end

-- Death watch: only for war participants (the normal death/EMS flow stays
-- intact for everyone else). Downed in war -> respawn inside the zone.
CreateThread(function()
    while true do
        if warParticipant and not respawnPending then
            local ped = PlayerPedId()
            if IsEntityDead(ped) or IsPedFatallyInjured(ped) then
                startWarRespawnCountdown()
            end
            Wait(400)
        else
            Wait(800)
        end
    end
end)

-- Z scoreboard during war (overrides the global player list for participants).
-- [ALT-TAB FIX] Edge detection on the Z key breaks when the player alt-tabs:
-- the key release is never observed, so zDown stayed true and the scoreboard
-- remained stuck after returning. Now the scoreboard is also force-hidden by a
-- hard timeout and re-checked state-wise every tick.
CreateThread(function()
    local zDown = false
    local zShownAt = 0
    while true do
        if warParticipant and not IsNuiFocused() then
            DisableControlAction(0, 20, true)
            local pressed = IsDisabledControlPressed(0, 20) and not IsPauseMenuActive()
            if pressed and not zDown then
                zDown = true
                zShownAt = GetGameTimer()
                CreateThread(function()
                    local data = Sunset.AwaitCallback('sunset:turfs:warScoreboard')
                    if data and zDown then exports.sunset_ui:Send('warScoreboardShow', data) end
                end)
            elseif zDown and (not pressed or (GetGameTimer() - zShownAt) > 60000) then
                zDown = false
                exports.sunset_ui:Send('warScoreboardHide', {})
            end
            Wait(0)
        else
            if zDown then
                zDown = false
                exports.sunset_ui:Send('warScoreboardHide', {})
            end
            Wait(300)
        end
    end
end)

AddEventHandler('sunset:nui:warEndClose', function()
    exports.sunset_ui:Send('warEndHide', {})
    exports.sunset_ui:SetFocus(false, false)
end)

-- [WAR FIX] Fired from the warEnd handler after warParticipant is cleared:
-- remove the loadout kit so players don't keep sniper/rifle weapons forever.
AddEventHandler('sunset:turfs:warEndedLocal', function()
    stripWarWeapons()
    myWarRole = nil
    respawnPending = false
    exports.sunset_ui:Send('warRespawnHide', {})
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    closeArmory()
    clearTurfBlips()
    clearWarPlayerBlips()
    exports.sunset_ui:Send('warHudHide', {})
    exports.sunset_ui:Send('warRespawnHide', {})
    exports.sunset_ui:Send('warScoreboardHide', {})
    exports.sunset_ui:Send('warEndHide', {})
end)

CreateThread(function()
    while true do
        -- [WAR FIX] HUD updates only for participants (was sent to everyone).
        if ActiveWar and warParticipant then
            exports.sunset_ui:Send('warHudUpdate', {
                attackerName = ActiveWar.attackerName,
                defenderName = ActiveWar.defenderName,
                attackerScore = ActiveWar.attackerScore or 0,
                defenderScore = ActiveWar.defenderScore or 0,
                scoreTarget = ActiveWar.scoreTarget,
                turfName = ActiveWar.turfName,
                remainingSec = ActiveWar.remainingSec or 0,
                isNeutralCapture = ActiveWar.isNeutralCapture,
                captureTarget = ActiveWar.captureTarget,
            })
            Wait(250)
        else
            Wait(1000)
        end
    end
end)

-- [HUD STUCK FIX] Reconcile local war state with the server every 10s. If the
-- war ended while we were alt-tabbed / disconnected and we missed the warEnd
-- broadcast, the HUD/armory/scoreboard would stay stuck forever. When the
-- server says "no war for you", force-hide everything locally.
CreateThread(function()
    Wait(15000)
    while true do
        if warParticipant then
            local state = Sunset.AwaitCallback('sunset:turfs:warState')
            if not state and warParticipant then
                warParticipant = false
                myWarRole = nil
                respawnPending = false
                TriggerEvent('sunset:turfs:warEndedLocal')
                exports.sunset_ui:Send('warHudHide', {})
                exports.sunset_ui:Send('warRespawnHide', {})
                exports.sunset_ui:Send('warScoreboardHide', {})
                exports.sunset_ui:Send('warArmoryHide', {})
            elseif state then
                -- keep the HUD truthful even if warTick broadcasts were missed
                ActiveWar = ActiveWar or {}
                ActiveWar.turfId = state.turfId
                ActiveWar.turfName = state.turfName
                ActiveWar.attackerName = state.attackerName
                ActiveWar.defenderName = state.defenderName
                ActiveWar.attackerScore = state.attackerScore
                ActiveWar.defenderScore = state.defenderScore
                ActiveWar.scoreTarget = state.scoreTarget
                ActiveWar.remainingSec = state.remainingSec
            end
        end
        Wait(10000)
    end
end)

RegisterNetEvent('sunset:turfs:teleport', function(coords)
    local ped = PlayerPedId()
    if not coords then return end
    -- [FALL FIX] Request collision before teleporting; without it the ped
    -- falls through the map because the ground hasn't streamed in yet.
    RequestCollisionAtCoord(coords.x + 0.0, coords.y + 0.0, coords.z + 0.5)
    FreezeEntityPosition(ped, true)
    SetEntityCoords(ped, coords.x + 0.0, coords.y + 0.0, coords.z + 0.5, false, false, false, false)
    Wait(100)
    FreezeEntityPosition(ped, false)
end)

CreateThread(function()
    Wait(1500)
    TriggerEvent('chat:addSuggestion', '/attackturf', 'Attack the territory you are standing in (clan rank 5+)')
    TriggerEvent('chat:addSuggestion', '/atac', 'Alias for /attackturf')
    TriggerEvent('chat:addSuggestion', '/intervene', 'Claim an unowned turf being captured - your clan becomes the defender (rank 5+)')
    TriggerEvent('chat:addSuggestion', '/armory', 'War loadout menu (alias: /armurie)')
    TriggerEvent('chat:addSuggestion', '/armurie', 'Alias for /armory')
    TriggerEvent('chat:addSuggestion', '/turflist', 'List territories + war status (admin)')
    TriggerEvent('chat:addSuggestion', '/gototurf', 'Teleport to a territory (admin)', { { name = 'id', help = '1-16' } })
    TriggerEvent('chat:addSuggestion', '/forceturf', 'Force-start a war (admin)', {
        { name = 'turfId', help = '1-16' },
        { name = 'clanId', helpKey = "config.turfs.help.optional.523f6951", help = 'optional' },
    })
    TriggerEvent('chat:addSuggestion', '/stopwar', 'Stop the active war (admin)', { { name = 'turfId', help = '1-16' } })
    TriggerEvent('chat:addSuggestion', '/resetturfcd', 'Reset territory cooldown (admin)', { { name = 'id|all' } })
    TriggerEvent('chat:addSuggestion', '/blzresmon', 'Admin: per-player resmon/FPS/entity sample')
end)

-- [WAR REDESIGN] Client export so sunset_death can skip the downed/EMS flow
-- for war participants (war respawn handles them instead).
exports('IsInWar', function() return warParticipant == true end)
-- Kill feed during wars (server broadcasts each war kill).
RegisterNetEvent('sunset:turfs:warKill', function(data)
    if not data then return end
    exports.sunset_ui:Notify(
                    exports.sunset_core:Translate('turfs.msg.war_took_down', { killer = tostring(data.killer), clan_tag = tostring(data.clanTag or ''), victim = tostring(data.victim) }),
        'error', 4000)
end)

local function openTurfMap()
    if isTurfMapOpen then return end
    exports.sunset_core:TriggerCallback('sunset:turfs:getAllTurfsData', function(data)
        if not data then return end
        isTurfMapOpen = true
        TURFS_SetNuiFocus(true, true)
        local ped = PlayerPedId()
        local pCoords = GetEntityCoords(ped)
        exports.sunset_ui:Send('turfMapOpen', {
            turfs = data.turfs or {},
            adjacency = data.adjacency or {},
            activeWars = data.activeWars or {},
            cooldowns = data.cooldowns or {},
            playerCoords = { x = pCoords.x, y = pCoords.y, z = pCoords.z }
        })
    end)
end

local function closeTurfMap()
    if not isTurfMapOpen then return end
    isTurfMapOpen = false
    TURFS_SetNuiFocus(false, false)
    exports.sunset_ui:Send('turfMapClose', {})
end

RegisterCommand('turfs', function()
    openTurfMap()
end, false)

RegisterNetEvent('sunset:turfs:openMap', function()
    openTurfMap()
end)

RegisterNUICallback('turfMapClose', function(data, cb)
    isTurfMapOpen = false
    TURFS_SetNuiFocus(false, false)
    if cb then cb({ ok = true }) end
end)

AddEventHandler('sunset:nui:turfMapClose', function()
    closeTurfMap()
end)

exports('OpenTurfMap', openTurfMap)
exports('CloseTurfMap', closeTurfMap)

-- [NUI FOCUS] Guaranteed close path: release on resource stop / forced UI close.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    local ok, owner = pcall(function() return exports.sunset_ui:GetFocusOwner() end)
    if ok and owner == 'turfs' then
        pcall(function() exports.sunset_ui:SetFocus(false, false, false, 'force') end)
    end
end)

AddEventHandler('sunset:ui:forceCloseAll', function()
    if isTurfMapOpen then closeTurfMap() end
end)
