-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — SA:MP-Style CNN Advertisement Engine (client/main.lua)
--  World blips, interaction markers & help prompts
-- ═══════════════════════════════════════════════════════════════

local Blips = {}

local function tr(key, params)
    return exports.sunset_core:Translate(key, params)
end

local function setupBlips()
    for _, b in ipairs(Blips) do
        if DoesBlipExist(b) then RemoveBlip(b) end
    end
    Blips = {}

    local cfg = Config.CNN or {}
    local blipCfg = cfg.blip or {}
    for _, loc in ipairs(cfg.locations or {}) do
        local blip = exports.sunset_core:CreateSafeBlip(loc.coords, {
            sprite = blipCfg.sprite or 459,
            color = blipCfg.color or 2,
            scale = blipCfg.scale or 0.8,
            name = tr(blipCfg.labelKey or 'cnn.blip.announcements'),
            shortRange = true
        })
        if blip then
            Blips[#Blips + 1] = blip
        end
    end
end

RegisterNetEvent('sunset:client:languageChanged', function()
    setupBlips()
end)

CreateThread(function()
    exports.sunset_core:AwaitGameReady()
    setupBlips()

    -- Proximity marker thread
    while true do
        local wait = 1500
        local ped = PlayerPedId()
        if ped ~= 0 and DoesEntityExist(ped) and not IsPedDeadOrDying(ped, true) then
            local pCoords = GetEntityCoords(ped)
            for _, loc in ipairs(Config.CNN.locations or {}) do
                local dist = #(pCoords - loc.coords)
                if dist < 25.0 then
                    wait = 0
                    DrawMarker(1, loc.coords.x, loc.coords.y, loc.coords.z - 1.0,
                        0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                        (loc.radius or 6.0) * 0.8, (loc.radius or 6.0) * 0.8, 0.5,
                        46, 204, 113, 100, false, false, 2, false, nil, nil, false
                    )
                    if dist <= (loc.radius or 6.0) then
                        BeginTextCommandDisplayHelp('STRING')
                        AddTextComponentSubstringPlayerName(tr('cnn.prompt.submit_ad', {
                            price = Config.CNN.price or 500,
                        }))
                        EndTextCommandDisplayHelp(0, false, true, -1)
                    end
                end
            end
        end
        Wait(wait)
    end
end)

AddEventHandler('sunset:client:localeChanged', function()
    setupBlips()
end)

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then
        for _, b in ipairs(Blips) do
            if DoesBlipExist(b) then RemoveBlip(b) end
        end
        Blips = {}
    end
end)
