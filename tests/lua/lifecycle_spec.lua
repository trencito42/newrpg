local transitions = {}
RPG = {
    Config = {
        lifecycle = {
            connected = { authenticating = true, disconnecting = true },
            authenticating = { authenticated = true, disconnecting = true },
            authenticated = { onboarding = true, spawning = true, disconnecting = true },
            onboarding = { spawning = true, disconnecting = true },
            spawning = { active = true, disconnecting = true },
            active = { spawning = true, disconnecting = true },
            disconnecting = {},
        }
    },
    Log = function() end,
    Util = {
        Clamp = function(v, min, max) return math.max(min, math.min(max, v)) end,
        Normalize = function(s) return tostring(s or ''):lower() end,
        Trim = function(s) return tostring(s or ''):match('^%s*(.-)%s*$') or '' end,
    }
}

local playerState = 'authenticated'
local function checkTransition(from, to)
    local allowed = RPG.Config.lifecycle[from]
    if not allowed or not allowed[to] then return false end
    return true
end

-- 1. Valid transitions
assert(checkTransition('authenticating', 'authenticated') == true)
assert(checkTransition('authenticated', 'onboarding') == true)
assert(checkTransition('authenticated', 'spawning') == true)
assert(checkTransition('onboarding', 'spawning') == true)
assert(checkTransition('spawning', 'active') == true)
assert(checkTransition('active', 'spawning') == true)
assert(checkTransition('active', 'disconnecting') == true)

-- 2. Invalid transitions (Direct unauthorized bypasses)
assert(checkTransition('authenticating', 'active') == false)
assert(checkTransition('authenticated', 'active') == false)
assert(checkTransition('onboarding', 'active') == false)
assert(checkTransition('disconnecting', 'active') == false)

-- 3. Position and health sanity logic
local coords = { x = 120.5, y = -1400.2, z = 30.1 }
local heading = 90.0
local health = 250
local clampedHealth = RPG.Util.Clamp(health, 0, 200)
assert(clampedHealth == 200)

local deadHealth = -10
local clampedDead = RPG.Util.Clamp(deadHealth, 0, 200)
assert(clampedDead == 0)

print('lifecycle_spec: ok')
