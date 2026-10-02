-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Minimap lifecycle (sunset_hud/client/minimap.lua)
-- ═══════════════════════════════════════════════════════════════
--
-- ROOT CAUSE OF PREVIOUS REGRESSION:
--   The old version ran a `while true do Wait(500)` loop that called
--   SetRadarBigmapEnabled(false, false) + SETUP_HEALTH_ARMOUR(2) +
--   SHOW_HEALTH_ARMOUR every 500 ms.
--
--   SetRadarBigmapEnabled triggers a Scaleform radar re-initialisation
--   even when called with (false, false) on an already-compact radar.
--   Doing this 2×/second kept the minimap permanently stuck in a
--   transitional state (oversized / square appearance).
--
--   SETUP_HEALTH_ARMOUR in the Scaleform creates a second health/armour
--   strip rendered BY the Scaleform.  Component 4 (native HP/armour) is
--   intentionally NOT hidden in main.lua, so both strips were visible
--   simultaneously — producing the ghost rectangle underneath the radar.
--
-- FIX:
--   1. SetRadarBigmapEnabled(false, false) is called ONCE at startup.
--      GTA then owns the radar geometry; we never poll it again.
--   2. SETUP_HEALTH_ARMOUR / SHOW_HEALTH_ARMOUR are NOT called.
--      Component 4 (native) handles the health/armour display.
--   3. No polling loop — no repeated Scaleform resets.
--
-- RESTART SAFETY:
--   On resource restart the CreateThread below re-runs and calls
--   SetRadarBigmapEnabled once more — harmless single call.
-- ═══════════════════════════════════════════════════════════════

CreateThread(function()
    -- Wait for the game/character to be ready before touching radar state.
    if Sunset and Sunset.AwaitGameReady then
        Sunset.AwaitGameReady()
    else
        pcall(function() exports.sunset_core:AwaitGameReady() end)
    end

    -- Single call: enforce compact radar.  Never repeated.
    SetRadarBigmapEnabled(false, false)
end)
