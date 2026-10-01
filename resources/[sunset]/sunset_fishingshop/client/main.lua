-- ============================================================
--  sunset_fishingshop  ·  client/main.lua
-- ============================================================

local NPC_COORDS       = vector4(-1593.23, 5207.74, 3.31, 25.49)
local NPC_PROMPT_DIST  = 4.5
local NPC_MENU_DIST    = 2.15
local BAIT_SHOP_COORDS = vector3(-1602.11, 5203.87, 4.31)
local BAIT_SHOP_DIST   = 2.5
local SELL_DIST        = 2.5
local shopOpen         = false   -- fishing shop UI (buy/sell) open

local function getSellZones()
    local zones = {}
    for _, store in ipairs(Sunset.TwentyFourSevenStores or {}) do
        if store.coords then zones[#zones + 1] = store.coords end
    end
    return zones
end

local function nearestFishBuyer()
    local pos = GetEntityCoords(PlayerPedId())
    local best = {
        label = 'Billy Ray',
        coords = vector3(NPC_COORDS.x, NPC_COORDS.y, NPC_COORDS.z),
    }
    local bestDistance = #(pos - best.coords)
    for _, store in ipairs(Sunset.TwentyFourSevenStores or {}) do
        local coords = store.cashier
            and vector3(store.cashier.x, store.cashier.y, store.cashier.z)
            or store.coords
        if coords then
            local distance = #(pos - coords)
            if distance < bestDistance then
                best = { label = store.label or exports.sunset_core:Translate('fishingshop.menu.default_shop'), coords = coords }
                bestDistance = distance
            end
        end
    end
    return best, bestDistance
end

local function openFishSellMenu()
    if shopOpen or IsNuiFocused() then return end
    CreateThread(function()
        local invData, err = Sunset.AwaitCallback('sunset:fishingshop:getFishInventory')
        if not invData then
            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('fishingshop.message.inventory_read_failed'), 'error')
            return
        end
        if not invData.items or #invData.items == 0 then
            exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.you_have_no_fish_to_sell_caught_fish_appear'), 'info', 6500)
            return
        end

        local buyer, distance = nearestFishBuyer()
        if not buyer or distance > 6.0 then
            SetNewWaypoint(buyer.coords.x, buyer.coords.y)
            exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.gps_set_sell', { label = buyer.label }), 'info', 8000)
            return
        end

        exports.sunset_ui:Send('fishingShopShow', {
            mode = 'sell',
            title = exports.sunset_core:Translate('fishingshop.ui.sell_fish_title'),
            cash = invData.cash,
            items = invData.items,
        })
        exports.sunset_ui:SetFocus(true, true)
        shopOpen = true
    end)
end

local hillbillyPed   = nil
local fishShopBlips  = {}
local nearNpc        = false
local nearBaitShop   = false
local storeContext   = nil
local menuOpen       = false   -- playerInteraction menu open
local inCooldown     = false
local billyPromptVisible = false
local billyHoldStart = nil
local billyHoldVisual = false
local billyHelpPromptAt = 0
local billyFallbackWarned = false
local menuCloseArmed = false
local BILLY_HOLD_MS  = 800
local INTERACT_KEY   = 38
-- [LOCK FIX] was GetGameTimer() + 60000 — an unexplained 60s dead zone after
-- every resource (re)start during which Billy ignored the player. Now starts
-- unlocked; a short 3.5s grace is armed only on spawn/character-flow (see
-- resetBillyUiOnEntry / characterFlowComplete below).
local billyInteractUnlockAt = 0

-- Forward declarations
local hideBillyRayPrompt
local closeFishingMenu
local sendBillyHoldState
local safeUiCall

local FISHING_ACTIONS = {
    get_fisherman_job = true,
    start_fishing_shift = true,
    end_fishing_shift = true,
    upgrade_fishing_rod = true,
    fishing_guide = true,
    quit_fisherman_job = true,
    sell_fish_247 = true,
    open_shop_247 = true,
    buy_business = true,
    manage_business = true,
    join_tournament = true,
    view_tournament_standings = true,
}

local function isAllowedMenuAction(action)
    return action and FISHING_ACTIONS[action] == true
end

