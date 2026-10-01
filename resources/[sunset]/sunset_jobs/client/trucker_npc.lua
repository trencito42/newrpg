-- sunset_jobs · client/trucker_npc.lua
-- Laptop route selector & terminal interaction for Trucker job.

local LAPTOP_COORDS = vector4(1207.92, -3114.87, 5.54, 259.54)
local LAPTOP_DIST   = 2.5
local INTERACT_KEY  = 38   -- E

local nearLaptop        = false
local laptopOpen        = false
local truckerUnlockAt   = 0

local function laptopCenter()
    return vector3(LAPTOP_COORDS.x, LAPTOP_COORDS.y, LAPTOP_COORDS.z)
end

local function truckerInteractionsReady()
    if GetGameTimer() < truckerUnlockAt then return false end
    if IsNuiFocused() or IsPauseMenuActive() then return false end
    return true
end

local function armGrace(ms)
    truckerUnlockAt = GetGameTimer() + (ms or 2000)
end

-- ── Open laptop UI ────────────────────────────────────────────

local laptopOpenedAt = 0

local function openLaptopUi()
    if laptopOpen then return end
    laptopOpen = true
    laptopOpenedAt = GetGameTimer()
    CreateThread(function()
        local rankData  = Sunset.AwaitCallback('sunset:jobs:trucker:getRank')
        local routeData = Sunset.AwaitCallback('sunset:jobs:trucker:getRoutes')
        exports.sunset_ui:Send('truckerLaptopOpen', {
            rank   = (rankData and rankData.level)  or 1,
            xp     = (rankData and rankData.xp)     or 0,
            xpNext = (rankData and rankData.xpNext) or 300,
            routes = routeData or {},
        })
        exports.sunset_ui:SetFocus(true, true, false, 'trucker_laptop')
    end)
end

RegisterNetEvent('sunset:jobs:trucker:openLaptop', function()
    openLaptopUi()
end)

-- ── Spawn Laptop Blip ─────────────────────────────────────────

local truckerLaptopBlip = nil
local function setupLaptopBlip()
    if truckerLaptopBlip and DoesBlipExist(truckerLaptopBlip) then RemoveBlip(truckerLaptopBlip) end
    truckerLaptopBlip = Sunset.CreateSafeBlip(LAPTOP_COORDS, {
        sprite = 521,
        color = 5,
        scale = 0.7,
        name = exports.sunset_core:Translate('jobs.msg.route_laptop'),
        shortRange = true
    })
end

RegisterNetEvent('sunset:client:languageChanged', function()
    setupLaptopBlip()
end)

CreateThread(function()
    Sunset.AwaitGameReady()
    setupLaptopBlip()
end)

-- ── Proximity loop for Laptop Terminal ────────────────────────

CreateThread(function()
    while true do
        local pos  = GetEntityCoords(PlayerPedId())
        local dLap = #(pos - laptopCenter())
        nearLaptop = dLap < LAPTOP_DIST

        -- [JOBS AUDIT] If something else force-closed the NUI (death handler, other modal, crash) our
        -- laptopOpen flag stayed true and the laptop could never be opened again this session.
        if laptopOpen and GetGameTimer() - laptopOpenedAt > 4000 and not IsNuiFocused() then
            laptopOpen = false
        end
        if nearLaptop and not laptopOpen and truckerInteractionsReady() then
            -- Draw ground marker under laptop desk
            DrawMarker(1,
                LAPTOP_COORDS.x, LAPTOP_COORDS.y, LAPTOP_COORDS.z - 0.95,
                0, 0, 0,
                0, 0, 0,
                0.8, 0.8, 0.35,
                245, 158, 11, 160,
                false, false, 2, false, nil, nil, false)

            BeginTextCommandDisplayHelp('STRING')
            AddTextComponentSubstringPlayerName(exports.sunset_core:Translate('hint.native.open_route_laptop'))
            EndTextCommandDisplayHelp(0, false, true, 100)

            if IsControlJustPressed(0, INTERACT_KEY) or IsDisabledControlJustPressed(0, INTERACT_KEY) then
                openLaptopUi()
            end
            Wait(0)
        else
            Wait(250)
        end
    end
end)

-- ── NUI events ────────────────────────────────────────────────

AddEventHandler('sunset:nui:truckerLaptopClose', function()
    if not laptopOpen then return end
    laptopOpen = false
    exports.sunset_ui:SetFocus(false, false, false, 'trucker_laptop')
    ClearPedTasksImmediately(PlayerPedId())
    armGrace(1500)
end)

AddEventHandler('sunset:nui:modalSuperseded', function(panel)
    if panel ~= 'truckerLaptop' then return end
    if not laptopOpen then return end
    laptopOpen = false
    exports.sunset_ui:SetFocus(false, false, false, 'trucker_laptop')
    armGrace(1000)
end)

AddEventHandler('sunset:nui:truckerPickRoute', function(data)
    if not data or not data.routeIndex then return end
    laptopOpen = false
    exports.sunset_ui:SetFocus(false, false, false, 'trucker_laptop')
    ClearPedTasksImmediately(PlayerPedId())
    armGrace(2000)
    local routeIdx = data.routeIndex
    CreateThread(function()
        Wait(200)
        if Sunset.Jobs and Sunset.Jobs.StartTrucker then
            Sunset.Jobs.StartTrucker(routeIdx)
        else
            TriggerEvent('sunset:jobs:trucker:startShift', routeIdx)
        end
    end)
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if laptopOpen then
        laptopOpen = false
        exports.sunset_ui:SetFocus(false, false, false, 'trucker_laptop')
    end
end)
