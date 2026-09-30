-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — SA:MP-Style CNN Advertisement Engine (client/main.lua)
--  World blips, interaction markers & help prompts
-- ═══════════════════════════════════════════════════════════════

local Blips = {}

local function setupBlips()
    for _, b in ipairs(Blips) do
        if DoesBlipExist(b) then RemoveBlip(b) end
    end
    Blips = {}

    local cfg = Config.CNN or {}
    local blipCfg = cfg.blip or {}
    for _, loc in ipairs(cfg.locations or {}) do
        local blip = AddBlipForCoord(loc.coords.x, loc.coords.y, loc.coords.z)
        SetBlipSprite(blip, blipCfg.sprite or 459)
        SetBlipDisplay(blip, 4)
        SetBlipScale(blip, blipCfg.scale or 0.8)
        SetBlipColour(blip, blipCfg.color or 2)
        SetBlipAsShortRange(blip, true)
        BeginTextCommandSetBlipName('STRING')
        AddTextComponentSubstringPlayerName(blipCfg.label or 'CNN - Anunțuri')
        EndTextCommandSetBlipName(blip)
        Blips[#Blips + 1] = blip
    end
end

CreateThread(function()
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
                        AddTextComponentSubstringPlayerName('Scrie ~g~/ad [text]~s~ pentru a publica un anunț CNN ($' .. (Config.CNN.price or 500) .. ').')
                        EndTextCommandDisplayHelp(0, false, true, -1)
                    end
                end
            end
        end
        Wait(wait)
    end
end)

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then
        for _, b in ipairs(Blips) do
            if DoesBlipExist(b) then RemoveBlip(b) end
        end
        Blips = {}
    end
end)
