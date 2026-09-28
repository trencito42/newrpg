local duty = {}
local backPositions = {}
local frozen = {}
local spectating = {}

local labels = { [0] = 'Player', [1] = 'Helper', [2] = 'Moderator', [3] = 'Admin', [4] = 'Super Admin', [5] = 'Owner' }

local function register(definition)
    exports.rpg_core:RegisterCommand(definition)
end

local function playerOrError(id)
    local src = tonumber(id)
    if not src or not GetPlayerName(src) then return nil, ('Player #%s is not online.'):format(tostring(id or '?')) end
    local player = exports.rpg_core:GetPlayer(src)
    if not player then return nil, ('Player #%d is connected but not authenticated.'):format(src) end
    return player
end

local function canTarget(actor, target, allowSelf)
    if actor == 0 then return true end
    if not allowSelf and actor == target.source then return false, 'You cannot target yourself with this command.' end
    local actorLevel = exports.rpg_core:GetAdminLevel(actor)
    if target.adminLevel >= actorLevel then return false, 'You cannot act on staff of equal or higher level.' end
    return true
end

local function entityCoords(src)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return nil end
    local entity = GetVehiclePedIsIn(ped, false)
    if not entity or entity == 0 then entity = ped end
    local coords = GetEntityCoords(entity)
    return { x = coords.x, y = coords.y, z = coords.z, heading = GetEntityHeading(entity), bucket = GetPlayerRoutingBucket(src) }
end

local function moveRoutingContext(src, bucket)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return end
    local vehicle = GetVehiclePedIsIn(ped, false)
    if vehicle and vehicle ~= 0 then
        SetEntityRoutingBucket(vehicle, bucket)
        for _, raw in ipairs(GetPlayers()) do
            local occupant = tonumber(raw)
            local occupantPed = GetPlayerPed(occupant)
            if occupantPed and occupantPed ~= 0 and GetVehiclePedIsIn(occupantPed, false) == vehicle then
                SetPlayerRoutingBucket(occupant, bucket)
            end
        end
    else
        SetPlayerRoutingBucket(src, bucket)
    end
end

local function teleportAuthoritative(src, destination)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return false end
    local entity = GetVehiclePedIsIn(ped, false)
    if not entity or entity == 0 then entity = ped end
    SetEntityCoords(entity, destination.x, destination.y, destination.z, false, false, false, false)
    SetEntityHeading(entity, destination.heading or 0.0)
    TriggerClientEvent('rpg:admin:teleport', src, destination)
    return true
end

