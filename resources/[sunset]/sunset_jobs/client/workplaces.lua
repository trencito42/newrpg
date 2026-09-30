-- sunset_jobs · client/workplaces.lua
-- Generic client controller for physical job workplaces, dispatcher NPCs, tooltips, and action menus.

local spawnedNpcs = {}
local activeWorkplace = nil
local menuOpen = false
local currentContext = nil
local inCooldown = false
local unlockAt = 0

local function armGrace(ms)
    unlockAt = GetGameTimer() + (ms or 2000)
end

local function interactionsReady()
    if GetGameTimer() < unlockAt then return false end
    if IsNuiFocused() or IsPauseMenuActive() then return false end
    return true
end

-- ── Tooltip Helpers ───────────────────────────────────────────

local function showWorkplaceTooltip(workplace, ped)
    if not ped or not DoesEntityExist(ped) then return end
    local npcDef = workplace.npc or {}
    local shown = false
    if GetResourceState('sunset_world') == 'started' then
        local ok, res = pcall(function()
            return exports.sunset_world:NpcShowTooltip(npcDef.id or ('workplace_' .. workplace.jobId), ped, {
                badge = npcDef.badge or (workplace.jobLabel:upper() .. ' WORKPLACE'),
                badgeClass = npcDef.badgeClass or 'npc',
                icon = npcDef.icon or 'ph-briefcase',
                title = npcDef.name or workplace.jobLabel,
                desc = npcDef.title or 'Workplace Supervisor',
                key = 'E',
            })
        end)
        shown = (ok and res == true)
    end

    if not shown then
        BeginTextCommandDisplayHelp('STRING')
        AddTextComponentSubstringPlayerName(('~INPUT_CONTEXT~ — %s (%s)'):format(npcDef.name or workplace.jobLabel, workplace.jobLabel))
        EndTextCommandDisplayHelp(0, false, true, 100)
    end
end

local function hideWorkplaceTooltip(workplace)
    if not workplace then return end
    local npcDef = workplace.npc or {}
    if GetResourceState('sunset_world') == 'started' then
        pcall(function()
            exports.sunset_world:NpcHideTooltip(npcDef.id or ('workplace_' .. workplace.jobId))
        end)
    end
end

-- ── Spawn & Cleanup Workplace NPCs ────────────────────────────

local function deleteNearbyGhostPeds(coords, modelHash)
    local playerPed = PlayerPedId()
    local targetV3 = vector3(coords.x, coords.y, coords.z)
    local peds = GetGamePool('CPed')
    for _, p in ipairs(peds) do
        if p ~= playerPed and DoesEntityExist(p) then
            local pPos = GetEntityCoords(p)
            local dist = #(pPos - targetV3)
            if dist < 2.5 then
                local pModel = GetEntityModel(p)
                if pModel == modelHash or dist < 1.0 then
                    SetEntityAsMissionEntity(p, false, true)
                    DeleteEntity(p)
                end
            end
        end
    end
end