local function formatMoney(amount)
    local n = math.floor(tonumber(amount) or 0)
    local formatted = tostring(n)
    local k
    while true do
        formatted, k = formatted:gsub('^(-?%d+)(%d%d%d)', '%1,%2')
        if k == 0 then break end
    end
    return '$' .. formatted
end

local function buildStoreActions(ctx)
    local actions = {}
    local shopLabel = (ctx and ctx.shopLabel) or exports.sunset_core:Translate('fishingshop.menu.default_shop')
    actions[#actions + 1] = {
        id = 'open_shop_247',
        label = exports.sunset_core:Translate('fishingshop.menu.open_shop', { shop = shopLabel }),
        group = 'STORE',
    }
    actions[#actions + 1] = {
        id = 'sell_fish_247',
        label = exports.sunset_core:Translate('fishingshop.menu.sell_fish'),
        group = 'STORE',
    }

    local biz = ctx and ctx.business
    if biz and not biz.owned and biz.forSale then
        actions[#actions + 1] = {
            id = 'buy_business',
            label = exports.sunset_core:Translate('fishingshop.menu.buy_business', { price = formatMoney(biz.price) }),
            group = 'BUSINESS',
        }
    elseif biz and biz.mine then
        actions[#actions + 1] = {
            id = 'manage_business',
            label = exports.sunset_core:Translate('fishingshop.menu.manage_business'),
            group = 'BUSINESS',
        }
    end

    return actions
end

local function debugHire(message)
    print(('[sunset_fishingshop] %s'):format(message))
    TriggerServerEvent('sunset:server:flowTrace', 'fishingshop.hire', message)
end

local function npcCenter()
    return vector3(NPC_COORDS.x, NPC_COORDS.y, NPC_COORDS.z)
end

local function distanceToNpc(pos)
    return #(pos - npcCenter())
end

local function isNearNpcMenu(pos)
    return hillbillyPed and DoesEntityExist(hillbillyPed) and distanceToNpc(pos) < NPC_MENU_DIST
end

local function isNearNpcPrompt(pos)
    return hillbillyPed and DoesEntityExist(hillbillyPed) and distanceToNpc(pos) < NPC_PROMPT_DIST
end

local function armBillyInteractGrace(ms)
    billyInteractUnlockAt = GetGameTimer() + (ms or 3000)
    billyHoldStart = nil
    sendBillyHoldState(false)
end

local function billyInteractionsReady()
    if GetGameTimer() < billyInteractUnlockAt then return false end
    if not NetworkIsPlayerActive(PlayerId()) then return false end
    if IsNuiFocused() or IsPauseMenuActive() then return false end
    return true
end

safeUiCall = function(fn)
    if GetResourceState('sunset_ui') ~= 'started' then return false end
    return pcall(fn)
end

local function anotherPlayerBlocksNpcPrompt(pos)
    for _, player in ipairs(GetActivePlayers()) do
        if player ~= PlayerId() then
            local targetPed = GetPlayerPed(player)
            if targetPed ~= 0 and DoesEntityExist(targetPed) then
                if #(pos - GetEntityCoords(targetPed)) < 3.0 then
                    return true
                end
            end
        end
    end
    return false
end

-- [CROSS-RESOURCE FIX] sunset_world's Lua globals are NOT visible from this
-- resource (separate environments). Use the exports; keep a same-resource
-- global fallback for safety.
local function worldShowTooltip(id, ped, meta)
    if GetResourceState('sunset_world') ~= 'started' then return false, { localeKey = 'fishingshop.message.sunset_world_not_started' } end
    local ok, shownOrErr, reason = pcall(function()
        return exports.sunset_world:NpcShowTooltip(id, ped, meta)
    end)
    if not ok then return false, tostring(shownOrErr) end
    if shownOrErr == true then return true end
    return false, reason or exports.sunset_core:Translate('fishingshop.err.showtooltip_returned_false')
end

local function worldHideTooltip(id)
    if GetResourceState('sunset_world') ~= 'started' then return end
    pcall(function() exports.sunset_world:NpcHideTooltip(id) end)
end

hideBillyRayPrompt = function()
    if not billyPromptVisible then return end
    billyPromptVisible = false
    billyHoldStart = nil
    billyHoldVisual = false
    worldHideTooltip('fisherman_billy')
end

sendBillyHoldState = function(_active)
    -- Hold feedback handled in-game; world tooltip stays visible.
