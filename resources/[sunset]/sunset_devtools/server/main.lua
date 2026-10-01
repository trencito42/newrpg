-- ═══════════════════════════════════════════════════════════════
--  SUNSET DEVTOOLS — server/main.lua
--  Kill switch gate, permission check, and event relay.
--  Never trust client authorization.
-- ═══════════════════════════════════════════════════════════════

local Cfg = SunsetDevTools.Config

local function killSwitchOn()
    return (GetConvarInt('sunset_dev', 0) == 1 and GetConvar(Cfg.enabledConvar, 'false') == 'true')
end

local function hasPermission(source)
    if source == 0 then return true end
    if not killSwitchOn() then return false end
    if GetResourceState('sunset_admin') ~= 'started' then return false end
    local ok, level = pcall(function() return exports.sunset_admin:GetAdminLevel(source) end)
    return ok and level and tonumber(level) >= Cfg.minAdminLevel
end

-- Client requests a permission check
RegisterNetEvent('sunset:devtools:checkPerm')
AddEventHandler('sunset:devtools:checkPerm', function()
    local source = source
    if source == 0 then return end
    local granted = hasPermission(source)
    TriggerClientEvent('sunset:devtools:permResult', source, granted)
    if granted then
        local name = GetPlayerName(source) or ('ID ' .. source)
        print(('^3[devtools] %s (ID %d) connected to Placement Studio.^7'):format(name, source))
    end
end)

-- Client saves a draft
RegisterNetEvent('sunset:devtools:saveDraft')
AddEventHandler('sunset:devtools:saveDraft', function(entry)
    local source = source
    if not hasPermission(source) then return end
    if type(entry) ~= 'table' or not entry.key then return end
    DevToolsDrafts.save(entry)
    local name = GetPlayerName(source) or ('ID ' .. source)
    print(('^3[devtools] Draft saved by %s: %s/%s^7'):format(name, entry.adapter or '?', entry.key))
end)

-- /devdrafts [clear] — server-side console command
RegisterCommand('devdrafts', function(source, args)
    if source ~= 0 and not hasPermission(source) then
        print('[devtools] Permission denied for /devdrafts')
        return
    end
    local action = args[1] and string.lower(args[1]) or 'list'
    if action == 'clear' then
        DevToolsDrafts.clear(args[2])
        print('[devtools] Drafts cleared' .. (args[2] and (' for: ' .. args[2]) or ' (all)'))
    else
        local all = DevToolsDrafts.getAll()
        local count = 0
        for k, d in pairs(all) do
            count = count + 1
            print(('[devtools] Draft: %s  savedAt=%s  v4=%.2f,%.2f,%.2f,%.2f'):format(
                k, d.savedAt or '?', d.v4.x, d.v4.y, d.v4.z, d.v4.w))
        end
        print(('[devtools] Total: %d draft(s)'):format(count))
    end
end, false)

if killSwitchOn() then
    print('^3[sunset_devtools] server started — kill switch ON. Min admin level: ' .. Cfg.minAdminLevel .. '^7')
else
    print('^3[sunset_devtools] server started — kill switch OFF (setr sunset_devtools_enabled true to activate).^7')
end
