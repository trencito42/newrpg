Sunset = Sunset or {}
SunsetBoot = SunsetBoot or {}

function SunsetBoot.IsDebug()
    local val = GetConvar('sv_sunset_bootdebug', '0')
    return val == '1' or val == 'true' or val == 'on'
end

function SunsetBoot.IsVerbose()
    if not SunsetBoot.IsDebug() then return false end
    local val = GetConvar('sv_sunset_bootdebug_verbose', '0')
    return val == '1' or val == 'true' or val == 'on'
end