end

local function sendBillyRayPrompt()
    local ped = hillbillyPed
    if not ped or ped == 0 or not DoesEntityExist(ped) then
        hideBillyRayPrompt()
        return
    end
    -- [TOOLTIP FIX] Only claim the prompt is visible when the tooltip was
    -- actually accepted by sunset_world. On failure, fall back to a native GTA
    -- help prompt so the interaction is never silently invisible.
    local shown, reason = worldShowTooltip('fisherman_billy', ped, {
        badge = 'FISHING JOB',
        badgeClass = 'fishing',
        bodyClass = 'fishing',
        icon = 'ph-fish',
        title = 'Billy Ray',
        desc = exports.sunset_core:Translate('fishingshop.npc.interaction_desc'),
        key = 'E',
    })
    if shown then
        billyPromptVisible = true
        billyHelpPromptAt = GetGameTimer()
    else
        billyPromptVisible = false
        if not billyFallbackWarned then
            billyFallbackWarned = true
            print(('[sunset_fishingshop] world tooltip unavailable (%s) — using native help prompt'):format(tostring(reason)))
        end
    end
end

-- Native fallback prompt (drawn every frame while near Billy and the world
-- tooltip could not be shown).
local function drawBillyNativeHelp()
    if billyPromptVisible then return end
    BeginTextCommandDisplayHelp('STRING')
    AddTextComponentSubstringPlayerName(exports.sunset_core:Translate('hint.native.billy_ray'))
    EndTextCommandDisplayHelp(0, false, true, 100)
end

local function shouldShowBillyRayPrompt()
    if not billyInteractionsReady() then return false end
    if menuOpen or shopOpen then return false end
    local pos = GetEntityCoords(PlayerPedId())
    if not isNearNpcPrompt(pos) then return false end
    -- NOTE: anotherPlayerBlocksNpcPrompt check removed from here — the tooltip
    -- should always show when you're in range; the block only applies to the
    -- actual Hold-E interaction (prevents two menus opening at once).
    return true
end

closeFishingMenu = function()
    if not menuOpen then return end
    menuOpen = false
    storeContext = nil
    menuCloseArmed = false
    billyHoldStart = nil
    sendBillyHoldState(false)
    hideBillyRayPrompt()
    safeUiCall(function()
        exports.sunset_ui:Send('playerInteractionHide', {})
        exports.sunset_ui:SetFocus(false, false)
    end)
end

local function notifyHireError(err)
    local errMsg = err or 'Hiring failed (no details from server).'
    debugHire(('FAIL: %s'):format(errMsg))
    if errMsg:find('already work', 1, true)
        or errMsg:find('already', 1, true) then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.you_are_already_a_fisherman_press_start_shift_to'), 'info', 7000)
        return
    end
    exports.sunset_ui:Notify(errMsg, 'error', 8000)
end

local function syncLocalJob(job, grade)
    if not job then return end
    if Sunset.Character then
        Sunset.Character.job = job
        Sunset.Character.job_grade = grade or Sunset.Character.job_grade or 0
    end
end

local function getCharacterJob()
    local char = Sunset.Character or {}
    return select(1, Sunset.GetCharacterJob(char))
end

local function isOnFishermanShift()
    if GetResourceState('sunset_jobs') ~= 'started' then return false end
    local ok, active = pcall(function()
        return exports.sunset_jobs:IsFishermanShiftActive()
    end)
    return ok and active == true
end

