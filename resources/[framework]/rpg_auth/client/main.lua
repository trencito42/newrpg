local submitting = false

RegisterNetEvent('rpg:auth:show', function()
    ShutdownLoadingScreen()
    ShutdownLoadingScreenNui()
    TriggerScreenblurFadeOut(0)
    ClearTimecycleModifier()
    ClearExtraTimecycleModifier()
    exports.rpg_ui:Show('auth', {})
    exports.rpg_ui:AcquireFocus('auth', true, false)
    SetNuiFocus(true, true)
    SetNuiFocusKeepInput(false)
end)

local function submit(rpc, data)
    if submitting then return nil, 'Please wait for the current request.' end
    submitting = true
    local result, err = exports.rpg_core:Await(rpc, data)
    submitting = false
    return result, err
end

exports('Login', function(data)
    return submit('auth.login', data)
end)

exports('Register', function(data)
    return submit('auth.register', data)
end)

RegisterNetEvent('rpg:auth:success', function(profile)
    exports.rpg_ui:Hide('auth')
    exports.rpg_ui:ReleaseFocus('auth')
    SetNuiFocus(false, false)
    SetNuiFocusKeepInput(false)
    TriggerEvent('rpg:spawn:begin', profile)
end)

