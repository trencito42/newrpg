exports.rpg_core:RegisterCallback('auth.login', function(src, data)
    if type(data) ~= 'table' then return nil, 'Invalid username or password.' end
    local profile, err = exports.rpg_core:Authenticate(src, data.username, data.password)
    data.password = nil
    if not profile then return nil, err or 'Invalid username or password.' end
    TriggerClientEvent('rpg:auth:success', src, profile)
    return profile
end, { allowUnauthenticated = true, windowMs = 60000, maximum = 8, timeoutMs = 20000 })

exports.rpg_core:RegisterCallback('auth.register', function(src, data)
    if type(data) ~= 'table' then return nil, 'Invalid registration data.' end
    local profile, err = exports.rpg_core:RegisterAccount(src, data)
    data.password = nil
    if not profile then return nil, err or 'Registration could not be completed.' end
    TriggerClientEvent('rpg:auth:success', src, profile)
    return profile
end, { allowUnauthenticated = true, windowMs = 60000, maximum = 4, timeoutMs = 25000 })

