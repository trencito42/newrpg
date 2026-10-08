SunsetTuningClient = SunsetTuningClient or {}
local STC = SunsetTuningClient
local TC = SunsetTuning.TuneCalculator

STC._internalBaselineRestore = false

AddEventHandler('onClientResourceStart', function(resourceName)
    if resourceName == 'sunset_tuning' then
        STC.appliedVehicles = STC.appliedVehicles or {}
    end
end)

local function copyTable(value)
    if type(value) ~= 'table' then return value end
    local result = {}
    for key, child in pairs(value) do
        result[key] = copyTable(child)
    end
    return result
end

function STC.getModelHash(veh)
    return GetEntityModel(veh)
end

function CaptureModelBaseline(veh)
    return STC.captureModelBaseline(veh)
end
exports('CaptureModelBaseline', CaptureModelBaseline)

function STC.captureModelBaseline(veh)
    if not veh or veh == 0 or not DoesEntityExist(veh) then return nil end

    local handlingBaseline = {}
    for _, field in ipairs(TC.GetBaselineFields()) do
        handlingBaseline[field] = GetVehicleHandlingFloat(veh, 'CHandlingData', field)
    end

    local baseline = copyTable(handlingBaseline)
    baseline.mods = {}
    SetVehicleModKit(veh, 0)
    for key, slot in pairs(SunsetTuning.HardwareSlots or {}) do
        baseline.mods[key] = GetVehicleMod(veh, slot.modType)
    end
    baseline.turbo = IsToggleModOn(veh, 18)

    return baseline
end

function STC.getVehicleCapabilities(veh)
    local modelHash = STC.getModelHash(veh)
    local modelName = GetDisplayNameFromVehicleModel(modelHash)
    if modelName then modelName = modelName:lower() end
    local classId = GetVehicleClass(veh)
    return SunsetTuning.ProfileResolver.Resolve(modelName, classId)
end

--- Restore ECU/hardware state. Handling floats are restored only when reverting a non-stock tune.
function STC.restoreBaselineHandling(veh, baseline, opts)
    if not veh or not DoesEntityExist(veh) then return end
    opts = opts or {}
    local restoreHandling = opts.restoreHandling == true

    if restoreHandling and baseline then
        for field, value in pairs(baseline) do
            if type(field) == 'string' and field:sub(1, 1) == 'f' and type(value) == 'number' then
                SetVehicleHandlingFloat(veh, 'CHandlingData', field, value)
            end
        end
    end

    SetVehicleModKit(veh, 0)
    if baseline and baseline.mods then
        for key, slot in pairs(SunsetTuning.HardwareSlots or {}) do
            SetVehicleMod(veh, slot.modType, baseline.mods[key] or -1, false)
        end
    end
    if baseline then
        ToggleVehicleMod(veh, 18, baseline.turbo == true)
    end

    SetVehicleEnginePowerMultiplier(veh, 0.0)
    SetVehicleEngineTorqueMultiplier(veh, 1.0)
    ModifyVehicleTopSpeed(veh, 0.0)
    SetVehicleTurboPressure(veh, 0.0)
    pcall(function() EnableVehicleExhaustPops(veh, false) end)
end
