local isDebug = (SunsetBoot and SunsetBoot.IsDebug and SunsetBoot.IsDebug()) or false

local function logMinimap(tag, msg)
    if isDebug then
        print(('^2[MINIMAP] %s%s^7'):format(tag, msg and (' ' .. tostring(msg)) or ''))
    end
end

local function showNativeVitals(minimap)
    if not HasScaleformMovieLoaded(minimap) then return false end
    BeginScaleformMovieMethod(minimap, 'SETUP_HEALTH_ARMOUR')
    ScaleformMovieMethodAddParamInt(2)
    EndScaleformMovieMethod()

    BeginScaleformMovieMethod(minimap, 'SHOW_HEALTH_ARMOUR')
    EndScaleformMovieMethod()
    return true
end

CreateThread(function()
    logMinimap('init')

    if Sunset and Sunset.AwaitGameReady then
        Sunset.AwaitGameReady()
    else
        pcall(function() exports.sunset_core:AwaitGameReady() end)
    end

    -- Explicitly enforce normal compact GTA radar size at all times.
    -- Never toggle or enable bigmap during initialization or gameplay.
    SetRadarBigmapEnabled(false, false)
    logMinimap('radar_normal')

    local minimap = RequestScaleformMovie('minimap')
    local deadline = GetGameTimer() + 10000
    while not HasScaleformMovieLoaded(minimap) and GetGameTimer() < deadline do
        Wait(50)
    end

    if HasScaleformMovieLoaded(minimap) then
        logMinimap('scaleform_ready')
        if showNativeVitals(minimap) then
            logMinimap('native_vitals_applied')
        end
    end

    while true do
        -- Maintain compact radar size and refresh scaleform health/armour strip periodically
        SetRadarBigmapEnabled(false, false)
        if HasScaleformMovieLoaded(minimap) then
            showNativeVitals(minimap)
        else
            minimap = RequestScaleformMovie('minimap')
        end
        Wait(500)
    end
end)
