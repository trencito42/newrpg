-- Centralized safe-teleport with world streaming.
-- Always stream geometry at the destination BEFORE moving the entity to avoid
-- fall-through on unloaded collision.  All transition code (properties,
-- elevators, death, admin, etc.) should call Sunset.World.SafeTeleport.

Sunset = Sunset or {}
Sunset.World = Sunset.World or {}

local teleportInProgress = false -- true while SafeTeleport holds the ped frozen / focus moved
local PRESTREAM_DELAY   = 300   -- ms to stream before moving entity
local COLLISION_TIMEOUT = 8000  -- ms to wait for collision after move

-- Poll until HasCollisionLoadedAroundEntity is true or timeout expires.
-- Keeps re-requesting the coord each tick so the engine knows what to stream.
-- Returns true on success, false on timeout.
local function waitCollision(x, y, z, timeout)
    local deadline = GetGameTimer() + (timeout or COLLISION_TIMEOUT)
    while GetGameTimer() < deadline do
        RequestCollisionAtCoord(x, y, z)
        if HasCollisionLoadedAroundEntity(PlayerPedId()) then
            return true
        end
        Wait(50)
    end
    return false
end

Sunset.World.WaitForCollision = waitCollision

--[[
    Sunset.World.SafeTeleport(coords4, opts) → bool

    Fades screen out, forces streaming at `coords4`, waits for collision,
    moves the local ped, fades back in.

    coords4   vector4 — x/y/z/w(heading)
    opts (all optional):
      timeout       number   ms to wait for collision after moving (default 8000)
      fade          bool     do screen fade (default true)
      fadeOutMs     number   (default 400)
      fadeInMs      number   (default 500)
      prestreamMs   number   delay after SetFocus before moving (default 300)
      loadRadius    number   sphere radius for NewLoadSceneStartSphere (default 80)
      restoreOnFail bool     restore prev coords on collision timeout (default true)

    Returns true if collision confirmed, false on timeout.
    On timeout without restoreOnFail the ped is left at dest but may be clipping.
]]
function Sunset.World.SafeTeleport(coords4, opts)
    if not coords4 then return false end
    opts = opts or {}

    local ped      = PlayerPedId()
    local x, y, z  = coords4.x, coords4.y, coords4.z
    local heading  = coords4.w or 0.0
    local doFade   = opts.fade ~= false
    local timeout  = opts.timeout or COLLISION_TIMEOUT
    local restore  = opts.restoreOnFail ~= false

    -- Save previous position for optional failure recovery
    local prevCoords  = GetEntityCoords(ped)
    local prevHeading = GetEntityHeading(ped)

    if doFade then
        DoScreenFadeOut(opts.fadeOutMs or 400)
        -- Bounded: a fade that never completes must not hang the teleport.
        local fadeDeadline = GetGameTimer() + (opts.fadeOutMs or 400) + 2000
        while not IsScreenFadedOut() and GetGameTimer() < fadeDeadline do Wait(0) end
    end

    teleportInProgress = true
    FreezeEntityPosition(ped, true)

    -- Force the engine to begin streaming the destination before we arrive
    SetFocusPosAndVel(x, y, z, 0.0, 0.0, 0.0)
    NewLoadSceneStartSphere(x, y, z, opts.loadRadius or 80.0, 0)
    RequestCollisionAtCoord(x, y, z)
    Wait(opts.prestreamMs or PRESTREAM_DELAY)

    -- Move entity
    SetEntityCoordsNoOffset(ped, x, y, z, false, false, false)
    SetEntityHeading(ped, heading)

    -- Wait for collision around the entity at its new position
    local ok = waitCollision(x, y, z, timeout)

    NewLoadSceneStop()
    ClearFocus()

    if not ok and restore then
        -- Collision timed out — return player to their previous location
        SetEntityCoordsNoOffset(ped, prevCoords.x, prevCoords.y, prevCoords.z, false, false, false)
        SetEntityHeading(ped, prevHeading)
        local fallbackDeadline = GetGameTimer() + 3000
        while not HasCollisionLoadedAroundEntity(PlayerPedId()) and GetGameTimer() < fallbackDeadline do
            RequestCollisionAtCoord(prevCoords.x, prevCoords.y, prevCoords.z)
            Wait(50)
        end
    end

    Wait(200)
    FreezeEntityPosition(PlayerPedId(), false)
    teleportInProgress = false

    if doFade then
        DoScreenFadeIn(opts.fadeInMs or 500)
    end

    return ok
end

-- [CLIENT_PERF_ENTITY_AUDIT] If core restarts mid-teleport, do not leave the ped
-- frozen or the streaming focus pinned to the destination.
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if teleportInProgress then
        NewLoadSceneStop()
        ClearFocus()
        FreezeEntityPosition(PlayerPedId(), false)
        teleportInProgress = false
    end
end)
