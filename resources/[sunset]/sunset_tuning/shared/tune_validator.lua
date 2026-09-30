SunsetTuning.TuneValidator = SunsetTuning.TuneValidator or {}
local TV = SunsetTuning.TuneValidator
local PR = SunsetTuning.ProfileResolver

function TV.Validate(tune, caps)
    if not caps or not caps.supported then
        return false, { localeKey = 'tuning.message.this_vehicle_does_not_support_ecu_tuning' }
    end

    tune = SunsetTuning.SanitizeTune(tune, caps)

    if not caps.popsAndBangs and tune.pop and tune.pop.enabled then
        return false, { localeKey = 'tuning.message.pop_bang_is_not_available_on_this_vehicle' }
    end
    if not caps.flames and tune.flames and tune.flames.enabled then
        return false, { localeKey = 'tuning.message.exhaust_flames_are_not_available_on_this_vehicle' }
    end
    if not caps.antiLag and tune.antiLag and tune.antiLag.enabled then
        return false, { localeKey = 'tuning.message.anti_lag_is_not_available_on_this_vehicle' }
    end
    if not caps.nitrous and tune.nitrous and tune.nitrous.installed then
        return false, { localeKey = 'tuning.message.nitrous_is_not_available_on_this_vehicle' }
    end
    if not caps.turboBoost and tune.hardware and tune.hardware.turbo then
        return false, { localeKey = 'tuning.message.turbo_is_not_supported_on_this_vehicle_profile' }
    end
    if caps.propulsion == 'electric' then
        if tune.hardware and (tune.hardware.turbo or tune.hardware.launchControl) then
            return false, { localeKey = 'tuning.message.invalid_hardware_for_electric_vehicle' }
        end
        if tune.pop and tune.pop.enabled then return false, { localeKey = 'tuning.message.exhaust_features_invalid_for_ev' } end
    end

    if tune.hardware and tune.hardware.turbo and not caps.factoryTurbo then
        local hasTurboMod = tune.hardware.turbo == true
        if hasTurboMod and not caps.turboBoost then
            return false, { localeKey = 'tuning.message.turbo_upgrade_not_supported_without_profile' }
        end
    end

    if tune.hardware and tune.hardware.turbo == false and tune.antiLag and tune.antiLag.enabled then
        return false, { localeKey = 'tuning.message.anti_lag_requires_a_turbo' }
    end

    return true, tune
end

function TV.ValidateForModel(tune, model, classId)
    local caps = PR.Resolve(model, classId)
    return TV.Validate(tune, caps)
end