local function audit(action, actor, target, reason, metadata)
    local actorPlayer = actor ~= 0 and exports.rpg_core:GetPlayer(actor) or nil
    local targetPlayer = type(target) == 'table' and target or nil
    MySQL.insert.await([[
        INSERT INTO admin_actions (action, actor_account_id, actor_username, target_account_id, target_username, reason, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], {
        action,
        actorPlayer and actorPlayer.accountId or nil,
        actorPlayer and actorPlayer.username or 'CONSOLE',
        targetPlayer and targetPlayer.accountId or nil,
        targetPlayer and targetPlayer.username or nil,
        reason,
        metadata and json.encode(metadata) or nil,
    })
end

local function joinFrom(args, start)
    local values = {}
    for index = start, #args do values[#values + 1] = args[index] end
    local text = table.concat(values, ' '):match('^%s*(.-)%s*$') or ''
    return text ~= '' and text or nil
end

local function parseDuration(value)
    if value == 'perm' or value == 'permanent' then return nil, 'permanent' end
    local amount, unit = tostring(value or ''):match('^(%d+)([mhd])$')
    amount = tonumber(amount)
    if not amount or amount < 1 then return false, 'Use 30m, 6h, 1d, 7d, 30d, or perm.' end
    local multipliers = { m = 60, h = 3600, d = 86400 }
    local seconds = amount * multipliers[unit]
    if seconds > 31536000 then return false, 'Temporary bans cannot exceed 365 days.' end
    return seconds, value
end

local function setAdminLevelAudited(actor, target, level, reason)
    local actorPlayer = actor ~= 0 and exports.rpg_core:GetPlayer(actor) or nil
    local committed = MySQL.transaction.await({
        {
            query = 'UPDATE accounts SET admin_level = ? WHERE id = ?',
            values = { level, target.accountId },
        },
        {
            query = [[INSERT INTO admin_actions (action, actor_account_id, actor_username, target_account_id, target_username, reason, metadata)
                      VALUES ('setadmin', ?, ?, ?, ?, ?, ?)]],
            values = {
                actorPlayer and actorPlayer.accountId or nil, actorPlayer and actorPlayer.username or 'CONSOLE',
                target.accountId, target.username, reason, json.encode({ oldLevel = target.adminLevel, newLevel = level }),
            },
        },
    })
    if not committed then return false end
    return exports.rpg_core:RefreshAdminLevel(target.accountId) == level
end

local function sanction(kind, actor, target, reason, expiresAt)
    local actorPlayer = actor ~= 0 and exports.rpg_core:GetPlayer(actor) or nil
    local id
    local committed = MySQL.startTransaction(function(query)
        local inserted = query([[
            INSERT INTO sanctions (sanction_type, target_account_id, target_username, actor_account_id, actor_username, reason, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ]], {
            kind, target.accountId, target.username,
            actorPlayer and actorPlayer.accountId or nil, actorPlayer and actorPlayer.username or 'CONSOLE', reason, expiresAt,
        })
        id = inserted and inserted.insertId
        if not id then return false end
        if kind == 'ban' then
            for _, raw in ipairs(GetPlayerIdentifiers(target.source)) do
                local identifierType, identifierValue = raw:match('^([^:]+):(.+)$')
                if identifierType and identifierValue and identifierType ~= 'ip' then
                    query('INSERT INTO sanction_identifiers (sanction_id, identifier_type, identifier_value) VALUES (?, ?, ?)', { id, identifierType, identifierValue })
                end
            end
        end
        query([[
            INSERT INTO admin_actions (action, actor_account_id, actor_username, target_account_id, target_username, reason, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ]], {
            kind, actorPlayer and actorPlayer.accountId or nil, actorPlayer and actorPlayer.username or 'CONSOLE',
            target.accountId, target.username, reason, json.encode({ sanctionId = id, expiresAt = expiresAt }),
        })
        return true
    end)
    return committed and id or nil
end

register({ name = 'aduty', description = 'Toggle staff duty.', usage = '/aduty', minimumAdminLevel = 1, handler = function(src)
    duty[src] = not duty[src]
    Player(src).state:set('rpg:adminDuty', duty[src], true)
    return duty[src] and 'Admin duty enabled.' or 'Admin duty disabled.'
end })

register({ name = 'a', description = 'Staff chat.', usage = '/a [message]', minimumAdminLevel = 1, arguments = { { required = true } }, handler = function(src, args)
    local message = joinFrom(args, 1)
    if not message or #message > 280 then return false, 'Usage: /a [message] (maximum 280 characters)' end
    local sender = exports.rpg_core:GetUsername(src) or 'CONSOLE'
    for _, raw in ipairs(GetPlayers()) do
        local target = tonumber(raw)
        if exports.rpg_core:GetAdminLevel(target) >= 1 then TriggerClientEvent('rpg:chat:message', target, ('[STAFF] %s (%d): %s'):format(sender, src, message), 'admin') end
    end
    return true
end })

register({ name = 'admins', description = 'List online staff.', usage = '/admins', handler = function(src, _, reply)
    local list = {}
    for _, raw in ipairs(GetPlayers()) do
        local target = tonumber(raw)
        local level = exports.rpg_core:GetAdminLevel(target)
        if level >= 1 then list[#list + 1] = ('%s (%d) — %s%s'):format(exports.rpg_core:GetUsername(target) or '?', target, labels[level], duty[target] and ' [DUTY]' or '') end
    end
    reply(src, #list > 0 and table.concat(list, ' | ') or 'No staff are online.', 'info')
    return true
end })

register({ name = 'ainfo', description = 'Inspect framework player information.', usage = '/ainfo [id]', minimumAdminLevel = 1, arguments = { { required = true } }, handler = function(src, args, reply)
    local target, err = playerOrError(args[1]); if not target then return false, err end
    local full = MySQL.single.await([[SELECT a.email, a.login_count, p.* FROM accounts a JOIN players p ON p.account_id=a.id WHERE a.id=?]], { target.accountId })
    local coords = entityCoords(target.source)
    local stats = exports.rpg_core:GetPlayerStats(target.source)
    local email = exports.rpg_core:GetAdminLevel(src) >= 4 and full.email or '[restricted]'
    reply(src, ('ID %d | Account %d | %s | Email %s | %s/%s | L%d XP%d | Playtime %ds | Admin %s | Tutorial %s | Ping %d | HP %d Armor %d | XYZ %.2f %.2f %.2f'):format(
        target.source, target.accountId, target.username, email, target.sex, target.model, target.level, target.xp,
        stats.totalPlaytimeSeconds, labels[target.adminLevel], tostring(target.tutorialCompleted), GetPlayerPing(target.source),
        target.health, target.armor, coords and coords.x or 0, coords and coords.y or 0, coords and coords.z or 0
    ), 'info')
    return true
end })

register({ name = 'goto', description = 'Teleport to a player.', usage = '/goto [player id]', minimumAdminLevel = 1, arguments = { { required = true } }, audit = 'important', handler = function(src, args)
    local target, err = playerOrError(args[1]); if not target then return false, err end
    if src == target.source then return false, 'You are already at yourself.' end
    local destination = entityCoords(target.source); local origin = entityCoords(src)
    if not destination or not origin then return false, 'Player entity is unavailable.' end
    backPositions[src] = origin
    moveRoutingContext(src, destination.bucket)
    if not teleportAuthoritative(src, destination) then return false,'Your entity became unavailable.' end
    audit('goto', src, target, nil, { from = origin, to = destination })
    return ('Teleported to %s (%d).'):format(target.username, target.source)
end })

register({ name = 'bring', description = 'Bring a player to you.', usage = '/bring [player id]', minimumAdminLevel = 2, arguments = { { required = true } }, audit = 'important', handler = function(src, args)
    local target, err = playerOrError(args[1]); if not target then return false, err end
    local allowed, denied = canTarget(src, target, false); if not allowed then return false, denied end
    local destination = entityCoords(src); if not destination then return false, 'Your entity is unavailable.' end
    moveRoutingContext(target.source, destination.bucket)
    if not teleportAuthoritative(target.source, destination) then return false,'Target entity became unavailable.' end
    audit('bring', src, target, nil, { to = destination })
    return ('Brought %s (%d).'):format(target.username, target.source)
end })

register({ name = 'back', description = 'Return to your pre-teleport position.', usage = '/back', minimumAdminLevel = 1, handler = function(src)
    local previous = backPositions[src]; if not previous then return false, 'No saved teleport position.' end
    backPositions[src] = nil; moveRoutingContext(src, previous.bucket); if not teleportAuthoritative(src, previous) then return false,'Your entity became unavailable.' end
    return 'Returned to your previous position.'
end })

register({ name = 'coords', description = 'Show current coordinates.', usage = '/coords', minimumAdminLevel = 1, handler = function(src)
    local position = entityCoords(src); if not position then return false, 'Your entity is unavailable.' end
    return ('x=%.4f y=%.4f z=%.4f heading=%.2f bucket=%d'):format(position.x, position.y, position.z, position.heading, position.bucket)
end })

local function setFrozen(src, args, value)
    local target, err = playerOrError(args[1]); if not target then return false, err end
    local allowed, denied = canTarget(src, target, false); if not allowed then return false, denied end
    frozen[target.source] = value and src or nil
    local ped=GetPlayerPed(target.source); if ped and ped~=0 then local entity=GetVehiclePedIsIn(ped,false); FreezeEntityPosition(entity and entity~=0 and entity or ped,value) end
    TriggerClientEvent('rpg:admin:freeze', target.source, value)
    audit(value and 'freeze' or 'unfreeze', src, target, nil, nil)
    return true, target
end
register({ name = 'freeze', description = 'Freeze a player.', usage = '/freeze [id]', minimumAdminLevel = 2, arguments = { { required = true } }, audit = 'important', handler = function(src,args)
    local ok,target = setFrozen(src,args,true); if not ok then return false,target end return ('Froze %s (%d).'):format(target.username,target.source)
end })
register({ name = 'unfreeze', description = 'Unfreeze a player.', usage = '/unfreeze [id]', minimumAdminLevel = 2, arguments = { { required = true } }, audit = 'important', handler = function(src,args)
    local ok,target = setFrozen(src,args,false); if not ok then return false,target end return ('Unfroze %s (%d).'):format(target.username,target.source)
end })

local function healthCommand(name, minimum, event)
    register({ name = name, description = name .. ' a player.', usage = '/' .. name .. ' [id]', minimumAdminLevel = minimum, arguments = { { required = true } }, handler = function(src,args)
        local target,err=playerOrError(args[1]); if not target then return false,err end
        local allowed,denied=canTarget(src,target,true); if not allowed then return false,denied end
        if name=='heal' then local ped=GetPlayerPed(target.source); if ped and ped~=0 then SetEntityHealth(ped,200); SetPedArmour(ped,100) end end
        TriggerClientEvent(event,target.source); return ('%s applied to %s (%d).'):format(name,target.username,target.source)
    end })
end
healthCommand('heal',2,'rpg:admin:heal')
healthCommand('revive',2,'rpg:admin:revive')
healthCommand('respawn',2,'rpg:spawn:adminRespawn')

register({ name = 'spectate', description = 'Spectate a player or stop spectating.', usage = '/spectate [id|off]', minimumAdminLevel = 2, arguments = { { required = true } }, handler = function(src,args)
    if string.lower(args[1]) == 'off' then
        local saved=spectating[src]; if not saved then return false,'You are not spectating.' end
        spectating[src]=nil; SetPlayerRoutingBucket(src,saved.origin.bucket); TriggerClientEvent('rpg:admin:spectateStop',src,saved.origin)
        return 'Spectate stopped.'
    end
    local target,err=playerOrError(args[1]); if not target then return false,err end
    if target.source==src then return false,'You cannot spectate yourself.' end
    local adminPed=GetPlayerPed(src); if adminPed and adminPed~=0 and GetVehiclePedIsIn(adminPed,false)~=0 then return false,'Exit your vehicle before spectating.' end
    local origin=entityCoords(src); if not origin then return false,'Your entity is unavailable.' end
    spectating[src]={target=target.source,origin=origin}; SetPlayerRoutingBucket(src,GetPlayerRoutingBucket(target.source)); TriggerClientEvent('rpg:admin:spectateStart',src,target.source)
    return ('Spectating %s (%d). Use /spectate off to return.'):format(target.username,target.source)
end })

register({ name = 'warn', description = 'Persist a warning.', usage = '/warn [id] [reason]', minimumAdminLevel = 2, arguments = { { required = true }, { required = true } }, audit = 'important', handler = function(src,args)
    local target,err=playerOrError(args[1]); if not target then return false,err end
    local allowed,denied=canTarget(src,target,false); if not allowed then return false,denied end
    local reason=joinFrom(args,2); if not reason or #reason>500 then return false,'Usage: /warn [id] [reason] (maximum 500 characters)' end
    local id=sanction('warning',src,target,reason,nil); if not id then return false,'Warning could not be saved.' end; TriggerClientEvent('rpg:chat:message',target.source,('Warning #%d: %s'):format(id,reason),'warning')
    return ('Warning #%d issued to %s.'):format(id,target.username)
end })

register({ name = 'history', description = 'Show staff history.', usage = '/history [id]', minimumAdminLevel = 2, arguments = { { required = true } }, handler = function(src,args,reply)
    local target,err=playerOrError(args[1]); if not target then return false,err end
    local rows=MySQL.query.await([[SELECT id,sanction_type,actor_username,reason,created_at,expires_at,revoked_at FROM sanctions WHERE target_account_id=? ORDER BY created_at DESC LIMIT 10]],{target.accountId})
    if #rows==0 then reply(src,'No sanctions for '..target.username..'.','info') else for _,row in ipairs(rows) do reply(src,('#%d %s by %s: %s (%s)'):format(row.id,row.sanction_type,row.actor_username,row.reason,tostring(row.created_at)),'info') end end
    return true
end })

register({ name = 'kick', description = 'Kick a player.', usage = '/kick [id] [reason]', minimumAdminLevel = 2, arguments = { { required = true }, { required = true } }, audit = 'important', handler = function(src,args)
    local target,err=playerOrError(args[1]); if not target then return false,err end
    local allowed,denied=canTarget(src,target,false); if not allowed then return false,denied end
    local reason=joinFrom(args,2); if not reason or #reason>500 then return false,'Usage: /kick [id] [reason]' end
    local id=sanction('kick',src,target,reason,nil); if not id then return false,'Kick audit could not be saved.' end; exports.rpg_core:SavePlayer(target.source,'admin_kick'); DropPlayer(target.source,'Kicked: '..reason)
    return ('Kicked %s (%d).'):format(target.username,target.source)
end })

local function banHandler(src,args)
    local target,err=playerOrError(args[1]); if not target then return false,err end
    local allowed,denied=canTarget(src,target,false); if not allowed then return false,denied end
    local seconds,label=parseDuration(string.lower(args[2] or '')); if seconds==false then return false,label end
    local reason=joinFrom(args,3); if not reason or #reason>500 then return false,'Usage: /ban [id] [duration|perm] [reason]' end
    local expires=seconds and os.date('!%Y-%m-%d %H:%M:%S',os.time()+seconds) or nil
    local id=sanction('ban',src,target,reason,expires); if not id then return false,'Ban could not be saved.' end; exports.rpg_core:SavePlayer(target.source,'admin_ban'); DropPlayer(target.source,('Banned (%s): %s'):format(label,reason))
    return ('Ban #%d applied to %s (%s).'):format(id,target.username,label)
end
register({ name='ban',aliases={'tempban'},description='Ban a player.',usage='/ban [id] [duration|perm] [reason]',minimumAdminLevel=3,arguments={{required=true},{required=true},{required=true}},audit='important',handler=banHandler })

register({ name='unban',description='Revoke an active ban.',usage='/unban [ban id|username] [reason]',minimumAdminLevel=3,arguments={{required=true}},audit='important',handler=function(src,args)
    local needle=args[1]; local row
    if tonumber(needle) then row=MySQL.single.await([[SELECT * FROM sanctions WHERE id=? AND sanction_type='ban' AND revoked_at IS NULL]],{tonumber(needle)})
    else row=MySQL.single.await([[SELECT * FROM sanctions WHERE LOWER(target_username)=? AND sanction_type='ban' AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1]],{string.lower(needle)}) end
    if not row then return false,'No active ban matched.' end
    local actor=exports.rpg_core:GetPlayer(src); local reason=joinFrom(args,2) or 'Unbanned by staff'
    local committed=MySQL.startTransaction(function(query)
        local updated=query('UPDATE sanctions SET revoked_at=UTC_TIMESTAMP(6), revoked_by_account_id=?, revoke_reason=? WHERE id=? AND revoked_at IS NULL',{actor.accountId,reason,row.id})
        if not updated or updated.affectedRows~=1 then return false end
        query([[INSERT INTO admin_actions (action,actor_account_id,actor_username,target_account_id,target_username,reason,metadata) VALUES ('unban',?,?,?,?,?,?)]],{actor.accountId,actor.username,row.target_account_id,row.target_username,reason,json.encode({sanctionId=row.id})})
        return true
    end)
    if not committed then return false,'Ban could not be revoked and audited.' end
    return ('Ban #%d for %s revoked.'):format(row.id,row.target_username)
end })

register({ name='announce',description='Broadcast a server announcement.',usage='/announce [message]',minimumAdminLevel=3,arguments={{required=true}},handler=function(src,args)
    local message=joinFrom(args,1); if not message or #message>280 then return false,'Usage: /announce [message] (maximum 280 characters)' end
    for _,raw in ipairs(GetPlayers()) do TriggerClientEvent('rpg:chat:message',tonumber(raw),'[ANNOUNCEMENT] '..message,'admin') end
    return 'Announcement sent.'
end })

register({ name='cc',description='Clear chat for everyone.',usage='/cc',minimumAdminLevel=2,handler=function()
    for _,raw in ipairs(GetPlayers()) do TriggerClientEvent('rpg:chat:clear',tonumber(raw)) end return 'Chat cleared.'
end })

register({ name='setadmin',description='Set a player admin level.',usage='/setadmin [id] [0-5]',minimumAdminLevel=5,arguments={{required=true},{required=true}},audit='important',handler=function(src,args)
    local target,err=playerOrError(args[1]); if not target then return false,err end
    if target.source==src then return false,'You cannot change your own admin level.' end
    local level=tonumber(args[2]); if not level or level%1~=0 or level<0 or level>5 then return false,'Usage: /setadmin [id] [0-5]' end
    if not setAdminLevelAudited(src,target,level,('Set level %d'):format(level)) then return false,'Admin level could not be saved and audited.' end
    TriggerClientEvent('rpg:chat:message',target.source,('Your admin level is now %s (%d).'):format(labels[level],level),'admin')
    return ('%s is now %s (%d).'):format(target.username,labels[level],level)
end })

register({ name='serverstats',description='Show live server health.',usage='/serverstats',minimumAdminLevel=1,handler=function(src,_,reply)
    local started=GetGameTimer(); local accounts=MySQL.scalar.await('SELECT COUNT(*) FROM accounts'); local today=MySQL.scalar.await('SELECT COUNT(*) FROM accounts WHERE created_at>=UTC_DATE()'); local active=MySQL.scalar.await('SELECT COUNT(*) FROM sessions WHERE ended_at IS NULL'); local latency=GetGameTimer()-started
    local health=exports.rpg_core:GetHealthSnapshot(); local runtime=exports.rpg_core:GetRuntimeStats()
    reply(src,('Online %d | Peak %d | Uptime %ds | Authenticated %d | Active players %d | Registered %d | Today %d | DB sessions %d | DB %dms | Core %s'):format(#GetPlayers(),runtime.peakPlayers,runtime.uptimeSeconds,health.authenticated,health.active,accounts,today,active,latency,GetResourceState('rpg_core')),'info')
    return true
end })

RegisterCommand('rpg_setowner',function(source,args)
    if source~=0 then print('[RPG][ADMIN] rpg_setowner is console-only') return end
    local username=table.concat(args,' '):match('^%s*(.-)%s*$')
    if not username or username=='' then print('[RPG][ADMIN] Usage: rpg_setowner <username>') return end
    local row=MySQL.single.await('SELECT id,username,admin_level FROM accounts WHERE username_normalized=? LIMIT 1',{string.lower(username)})
    if not row then print('[RPG][ADMIN] Account not found: '..username) return end
    local target={accountId=row.id,username=row.username,adminLevel=tonumber(row.admin_level) or 0}
    if not setAdminLevelAudited(0,target,5,'Console bootstrap owner') then print('[RPG][ADMIN] Failed to save and audit owner level') return end
    print(('[RPG][ADMIN] %s (account %d) is now Owner'):format(row.username,row.id))
end,true)

AddEventHandler('playerConnecting',function(_,_,deferrals)
    local src=source; deferrals.defer(); Wait(0); deferrals.update('Checking account security...')
    local ok,banned=pcall(function()
        local result
        for _,raw in ipairs(GetPlayerIdentifiers(src)) do
            local kind,value=raw:match('^([^:]+):(.+)$')
            if kind and value then
                result=MySQL.single.await([[SELECT s.id,s.reason,s.expires_at FROM sanctions s JOIN sanction_identifiers si ON si.sanction_id=s.id WHERE si.identifier_type=? AND si.identifier_value=? AND s.sanction_type='ban' AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>UTC_TIMESTAMP(6)) LIMIT 1]],{kind,value})
                if result then break end
            end
        end
        return result
    end)
    if not ok then
        print(('[RPG][ERROR] Ban check failed for source %d; connection denied safely'):format(src))
        deferrals.done('The account security service is unavailable. Please try again shortly.')
    elseif banned then deferrals.done(('Connection denied. Active ban #%d: %s'):format(banned.id,banned.reason)) else deferrals.done() end
end)

local function stopSpectatingAdmin(admin, message)
    local saved=spectating[admin]; if not saved then return end
    spectating[admin]=nil; SetPlayerRoutingBucket(admin,saved.origin.bucket); TriggerClientEvent('rpg:admin:spectateStop',admin,saved.origin)
    if message then exports.rpg_core:Notify(admin,message,'warning') end
end

RegisterNetEvent('rpg:admin:spectateFailed',function()
    local src=source
    if spectating[src] then stopSpectatingAdmin(src,'Spectate target could not be streamed.') end
end)

AddEventHandler('playerDropped',function()
    local src=source; duty[src]=nil; backPositions[src]=nil; frozen[src]=nil; spectating[src]=nil
    for target,actor in pairs(frozen) do if actor==src then frozen[target]=nil; local ped=GetPlayerPed(target); if ped and ped~=0 then FreezeEntityPosition(ped,false) end; TriggerClientEvent('rpg:admin:freeze',target,false) end end
    for admin,state in pairs(spectating) do if state.target==src then stopSpectatingAdmin(admin,'Spectate ended because the target disconnected.') end end
end)

AddEventHandler('onResourceStop',function(resource)
    if resource~=GetCurrentResourceName() then return end
    for target in pairs(frozen) do local ped=GetPlayerPed(target); if ped and ped~=0 then FreezeEntityPosition(ped,false) end; TriggerClientEvent('rpg:admin:freeze',target,false) end
    for admin in pairs(spectating) do stopSpectatingAdmin(admin) end
end)
