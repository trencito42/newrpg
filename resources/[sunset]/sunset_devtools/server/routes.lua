-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — server/routes.lua
--  Server authority for Visual Route Creator CRUD.
--  Validates permissions, sanitizes payloads, and interacts with route_store.
-- ═══════════════════════════════════════════════════════════════

local Cfg = SunsetDevTools.Config

local function killSwitchOn()
    return GetConvar(Cfg.enabledConvar, 'false') == 'true'
end

local function hasPermission(source)
    if source == 0 then return true end
    if not killSwitchOn() then return false end
    if GetResourceState('sunset_admin') ~= 'started' then return false end
    local ok, level = pcall(function() return exports.sunset_admin:GetAdminLevel(source) end)
    return ok and level and tonumber(level) >= (Cfg.minAdminLevel or 4)
end

-- Get all routes for a job
exports.sunset_core:RegisterCallback('sunset:devtools:getJobRoutes', function(source, jobName)
    if not hasPermission(source) then
        return nil, { localeKey = 'devtools.message.permission_denied' }
    end
    jobName = tostring(jobName or ''):lower()
    local routes = exports.sunset_jobs:GetRoutes(jobName)
    return routes or {}
end)

-- Save routes list for a job
exports.sunset_core:RegisterCallback('sunset:devtools:saveJobRoutes', function(source, jobName, routesList)
    if not hasPermission(source) then
        return false, { localeKey = 'devtools.message.permission_denied' }
    end
    jobName = tostring(jobName or ''):lower()
    if type(routesList) ~= 'table' then
        return false, { localeKey = 'devtools.message.invalid_routes_payload' }
    end

    local ok, err = exports.sunset_jobs:SaveRoutes(jobName, routesList)
    if not ok then
        print(('^1[devtools] Failed to save %s routes: %s^7'):format(jobName, tostring(err)))
        return false, err or 'Failed to save routes'
    end

    local author = GetPlayerName(source) or ('ID ' .. source)
    print(('^2[devtools] %s saved %d %s routes to canonical store.^7'):format(author, #routesList, jobName))
    return true
end)

-- Reload routes from disk
exports.sunset_core:RegisterCallback('sunset:devtools:reloadJobRoutes', function(source)
    if not hasPermission(source) then
        return false, { localeKey = 'devtools.message.permission_denied' }
    end
    local ok = exports.sunset_jobs:ReloadRoutes()
    if ok then
        local author = GetPlayerName(source) or ('ID ' .. source)
        print(('^2[devtools] %s reloaded routes from disk.^7'):format(author))
    end
    return ok
end)