local function spawnWorkplaceNpc(key, workplace)
    local npcDef = workplace.npc
    if not npcDef or not npcDef.coords then return end

    -- Clean existing entry for this key if present
    if spawnedNpcs[key] then
        if spawnedNpcs[key].ped and DoesEntityExist(spawnedNpcs[key].ped) then
            DeleteEntity(spawnedNpcs[key].ped)
        end
        if spawnedNpcs[key].blip and DoesBlipExist(spawnedNpcs[key].blip) then
            RemoveBlip(spawnedNpcs[key].blip)
        end
        spawnedNpcs[key] = nil
    end

    local modelHash = joaat(npcDef.model or 'mp_m_shopkeep_01')
    RequestModel(modelHash)
    local timeout = GetGameTimer() + 10000
    while not HasModelLoaded(modelHash) and GetGameTimer() < timeout do Wait(50) end
    if not HasModelLoaded(modelHash) then
        print(('[sunset_jobs] ERR: failed to load NPC model %s for %s'):format(npcDef.model, key))
        return
    end

    local c = npcDef.coords

    -- Clear any ghost / duplicate peds lingering at the exact spawn point
    deleteNearbyGhostPeds(c, modelHash)

    local ped = CreatePed(4, modelHash, c.x, c.y, c.z - 1.0, c.w or c.h or 0.0, false, true)
    if not ped or ped == 0 or not DoesEntityExist(ped) then
        SetModelAsNoLongerNeeded(modelHash)
        return
    end

    SetEntityAsMissionEntity(ped, true, true)
    FreezeEntityPosition(ped, true)
    SetEntityInvincible(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    SetEntityCanBeDamaged(ped, false)
    SetPedCanRagdoll(ped, false)
    SetPedFleeAttributes(ped, 0, false)
    SetPedCombatAttributes(ped, 46, true)

    if npcDef.scenario then
        TaskStartScenarioInPlace(ped, npcDef.scenario, 0, true)
    end

    SetModelAsNoLongerNeeded(modelHash)

    -- Add blip
    local blip = AddBlipForCoord(c.x, c.y, c.z)
    local sprite = 407
    if workplace.jobId == 'trucker' then sprite = 477
    elseif workplace.jobId == 'garbage' then sprite = 318
    elseif workplace.jobId == 'courier' then sprite = 478
    elseif workplace.jobId == 'fisherman' then sprite = 68
    elseif workplace.jobId == 'hunter' then sprite = 153
    elseif workplace.jobId == 'diver' then sprite = 64
    end
    SetBlipSprite(blip, sprite)
    SetBlipColour(blip, 5)
    SetBlipScale(blip, 0.8)
    SetBlipAsShortRange(blip, true)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentSubstringPlayerName(workplace.jobLabel .. ' Workplace')
    EndTextCommandSetBlipName(blip)

    spawnedNpcs[key] = {
        ped = ped,
        blip = blip,
        workplace = workplace,
    }
end

local function cleanupWorkplaceNpcs()
    for key, data in pairs(spawnedNpcs) do
        if data.workplace then hideWorkplaceTooltip(data.workplace) end
        if data.ped and DoesEntityExist(data.ped) then
            DeleteEntity(data.ped)
        end
        if data.blip and DoesBlipExist(data.blip) then
            RemoveBlip(data.blip)
        end
    end
    spawnedNpcs = {}
end

local isInitializing = false
local function initWorkplaces()
    if isInitializing then return end
    isInitializing = true
    cleanupWorkplaceNpcs()
    for key, wp in pairs(Sunset.JobWorkplaces or {}) do
        -- Skip fisherman if sunset_fishingshop is running and owns Billy Ray directly
        if key == 'fisherman' and GetResourceState('sunset_fishingshop') == 'started' then
            -- fishingshop manages Billy Ray ped, but we can hook the interaction
        else
            spawnWorkplaceNpc(key, wp)
        end
    end
    isInitializing = false
end

-- ── Menu Interactions ─────────────────────────────────────────

local function closeWorkplaceMenu()
    if not menuOpen then return end
    menuOpen = false
    currentContext = nil
    exports.sunset_ui:Send('playerInteractionHide', {})
    exports.sunset_ui:SetFocus(false, false)
    armGrace(1500)
end

local function showJobGuide(guide)
    if not guide or not guide.steps then return end
    local title = guide.title or 'Job Career Guide'
    local fullText = table.concat(guide.steps, '\n')
    exports.sunset_ui:Notify(('=== %s ===\n%s'):format(title, fullText), 'info', 12000)
end

local function openWorkplaceMenu(workplace)
    if menuOpen or not interactionsReady() then return end
    CreateThread(function()
        local state, err = Sunset.AwaitCallback('sunset:jobs:getWorkplaceState', workplace.jobId)
        if not state then
            exports.sunset_ui:Notify(err or 'Could not reach workplace supervisor.', 'error', 5000)
            return
        end

        local actions = {}
        local npcDef = workplace.npc or {}

        -- 1. Apply Action
        -- [SECTION 3] Show specific missing-license error in apply label so player
        -- knows exactly which license they need without having to click Apply first.
        if not state.isEmployed then
            local applyLabel = ('Apply as %s'):format(workplace.jobLabel)
            if not state.requirementsMet and state.requirementError then
                -- Trim long messages for label display; full message shows on apply attempt.
                local errShort = state.requirementError
                if #errShort > 60 then errShort = errShort:sub(1, 57) .. '...' end
                applyLabel = applyLabel .. (' [%s]'):format(errShort)
            end
            actions[#actions + 1] = {
                id = 'workplace_apply',
                label = applyLabel,
                group = 'EMPLOYMENT',
            }
        end

        -- 2. Shift Controls
        if state.isEmployed then
            if state.onShift then
                actions[#actions + 1] = {
                    id = 'workplace_stop_shift',
                    label = 'End Active Shift',
                    group = 'SHIFT',
                }
            else
                if workplace.jobId == 'trucker' then
                    actions[#actions + 1] = {
                        id = 'workplace_open_laptop',
                        label = 'Open Route Laptop',
                        group = 'DISPATCH',
                    }
                else
                    actions[#actions + 1] = {
                        id = 'workplace_start_shift',
                        label = ('Start %s Route'):format(workplace.jobLabel),
                        group = 'SHIFT',
                    }
                end
            end
        end

        -- 3. Special Actions (Bait Shop, etc.)
        if workplace.actions and workplace.actions.special then
            for _, spec in ipairs(workplace.actions.special) do
                actions[#actions + 1] = {
                    id = 'workplace_special_' .. spec.id,
                    label = spec.label,
                    group = spec.group or 'SPECIAL',
                }
            end
        end

        -- 4. Guide Action
        if workplace.guide then
            actions[#actions + 1] = {
                id = 'workplace_guide',
                label = ('%s Guide'):format(workplace.jobLabel),
                group = 'INFO',
            }
        end

        -- 5. Resign / Quit Job
        if state.isEmployed then
            actions[#actions + 1] = {
                id = 'workplace_quit',
                label = ('Resign as %s'):format(workplace.jobLabel),
                group = 'EMPLOYMENT',
            }
        end

        if #actions == 0 then return end

        currentContext = {
            workplace = workplace,
            state = state,
        }

        hideWorkplaceTooltip(workplace)
        exports.sunset_ui:Send('playerInteractionShow', {
            menuTitle = ('%s Workplace'):format(workplace.jobLabel),
            target = { name = npcDef.name or workplace.jobLabel, id = '' },
            actions = actions,
        })
        exports.sunset_ui:SetFocus(true, true)
        menuOpen = true
    end)
end

-- ── Main Proximity Loop ───────────────────────────────────────

CreateThread(function()
    while true do
        local playerPed = PlayerPedId()
        local pos = GetEntityCoords(playerPed)
        local nearbyWp = nil
        local nearbyPed = nil
        local minDistance = 999.0

        for key, data in pairs(spawnedNpcs) do
            local wp = data.workplace
            if wp and wp.npc and wp.npc.coords then
                local npcPos = vector3(wp.npc.coords.x, wp.npc.coords.y, wp.npc.coords.z)
                local dist = #(pos - npcPos)
                if dist < minDistance then
                    minDistance = dist
                    nearbyWp = wp
                    nearbyPed = data.ped
                end
            end
        end

        if nearbyWp and minDistance < 4.5 then
            activeWorkplace = nearbyWp
            if not menuOpen and interactionsReady() then
                showWorkplaceTooltip(nearbyWp, nearbyPed)
                if minDistance < 2.3 and (IsControlJustPressed(0, 38) or IsDisabledControlJustPressed(0, 38)) then
                    openWorkplaceMenu(nearbyWp)
                end
            end
            Wait(0)
        else
            if activeWorkplace then
                hideWorkplaceTooltip(activeWorkplace)
                if menuOpen then closeWorkplaceMenu() end
                activeWorkplace = nil
            end
            Wait(300)
        end
    end
end)

-- ── NUI Action Handler ────────────────────────────────────────

AddEventHandler('sunset:nui:playerInteractionClose', function()
    if not menuOpen then return end
    closeWorkplaceMenu()
end)

AddEventHandler('sunset:nui:playerInteractionAction', function(data)
    if not data or not data.action then return end
    local action = data.action
    if not action:find('^workplace_') then return end

    -- ── Sub-menu responses (no currentContext needed — it was cleared when sub-menu opened) ──
    if action == 'workplace_back' then
        exports.sunset_ui:Send('playerInteractionHide', {})
        exports.sunset_ui:SetFocus(false, false)
        menuOpen = false
        currentContext = nil
        return

    elseif action:find('^workplace_take_contract_') then
        local contractId = action:gsub('^workplace_take_contract_', '')
        exports.sunset_ui:Send('playerInteractionHide', {})
        exports.sunset_ui:SetFocus(false, false)
        menuOpen = false
        currentContext = nil
        CreateThread(function()
            local result, err = Sunset.AwaitCallback('sunset:jobs:hunter:startContract', contractId)
            if not result then
                exports.sunset_ui:Notify(err or 'Could not start contract.', 'error', 5000)
            else
                exports.sunset_ui:Notify(('Contract accepted: travel to %s'):format(result.zone and result.zone.label or contractId), 'success', 6000)
                TriggerEvent('sunset:hunting:contractStarted', result)
            end
        end)
        return

    elseif action:find('^workplace_take_dive_contract_') then
        local siteId = action:gsub('^workplace_take_dive_contract_', '')
        exports.sunset_ui:Send('playerInteractionHide', {})
        exports.sunset_ui:SetFocus(false, false)
        menuOpen = false
        currentContext = nil
        CreateThread(function()
            -- auto-start shift if needed
            local _, startErr = Sunset.AwaitCallback('sunset:jobs:diver:start')
            if startErr and startErr ~= 'Character not loaded' then
                exports.sunset_ui:Notify(startErr, 'error', 5000) return
            end
            local result, err = Sunset.AwaitCallback('sunset:jobs:diver:startContract', siteId)
            if not result then
                exports.sunset_ui:Notify(err or 'Could not start contract.', 'error', 5000)
            else
                exports.sunset_ui:Notify(('Dive contract accepted: %s · $%d'):format(siteId, result.pay or 0), 'success', 6000)
                TriggerEvent('sunset:diving:contractStarted', result)
            end
        end)
        return

    elseif action:find('^workplace_gear_') then
        local tier = action:gsub('^workplace_gear_', '')
        exports.sunset_ui:Send('playerInteractionHide', {})
        exports.sunset_ui:SetFocus(false, false)
        menuOpen = false
        currentContext = nil
        CreateThread(function()
            -- auto-start shift if needed
            local _, startErr = Sunset.AwaitCallback('sunset:jobs:diver:start')
            if startErr and startErr ~= 'Character not loaded' then
                exports.sunset_ui:Notify(startErr, 'error', 5000) return
            end
            local result, err = Sunset.AwaitCallback('sunset:jobs:diver:rentGear', tier)
            if not result then
                exports.sunset_ui:Notify(err or 'Could not rent gear.', 'error', 5000)
            else
                exports.sunset_ui:Notify(('Gear rented: %s · O2: %ds'):format(tier, result.o2Duration or 120), 'success', 6000)
                TriggerEvent('sunset:diving:gearRented', result.o2Duration or 120)
            end
        end)
        return
    end

    -- ── Main menu actions (require currentContext) ─────────────────
    if not currentContext then return end

    local wp = currentContext.workplace
    closeWorkplaceMenu()
    armGrace(2000)

    if action == 'workplace_apply' then
        inCooldown = true
        CreateThread(function()
            local ok, err = Sunset.AwaitCallback('sunset:jobs:workplaceApply', wp.jobId)
            if ok then
                exports.sunset_ui:Notify(('You are now employed as %s!'):format(wp.jobLabel), 'success', 6000)
                if wp.secondaryLocation and wp.secondaryLocation.coords then
                    local sc = wp.secondaryLocation.coords
                    SetNewWaypoint(sc.x, sc.y)
                    exports.sunset_ui:Notify(('GPS waypoint set to %s.'):format(wp.secondaryLocation.label or 'workplace'), 'info', 6000)
                end
            else
                exports.sunset_ui:Notify(err or 'Could not complete application.', 'error', 7000)
            end
            inCooldown = false
        end)

    elseif action == 'workplace_start_shift' then
        if wp.jobId == 'garbage' and Sunset.Jobs and Sunset.Jobs.StartGarbage then
            Sunset.Jobs.StartGarbage()
        elseif wp.jobId == 'courier' and Sunset.Jobs and Sunset.Jobs.StartCourier then
            Sunset.Jobs.StartCourier()
        elseif wp.jobId == 'fisherman' and Sunset.Jobs and Sunset.Jobs.StartFisherman then
            Sunset.Jobs.StartFisherman()
        elseif wp.jobId == 'hunter' then
            CreateThread(function()
                local data, err = Sunset.AwaitCallback('sunset:jobs:hunter:start')
                if not data then
                    exports.sunset_ui:Notify(err or 'Could not start Hunter shift.', 'error', 5000)
                else
                    exports.sunset_ui:Notify('Hunter shift started. Visit Mason to pick a contract.', 'success', 5000)
                end
            end)
        elseif wp.jobId == 'diver' then
            CreateThread(function()
                local data, err = Sunset.AwaitCallback('sunset:jobs:diver:start')
                if not data then
                    exports.sunset_ui:Notify(err or 'Could not start Diver shift.', 'error', 5000)
                else
                    exports.sunset_ui:Notify('Diver shift started. Rent gear and pick a contract with Terry.', 'success', 5000)
                end
            end)
        end

    elseif action == 'workplace_open_laptop' then
        TriggerEvent('sunset:jobs:trucker:openLaptop')

    elseif action == 'workplace_stop_shift' then
        CreateThread(function()
            local ok, err = Sunset.AwaitCallback('sunset:jobs:cancelWork')
            if ok then
                if Sunset.JobClient then
                    Sunset.JobClient.cleanup()
                    Sunset.JobClient.hideObjective()
                end
                SetWaypointOff()
                exports.sunset_ui:Notify('Shift cancelled.', 'info', 4000)
            else
                exports.sunset_ui:Notify(err or 'Could not cancel shift.', 'error')
            end
        end)

    elseif action == 'workplace_guide' then
        showJobGuide(wp.guide)

    elseif action == 'workplace_quit' then
        CreateThread(function()
            local ok, err = Sunset.AwaitCallback('sunset:jobs:workplaceQuit', wp.jobId)
            if ok then
                if Sunset.JobClient then
                    Sunset.JobClient.cleanup()
                    Sunset.JobClient.hideObjective()
                end
                exports.sunset_ui:Notify(('Resigned as %s.'):format(wp.jobLabel), 'info', 5000)
            else
                exports.sunset_ui:Notify(err or 'Could not resign.', 'error')
            end
        end)

    elseif action:find('^workplace_special_') then
        local specId = action:gsub('^workplace_special_', '')
        -- NOTE: wp was captured before closeWorkplaceMenu() cleared currentContext

        if specId == 'open_laptop' then
            TriggerEvent('sunset:jobs:trucker:openLaptop')

        elseif specId == 'open_bait_shop' then
            if GetResourceState('sunset_fishingshop') == 'started' then
                exports.sunset_fishingshop:OpenShop()
            end

        elseif specId == 'sell_fish' then
            if GetResourceState('sunset_fishingshop') == 'started' then
                exports.sunset_fishingshop:OpenSellMenu()
            end

        -- ── Hunter special actions ──────────────────────────────
        elseif specId == 'contracts' and wp.jobId == 'hunter' then
            local contracts, err = Sunset.AwaitCallback('sunset:jobs:hunter:getContracts')
            if not contracts or #contracts == 0 then
                exports.sunset_ui:Notify(err or 'No contracts available at your rank yet.', 'error', 5000)
            else
                local items = {}
                for _, c in ipairs(contracts) do
                    items[#items + 1] = {
                        id = 'workplace_take_contract_' .. c.id,
                        label = ('%s  $%d'):format(c.label or c.id, c.pay or 0),
                        detail = ('Rank %d · Harvest %d × %s'):format(c.minRank, c.requiredHarvests, c.species or '?'),
                        group = 'CONTRACTS',
                    }
                end
                items[#items + 1] = { id = 'workplace_back', label = '← Back', group = 'NAV' }
                exports.sunset_ui:Send('playerInteractionShow', {
                    menuTitle = 'Hunting Contracts',
                    target = { name = 'Mason', id = '' },
                    actions = items,
                })
                exports.sunset_ui:SetFocus(true, true)
                menuOpen = true
            end

        elseif specId == 'sell_harvest' and wp.jobId == 'hunter' then
            local result, err = Sunset.AwaitCallback('sunset:jobs:hunter:sellHarvest')
            if not result then
                exports.sunset_ui:Notify(err or 'Nothing to sell.', 'error', 5000)
            else
                exports.sunset_ui:Notify(('Sold %d items for $%d!'):format(result.count, result.total), 'success', 6000)
            end

        elseif specId == 'equipment' and wp.jobId == 'hunter' then
            exports.sunset_ui:Notify('Required: Bolt-action Rifle + Hunting Knife. Available at Ammu-Nation.', 'info', 7000)

        -- ── Diver special actions ───────────────────────────────
        elseif specId == 'contracts' and wp.jobId == 'diver' then
            -- auto-start shift so contracts are accessible immediately
            Sunset.AwaitCallback('sunset:jobs:diver:start')
            local contracts, err = Sunset.AwaitCallback('sunset:jobs:diver:getContracts')
            if not contracts or #contracts == 0 then
                exports.sunset_ui:Notify(err or 'No contracts available at your rank.', 'error', 5000)
            else
                local items = {}
                for _, c in ipairs(contracts) do
                    local boatTag = c.requiresBoat and ' · Boat req.' or ''
                    items[#items + 1] = {
                        id = 'workplace_take_dive_contract_' .. c.id,
                        label = ('%s  $%d'):format(c.label or c.id, c.pay or 0),
                        detail = ('Rank %d · %s%s · Recover %d'):format(
                            c.minRank, c.difficulty or 'easy', boatTag, c.requiredSalvage or 3),
                        group = 'CONTRACTS',
                    }
                end
                items[#items + 1] = { id = 'workplace_back', label = '← Back', group = 'NAV' }
                exports.sunset_ui:Send('playerInteractionShow', {
                    menuTitle = 'Salvage Contracts',
                    target = { name = 'Terry', id = '' },
                    actions = items,
                })
                exports.sunset_ui:SetFocus(true, true)
                menuOpen = true
            end

        elseif specId == 'rent_gear' and wp.jobId == 'diver' then
            local cfgDiver = Sunset.JobsConfig and Sunset.JobsConfig.diver
            local gear = cfgDiver and cfgDiver.gear or {}
            local items = {
                { id = 'workplace_gear_basic',    label = 'Basic Gear  $30',    detail = '2 min O2 · Rank 1', group = 'GEAR' },
                { id = 'workplace_gear_standard', label = 'Standard Gear  $60', detail = '3 min O2 · Rank 2', group = 'GEAR' },
                { id = 'workplace_gear_advanced', label = 'Advanced Gear  $100',detail = '5 min O2 · Rank 3', group = 'GEAR' },
                { id = 'workplace_back', label = '← Back', group = 'NAV' },
            }
            exports.sunset_ui:Send('playerInteractionShow', {
                menuTitle = 'Rent Diving Gear',
                target = { name = 'Terry', id = '' },
                actions = items,
            })
            exports.sunset_ui:SetFocus(true, true)
            menuOpen = true

        elseif specId == 'rent_boat' and wp.jobId == 'diver' then
            -- auto-start shift if needed
            Sunset.AwaitCallback('sunset:jobs:diver:start')
            local result, err = Sunset.AwaitCallback('sunset:jobs:diver:rentBoat')
            if not result then
                exports.sunset_ui:Notify(err or 'Cannot rent boat.', 'error', 5000)
            end

        elseif specId == 'sell' and wp.jobId == 'diver' then
            local result, err = Sunset.AwaitCallback('sunset:jobs:diver:sell')
            if not result then
                exports.sunset_ui:Notify(err or 'Nothing to sell.', 'error', 5000)
            else
                exports.sunset_ui:Notify(('Sold %d items for $%d!'):format(result.count, result.total), 'success', 6000)
            end
        end

    end
end)

-- ── Lifecycle Events ──────────────────────────────────────────

AddEventHandler('onResourceStart', function(res)
    if res == GetCurrentResourceName() then
        initWorkplaces()
    end
end)

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then
        cleanupWorkplaceNpcs()
    end
end)

AddEventHandler('sunset:client:playerSpawned', function()
    initWorkplaces()
    armGrace(3000)
end)

AddEventHandler('sunset:client:characterFlowComplete', function()
    initWorkplaces()
    armGrace(3000)
end)
