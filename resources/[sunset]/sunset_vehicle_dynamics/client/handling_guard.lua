--[[
    Detects legacy addon handling.meta signatures (extreme roll centres / grip)
    that cause rollover even after vehicles.meta donor migration.
]]

SunsetVehicleDynamicsClient = SunsetVehicleDynamicsClient or {}
local SVD = SunsetVehicleDynamicsClient

--- TOL / generic addon poison: roll centre way above Rockstar supercar norms.
function SVD.HasLegacyAddonPoisonHandling(veh)
    if not veh or not DoesEntityExist(veh) then return false end
    local rollF = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fRollCentreHeightFront')
    local rollR = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fRollCentreHeightRear')
    local traction = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fTractionCurveMax')
    if rollF > 0.42 or rollR > 0.42 then return true end
    if traction > 3.35 and rollF > 0.32 then return true end
    return false
end

exports('HasLegacyAddonPoisonHandling', function(veh)
    return SVD.HasLegacyAddonPoisonHandling(veh)
end)

function SVD.NotifyLegacyPoisonHandling(veh, modelName, donorId)
    local rollF = GetVehicleHandlingFloat(veh, 'CHandlingData', 'fRollCentreHeightFront')
    local msg = string.format(
        'Legacy handling still on this vehicle (rollF=%.2f). Park and respawn from garage — donor should be %s.',
        rollF,
        donorId or 'GTA native'
    )
    print(('^1[vehicle_dynamics] %s (%s)^7'):format(msg, modelName or '?'))
    TriggerEvent('chat:addMessage', {
        color = { 255, 120, 80 },
        multiline = true,
        args = { 'Handling', msg },
    })
end
