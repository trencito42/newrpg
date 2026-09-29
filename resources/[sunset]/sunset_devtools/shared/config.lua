-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — shared/config.lua
--  Kill-switch and permission defaults.
--  Production server.cfg must NOT ensure this resource.
-- ═══════════════════════════════════════════════════════════════

SunsetDevTools = SunsetDevTools or {}

SunsetDevTools.Config = {
    -- setr sunset_devtools_enabled true   (dev box only)
    enabledConvar = 'sunset_devtools_enabled',

    -- setr sunset_devtools_debug true  (verbose F8 output)
    debugConvar   = 'sunset_devtools_debug',

    -- Minimum sunset_admin level required to open devtools.
    minAdminLevel = 1,

    -- Drafts written to server-side file (relative to resource root).
    draftFile = 'devtools_drafts.json',

    -- Max undo history per gizmo session.
    maxUndoHistory = 30,

    -- Ground probe: upward probe offset above configured Z.
    groundProbeOffset = 10.0,

    -- Clearance raycast: height above entity origin to probe.
    headClearanceOffset = 2.0,

    -- World probe raycast length from camera.
    probeCastLength = 200.0,

    -- Rate-limit expensive checks to every N frames while gizmo is active.
    validationIntervalFrames = 30,
}
