-- Native GTA minimap health/armour strip ownership.
--
-- The minimap scaleform is reset by several game/UI transitions. A one-shot
-- SETUP_HEALTH_ARMOUR call can therefore be lost after the scaleform restarts,
-- leaving the lower strip missing or partially initialised. Keep this logic in
-- one small place and re-apply it at a low frequency instead of every frame.

local function showNativeVitals(minimap)
    BeginScaleformMovieMethod(minimap, 'SETUP_HEALTH_ARMOUR')
    ScaleformMovieMethodAddParamInt(2)
    EndScaleformMovieMethod()

    BeginScaleformMovieMethod(minimap, 'SHOW_HEALTH_ARMOUR')
    EndScaleformMovieMethod()
end

CreateThread(function()
    local minimap = RequestScaleformMovie('minimap')
    while not HasScaleformMovieLoaded(minimap) do
        Wait(0)
    end

    -- Rebuild the minimap scaleform once. This clears stale lower-strip/blur
    -- state that can otherwise survive a HUD/resource restart.
    SetRadarBigmapEnabled(true, false)
    Wait(0)
    SetRadarBigmapEnabled(false, false)
    Wait(100)

    while true do
        showNativeVitals(minimap)
        Wait(500)
    end
end)