local function buildBillyRayActions(job, tournamentActive, tournamentJoined)
    local actions = {}
    job = job or getCharacterJob()

    if job ~= 'fisherman' then
        actions[#actions + 1] = { id = 'get_fisherman_job', label = exports.sunset_core:Translate('fishingshop.menu.become_fisherman'), group = 'CIVILIAN' }
    end

    if job == 'fisherman' then
        if isOnFishermanShift() then
            actions[#actions + 1] = { id = 'end_fishing_shift', label = exports.sunset_core:Translate('fishingshop.menu.end_shift'), group = 'FISHING' }
        else
            actions[#actions + 1] = { id = 'start_fishing_shift', label = exports.sunset_core:Translate('fishingshop.menu.start_shift'), group = 'FISHING' }
        end
        actions[#actions + 1] = { id = 'upgrade_fishing_rod', label = exports.sunset_core:Translate('fishingshop.menu.upgrade_rod'), group = 'FISHING' }
        actions[#actions + 1] = { id = 'fishing_guide', label = exports.sunset_core:Translate('fishingshop.menu.guide'), group = 'INFO' }
        actions[#actions + 1] = { id = 'quit_fisherman_job', label = exports.sunset_core:Translate('fishingshop.menu.resign'), group = 'CIVILIAN' }
    else
        actions[#actions + 1] = { id = 'fishing_guide', label = exports.sunset_core:Translate('fishingshop.menu.guide'), group = 'INFO' }
    end

    if tournamentActive then
        local tLabel = tournamentJoined and exports.sunset_core:Translate('fishingshop.menu.tournament_joined') or exports.sunset_core:Translate('fishingshop.menu.tournament_join')
        actions[#actions + 1] = { id = 'join_tournament', label = tLabel, group = 'TOURNAMENT' }
        if tournamentJoined then
            actions[#actions + 1] = { id = 'view_tournament_standings', label = exports.sunset_core:Translate('fishingshop.menu.standings'), group = 'TOURNAMENT' }
        end
    end

    return actions
end

local function openBillyRayMenu()
    if menuOpen or not billyInteractionsReady() then return end
    CreateThread(function()
        local data, err = Sunset.AwaitCallback('sunset:fishingshop:getBillyRayMenu')
        if not data then
            if err then exports.sunset_ui:Notify(err, 'error', 5000) end
            return
        end
        if menuOpen or not billyInteractionsReady() then return end
        syncLocalJob(data.job, data.job_grade)

        -- Check tournament status (non-blocking — ignore error)
        local tournamentActive, tournamentJoined = false, false
        if GetResourceState('sunset_fishing_tournament') == 'started' then
            local tStatus = Sunset.AwaitCallback('sunset:fishingTournament:status')
            if tStatus and tStatus.active then
                tournamentActive = true
                tournamentJoined = tStatus.joined == true
            end
        end

        local actions = buildBillyRayActions(data.job, tournamentActive, tournamentJoined)
        if #actions == 0 then return end
        billyHoldStart = nil
        menuCloseArmed = false
        hideBillyRayPrompt()
        exports.sunset_ui:Send('playerInteractionShow', {
            menuTitle = 'Fishing Actions',
            target = { name = 'Billy Ray', id = '' },
            actions = actions,
        })
        exports.sunset_ui:SetFocus(true, true)
        menuOpen = true
    end)
end

exports('IsNearBillyRay', function()
    return isNearNpcMenu(GetEntityCoords(PlayerPedId()))
end)
exports('IsMenuOpen', function() return menuOpen or shopOpen end)
exports('IsNearStore', function() return nearStore end)

local function resetBillyUiOnEntry()
    armBillyInteractGrace(3500)
    billyHoldStart = nil
    menuCloseArmed = false
    menuOpen = false
    shopOpen = false
    hideBillyRayPrompt()
    safeUiCall(function()
        exports.sunset_ui:Send('playerInteractionHide', {})
        exports.sunset_ui:SetFocus(false, false)
    end)
end

AddEventHandler('sunset:client:playerSpawned', resetBillyUiOnEntry)
AddEventHandler('sunset:client:characterFlowComplete', function()
    armBillyInteractGrace(3500)
end)

-- ── Spawn NPC ────────────────────────────────────────────────
CreateThread(function()
    if Sunset and Sunset.AwaitGameReady then
        Sunset.AwaitGameReady()
    else
        pcall(function() exports.sunset_core:AwaitGameReady() end)
    end

    local modelName = 'a_m_m_hillbilly_01'
    local okModel, hash = false, nil
    if Sunset and Sunset.RequestModelSafe then
        okModel, hash = Sunset.RequestModelSafe(modelName, 5000)
    else
        local okR, rHash = pcall(function() return exports.sunset_core:RequestModelSafe(modelName, 5000) end)
        okModel, hash = (okR and rHash ~= false), rHash
    end

    if okModel and hash then
        hillbillyPed = CreatePed(4, hash,
            NPC_COORDS.x, NPC_COORDS.y, NPC_COORDS.z, NPC_COORDS.w,
            false, true)
        if hillbillyPed and hillbillyPed ~= 0 and DoesEntityExist(hillbillyPed) then
            SetEntityAsMissionEntity(hillbillyPed, true, true)
            FreezeEntityPosition(hillbillyPed, true)
            SetEntityInvincible(hillbillyPed, true)
            SetBlockingOfNonTemporaryEvents(hillbillyPed, true)
            SetEntityCanBeDamaged(hillbillyPed, false)
            TaskStartScenarioInPlace(hillbillyPed, 'WORLD_HUMAN_SMOKING', 0, true)
        end
        SetModelAsNoLongerNeeded(hash)
    else
        print('[sunset_fishingshop] Optional Billy Ray NPC model failed to load; skipping NPC')
    end

    -- Blip Billy Ray
    local blip = nil
    if Sunset and Sunset.CreateSafeBlip then
        blip = Sunset.CreateSafeBlip(NPC_COORDS, {
            sprite = 68,
            color = 3,
            scale = 0.85,
            shortRange = true,
            label = exports.sunset_core:Translate('fishingshop.blip.billy_ray'),
        })
    else
        pcall(function()
            blip = exports.sunset_core:CreateSafeBlip(NPC_COORDS, {
                sprite = 68,
                color = 3,
                scale = 0.85,
                shortRange = true,
                label = exports.sunset_core:Translate('fishingshop.blip.billy_ray'),
            })
        end)
    end
    if blip then fishShopBlips[#fishShopBlips + 1] = blip end

    -- Blip Fishing Supply shop
    local shopBlip = nil
    if Sunset and Sunset.CreateSafeBlip then
        shopBlip = Sunset.CreateSafeBlip(BAIT_SHOP_COORDS, {
            sprite = 52,
            color = 3,
            scale = 0.75,
            shortRange = true,
            label = exports.sunset_core:Translate('fishingshop.blip.supply'),
        })
    else
        pcall(function()
            shopBlip = exports.sunset_core:CreateSafeBlip(BAIT_SHOP_COORDS, {
                sprite = 52,
                color = 3,
                scale = 0.75,
                shortRange = true,
                label = exports.sunset_core:Translate('fishingshop.blip.supply'),
            })
        end)
    end
    if shopBlip then fishShopBlips[#fishShopBlips + 1] = shopBlip end
end)

-- [JOBS AUDIT] NPC ped, blips and shop focus survived a resource restart (duplicate Billy Ray / blips).
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if hillbillyPed and DoesEntityExist(hillbillyPed) then
        SetEntityAsMissionEntity(hillbillyPed, false, true)
        DeleteEntity(hillbillyPed)
    end
    for _, b in ipairs(fishShopBlips) do
        if DoesBlipExist(b) then RemoveBlip(b) end
    end
    fishShopBlips = {}
    if menuOpen or shopOpen then
        pcall(function() exports.sunset_ui:SetFocus(false, false) end)
    end
end)

-- ── World tooltip deasupra capului (Hold E To Interact) ───────
CreateThread(function()
    while true do
        if shouldShowBillyRayPrompt() then
            sendBillyRayPrompt()
            drawBillyNativeHelp()
            Wait(0)
        else
            hideBillyRayPrompt()
            Wait(200)
        end
    end
end)

CreateThread(function()
    while true do
        local pos = GetEntityCoords(PlayerPedId())
        local wasNpc       = nearNpc
        local wasBaitShop  = nearBaitShop

        -- Use prompt distance (4.5 m) so E is captured whenever the tooltip
        -- is visible. Was isNearNpcMenu (2.15 m) — E wasn't disabled between
        -- 2.15 m and 4.5 m, so the key did nothing despite the prompt showing.
        nearNpc      = isNearNpcPrompt(pos)
        nearBaitShop = #(pos - BAIT_SHOP_COORDS) < BAIT_SHOP_DIST

        if wasNpc and not nearNpc and menuOpen then
            closeFishingMenu()
        end

        if wasBaitShop and not nearBaitShop and shopOpen then
            exports.sunset_ui:Send('fishingShopHide', {})
            exports.sunset_ui:SetFocus(false, false)
            shopOpen = false
        end

        Wait((nearNpc or nearBaitShop) and 0 or 350)
    end
end)

-- ── E key handler ─────────────────────────────────────────────
CreateThread(function()
    while true do
        if nearNpc or nearBaitShop then
            local pos = GetEntityCoords(PlayerPedId())
            -- Removed anotherPlayerBlocksNpcPrompt — it blocked interaction
            -- whenever a second player was nearby even if they weren't using the NPC.
            local canPromptBilly = isNearNpcPrompt(pos)

            if nearNpc or nearBaitShop then
                DisableControlAction(0, INTERACT_KEY, true)
            end

            if canPromptBilly then
                if menuOpen then
                    if IsDisabledControlJustPressed(0, INTERACT_KEY) and menuCloseArmed then
                        closeFishingMenu()
                    end
                    if IsDisabledControlJustReleased(0, INTERACT_KEY) then
                        menuCloseArmed = true
                    end
                elseif billyInteractionsReady() and not inCooldown and not shopOpen then
                    -- Simple press (no hold required — hold had no visual feedback
                    -- so players tapped E and got nothing; menu never opened).
                    if IsDisabledControlJustReleased(0, INTERACT_KEY) then
                        openBillyRayMenu()
                    end
                end
            elseif menuOpen and nearNpc then
                if IsDisabledControlJustPressed(0, INTERACT_KEY) and menuCloseArmed then
                    closeFishingMenu()
                end
                if IsDisabledControlJustReleased(0, INTERACT_KEY) then
                    menuCloseArmed = true
                end
            end

            local pressed = false
            if nearBaitShop and not nearNpc and not inCooldown and not menuOpen and not shopOpen and not IsNuiFocused() then
                pressed = IsDisabledControlJustPressed(0, INTERACT_KEY)
            end

            if pressed then
                if nearBaitShop then
                    -- Deschide direct magazinul de momeala
                    inCooldown = true
                    CreateThread(function()
                        local shopData, err = Sunset.AwaitCallback('sunset:fishingshop:getBaitShop')
                        if shopData then
                            exports.sunset_ui:Send('fishingShopShow', {
                                mode  = 'buy',
                                title = exports.sunset_core:Translate('fishingshop.ui.supply_title'),
                                cash  = shopData.cash,
                                items = shopData.items,
                            })
                            exports.sunset_ui:SetFocus(true, true)
                            shopOpen = true
                        else
                            exports.sunset_ui:Notify(err or exports.sunset_core:Translate('fishingshop.message.shop_open_failed'), 'error')
                        end
                        SetTimeout(1500, function() inCooldown = false end)
                    end)
                end
            end
            Wait(0)
        else
            billyHoldStart = nil
            sendBillyHoldState(false)
            menuCloseArmed = false
            Wait(200)
        end
    end
end)

-- ── playerInteraction NUI events ──────────────────────────────
AddEventHandler('sunset:nui:playerInteractionClose', function()
    if not menuOpen then return end
    closeFishingMenu()
end)

AddEventHandler('sunset:nui:playerInteractionAction', function(data)
    if not data or not data.action then return end
    if not isAllowedMenuAction(data.action) then return end
    if not menuOpen then return end

    local action = data.action
    local ctx = storeContext
    closeFishingMenu()
    storeContext = nil

    if action == 'open_shop_247' then
        local shopId = (ctx and ctx.shopId) or 'twentyfour7'
        local shop = Sunset.Shops and Sunset.Shops[shopId]
        if not shop then
            exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.shop_unavailable'), 'error')
            return
        end
        TriggerEvent('sunset:world:openShop', shopId, shop)

    elseif action == 'buy_business' then
        local biz = ctx and ctx.business
        if not biz or not biz.id then
            exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.this_business_is_not_for_sale'), 'error')
            return
        end
        inCooldown = true
        CreateThread(function()
            local ok, err = Sunset.AwaitCallback('sunset:buyBusiness', biz.id)
            if ok then
                exports.sunset_ui:Notify(err or exports.sunset_core:Translate('fishingshop.message.business_purchased'), 'success')
            else
                exports.sunset_ui:Notify(err or exports.sunset_core:Translate('fishingshop.message.business_purchase_failed'), 'error')
            end
            SetTimeout(2000, function() inCooldown = false end)
        end)

    elseif action == 'manage_business' then
        TriggerEvent('sunset:businesses:openOwner')

    elseif action == 'get_fisherman_job' then
        inCooldown = true
        debugHire('request hire fisherman')
        CreateThread(function()
            local ok, err = Sunset.AwaitCallback('sunset:fishingshop:hireFisherman')
            debugHire(('callback ok=%s err=%s'):format(tostring(ok), tostring(err)))
            if ok then
                syncLocalJob('fisherman', 0)
                if err == 'already' then
                    exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.you_are_already_a_fisherman_press_start_shift_to'), 'info', 8000)
                else
                    exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.you_are_now_a_fisherman_press_start_shift_to'), 'success', 8000)
                end
            else
                notifyHireError(err)
            end
            SetTimeout(2000, function() inCooldown = false end)
        end)

    elseif action == 'start_fishing_shift' then
        inCooldown = true
        TriggerEvent('sunset:client:startFishermanShift')
        SetTimeout(2000, function() inCooldown = false end)

    elseif action == 'end_fishing_shift' then
        inCooldown = true
        CreateThread(function()
            local ok, err = Sunset.AwaitCallback('sunset:jobs:fisherman:endShift')
            if ok then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.fishing_shift_ended'), 'success', 5000)
            else
                exports.sunset_ui:Notify(err or exports.sunset_core:Translate('fishingshop.message.no_active_shift'), 'error')
            end
            SetTimeout(2000, function() inCooldown = false end)
        end)

    elseif action == 'upgrade_fishing_rod' then
        inCooldown = true
        CreateThread(function()
            local ok, msg = Sunset.AwaitCallback('sunset:fishingshop:upgradeRod')
            if ok then
                exports.sunset_ui:Notify(msg or exports.sunset_core:Translate('fishingshop.message.rod_upgraded'), 'success', 6000)
            else
                exports.sunset_ui:Notify(msg or exports.sunset_core:Translate('fishingshop.message.rod_upgrade_failed'), 'error')
            end
            SetTimeout(2000, function() inCooldown = false end)
        end)

    elseif action == 'fishing_guide' then
        local guide = Sunset.JobWorkplaces and Sunset.JobWorkplaces.fisherman and Sunset.JobWorkplaces.fisherman.guide
        if guide and guide.steps then
            exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.guide_header', { title = guide.title or exports.sunset_core:Translate('fishingshop.menu.guide'), steps = table.concat(guide.steps, '\n') }), 'info', 12000)
        else
            exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.fisherman_guide_buy_bait_from_billy_ray_stand_at'), 'info', 8000)
        end

    elseif action == 'quit_fisherman_job' then
        inCooldown = true
        CreateThread(function()
            local ok, err = Sunset.AwaitCallback('sunset:quitCivilianJob')
            if ok then
                syncLocalJob('unemployed', 0)
                exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.you_have_resigned_as_a_fisherman'), 'info', 6000)
            else
                exports.sunset_ui:Notify(err or exports.sunset_core:Translate('fishingshop.message.resign_failed'), 'error')
            end
            SetTimeout(2000, function() inCooldown = false end)
        end)

    elseif action == 'join_tournament' then
        inCooldown = true
        CreateThread(function()
            if GetResourceState('sunset_fishing_tournament') ~= 'started' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.fishing_tournament_system_is_not_running'), 'error')
                SetTimeout(2000, function() inCooldown = false end)
                return
            end
            exports.sunset_core:TriggerCallback('sunset:fishingTournament:join', function(res)
                inCooldown = false
                if res and res.ok then
                    if res.status then
                        exports.sunset_ui:Send('fishingTournamentHudShow', res.status)
                    end
                    exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.you_joined_the_fishing_tournament_fish_as_much_as'), 'success', 7000)
                else
                    exports.sunset_ui:Notify((res and res.error) or exports.sunset_core:Translate('fishingshop.message.tournament_join_failed'), 'error', 5000)
                end
            end)
        end)

    elseif action == 'view_tournament_standings' then
        inCooldown = true
        CreateThread(function()
            if GetResourceState('sunset_fishing_tournament') ~= 'started' then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.fishing_tournament_system_is_not_running'), 'error')
                SetTimeout(2000, function() inCooldown = false end)
                return
            end
            local tStatus = Sunset.AwaitCallback('sunset:fishingTournament:status')
            inCooldown = false
            if not tStatus or not tStatus.active then
                exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.no_active_tournament_found'), 'error', 4000)
                return
            end
            -- Refresh the HUD
            exports.sunset_ui:Send('fishingTournamentHudShow', tStatus)
            -- Build leaderboard text
            local lines = {}
            local lb = tStatus.leaderboard or {}
            for _, entry in ipairs(lb) do
                local marker = entry.isSelf and ' <<' or ''
                local qualMark = entry.qualified and '' or ' (unqualified)'
                lines[#lines + 1] = ('#%d %s — %.1f kg%s%s'):format(
                    entry.rank,
                    entry.name,
                    tonumber(entry.weight) or 0,
                    qualMark,
                    marker
                )
            end
            local myLine = ('Your rank: #%d | %s kg | %d fish'):format(
                tStatus.rank or 0,
                tStatus.totalWeight or '0.0',
                tStatus.fishCount or 0
            )
            local msg = '~y~=== Tournament Standings ===~w~\n' .. table.concat(lines, '\n') .. '\n~g~' .. myLine
            exports.sunset_ui:Notify(msg, 'info', 12000)
        end)

    elseif action == 'sell_fish_247' then
        inCooldown = true
        CreateThread(function()
            local invData, err = Sunset.AwaitCallback('sunset:fishingshop:getFishInventory')
            if invData then
                if not invData.items or #invData.items == 0 then
                    exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.you_have_no_fish_in_your_inventory'), 'info')
                else
                    exports.sunset_ui:Send('fishingShopShow', {
                        mode  = 'sell',
                        title = exports.sunset_core:Translate('fishingshop.ui.sell_fish_247_title'),
                        cash  = invData.cash,
                        items = invData.items,
                    })
                    exports.sunset_ui:SetFocus(true, true)
                    shopOpen = true
                end
            else
                exports.sunset_ui:Notify(err or exports.sunset_core:Translate('fishingshop.message.inventory_load_failed'), 'error')
            end
            SetTimeout(2000, function() inCooldown = false end)
        end)
    end
end)

-- ── Fishing shop UI NUI events (via nui_bridge forward) ───────
AddEventHandler('sunset:nui:fishingShopClose', function()
    shopOpen = false
    exports.sunset_ui:SetFocus(false, false)
    exports.sunset_ui:Send('fishingShopHide', {})
end)

AddEventHandler('sunset:nui:fishingShopBuy', function(data)
    local cart = data and data.cart
    if not cart or #cart == 0 then return end
    local ok, err = Sunset.AwaitCallback('sunset:fishingshop:buyCart', cart)
    if ok then
        exports.sunset_ui:Notify(exports.sunset_core:Translate('fishingshop.message.purchase_successful', { total = string.format('%d', ok.total or 0) }), 'success', 5000)
    else
        exports.sunset_ui:Notify(tostring(err or exports.sunset_core:Translate('fishingshop.message.purchase_failed')), 'error')
    end
    -- Re-arm the buy button. Without this the JS side stays locked in
    -- "Processing..." until its 6s safety-net timer fires.
    exports.sunset_ui:Send('shopBuyResult', {})
end)

AddEventHandler('sunset:nui:fishingShopSell', function(data)
    local cart = data and data.cart
    if not cart or #cart == 0 then return end
    local ok, err = Sunset.AwaitCallback('sunset:fishingshop:sellCart', cart)
    if ok then
        exports.sunset_ui:Notify(tostring(ok), 'success', 5000)
    else
        exports.sunset_ui:Notify(tostring(err or exports.sunset_core:Translate('fishingshop.message.sale_failed')), 'error')
    end
    -- Re-arm the sell button immediately after the server responds.
    exports.sunset_ui:Send('shopBuyResult', {})
    -- Refresh the item grid so sold fish disappear. If the inventory is
    -- now empty the JS will close the window automatically.
    local invData = Sunset.AwaitCallback('sunset:fishingshop:getFishInventory')
    exports.sunset_ui:Send('fishingShopRefresh', {
        items = (invData and invData.items) or {},
    })
end)

RegisterCommand('sellfish', function()
    openFishSellMenu()
end, false)

CreateThread(function()
    Wait(2000)
    TriggerEvent('chat:addSuggestion', '/sellfish', 'Sell fish nearby or mark the nearest fish buyer on GPS')
end)
