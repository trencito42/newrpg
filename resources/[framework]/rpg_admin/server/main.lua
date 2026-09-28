local duty = {}
local backPositions = {}
local frozen = {}
local spectating = {}
local helperGotoCooldown = {}

local labels = { [0] = 'Player', [1] = 'Admin Level 1', [2] = 'Admin Level 2', [3] = 'Admin Level 3', [4] = 'Admin Level 4', [5] = 'Admin Level 5', [6] = 'Admin Level 6' }
local helperLabels = { [0] = 'Player', [1] = 'Helper Level 1', [2] = 'Helper Level 2', [3] = 'Helper Level 3' }

RPGAdmin = RPGAdmin or {}
RPGAdmin.adminDuty = duty
RPGAdmin.helperDuty = RPGAdmin.helperDuty or {}

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
        local identifierCount = 0
        if kind == 'ban' or kind == 'ip_ban' then
            for _, raw in ipairs(GetPlayerIdentifiers(target.source)) do
                local identifierType, identifierValue = raw:match('^([^:]+):(.+)$')
                local wanted = kind == 'ip_ban' and identifierType == 'ip' or kind == 'ban' and identifierType ~= 'ip'
                if identifierType and identifierValue and wanted then
                    query('INSERT INTO sanction_identifiers (sanction_id, identifier_type, identifier_value) VALUES (?, ?, ?)', { id, identifierType, identifierValue })
                    identifierCount = identifierCount + 1
                end
            end
        end
        if kind == 'ip_ban' and identifierCount == 0 then return false end
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
    if duty[src] then
        for _, row in ipairs(MySQL.query.await("SELECT id,reporter_username,reporter_source,message FROM player_reports WHERE status='open' ORDER BY created_at LIMIT 20")) do
            TriggerClientEvent('rpg:chat:message', src, ('[REPORT #%d] %s (%d): %s'):format(row.id,row.reporter_username,row.reporter_source,row.message), 'admin')
        end
        for _, row in ipairs(MySQL.query.await("SELECT id,asker_username,asker_source,question FROM newbie_questions WHERE status='open' ORDER BY created_at LIMIT 20")) do
            TriggerClientEvent('rpg:chat:message', src, ('[NEWBIE #%d] %s (%d): %s'):format(row.id,row.asker_username,row.asker_source,row.question), 'helper')
        end
    end
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
        local helperLevel = exports.rpg_core:GetHelperLevel(target)
        if level >= 1 then
            list[#list + 1] = ('%s (%d) — %s%s'):format(exports.rpg_core:GetUsername(target) or '?', target, labels[level], duty[target] and ' [DUTY]' or '')
        elseif helperLevel >= 1 then
            list[#list + 1] = ('%s (%d) — %s%s'):format(exports.rpg_core:GetUsername(target) or '?', target, helperLabels[helperLevel], RPGAdmin.helperDuty[target] and ' [DUTY]' or '')
        end
    end
    reply(src, #list > 0 and table.concat(list, ' | ') or 'No staff are online.', 'info')
    return true
end })

register({ name = 'ainfo', aliases = {'check'}, description = 'Inspect framework player information.', usage = '/check [id]', minimumAdminLevel = 1, arguments = { { required = true } }, handler = function(src, args, reply)
    local target, err = playerOrError(args[1]); if not target then return false, err end
    local full = MySQL.single.await([[SELECT a.email, a.login_count, p.* FROM accounts a JOIN players p ON p.account_id=a.id WHERE a.id=?]], { target.accountId })
    local coords = entityCoords(target.source)
    local stats = exports.rpg_core:GetPlayerStats(target.source)
    local email = exports.rpg_core:GetAdminLevel(src) >= 4 and full.email or '[restricted]'
    reply(src, ('ID %d | Account %d | %s | Email %s | %s/%s | L%d XP%d | Playtime %ds | Admin %s | Helper %d | Tutorial %s | Ping %d | HP %d Armor %d | XYZ %.2f %.2f %.2f'):format(
        target.source, target.accountId, target.username, email, target.sex, target.model, target.level, target.xp,
        stats.totalPlaytimeSeconds, labels[target.adminLevel], target.helperLevel, tostring(target.tutorialCompleted), GetPlayerPing(target.source),
        target.health, target.armor, coords and coords.x or 0, coords and coords.y or 0, coords and coords.z or 0
    ), 'info')
    return true
end })

register({ name = 'goto', description = 'Teleport to a player.', usage = '/goto [player id]', minimumAdminLevel = 1, minimumHelperLevel = 1, arguments = { { required = true } }, audit = 'important', handler = function(src, args)
    local isHelperOnly = exports.rpg_core:GetAdminLevel(src) == 0
    if isHelperOnly then
        local now = os.time()
        local availableAt = helperGotoCooldown[src] or 0
        if now < availableAt then return false, ('Helper /goto is available in %d seconds.'):format(availableAt - now) end
    end
    local target, err = playerOrError(args[1]); if not target then return false, err end
    if src == target.source then return false, 'You are already at yourself.' end
    local destination = entityCoords(target.source); local origin = entityCoords(src)
    if not destination or not origin then return false, 'Player entity is unavailable.' end
    backPositions[src] = origin
    moveRoutingContext(src, destination.bucket)
    if not teleportAuthoritative(src, destination) then return false, 'Your entity became unavailable.' end
    
    -- Consume cooldown ONLY on successful teleport!
    if isHelperOnly then
        helperGotoCooldown[src] = os.time() + 180
    end

    audit('goto', src, target, nil, { from = origin, to = destination })
    return ('Teleported to %s (%d).'):format(target.username, target.source)
end })

register({ name = 'bring', aliases = {'gethere'}, description = 'Bring a player to you.', usage = '/gethere [player id]', minimumAdminLevel = 2, arguments = { { required = true } }, audit = 'important', handler = function(src, args)
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

register({ name = 'heal', description = 'Heal a player.', usage = '/heal [id]', minimumAdminLevel = 2, arguments = { { required = true } }, handler = function(src, args)
    local target, err = playerOrError(args[1]); if not target then return false, err end
    local allowed, denied = canTarget(src, target, true); if not allowed then return false, denied end
    local ped = GetPlayerPed(target.source)
    if ped and ped ~= 0 then SetEntityHealth(ped, 200); SetPedArmour(ped, 100) end
    TriggerClientEvent('rpg:admin:heal', target.source)
    return ('Heal applied to %s (%d).'):format(target.username, target.source)
end })

register({ name = 'revive', description = 'Revive a player.', usage = '/revive [id]', minimumAdminLevel = 2, arguments = { { required = true } }, handler = function(src, args)
    local target, err = playerOrError(args[1]); if not target then return false, err end
    local allowed, denied = canTarget(src, target, true); if not allowed then return false, denied end
    TriggerClientEvent('rpg:admin:revive', target.source)
    return ('Revive applied to %s (%d).'):format(target.username, target.source)
end })

register({ name = 'respawn', description = 'Respawn a player at hospital.', usage = '/respawn [id]', minimumAdminLevel = 2, arguments = { { required = true } }, handler = function(src, args)
    local target, err = playerOrError(args[1]); if not target then return false, err end
    local allowed, denied = canTarget(src, target, true); if not allowed then return false, denied end
    local token = exports.rpg_spawn:IssueSpawnEntitlement(target.source, 'admin_respawn')
    TriggerClientEvent('rpg:spawn:adminRespawn', target.source, token)
    return ('Respawn entitlement issued to %s (%d).'):format(target.username, target.source)
end })

register({ name = 'spectate', aliases = {'spec'}, description = 'Spectate a player or stop spectating.', usage = '/spec [id|off]', minimumAdminLevel = 2, arguments = { { required = true } }, handler = function(src,args)
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
    
    -- Only count active, unconsumed, unrevoked warnings
    local warningCount=tonumber(MySQL.scalar.await([[
        SELECT COUNT(*) FROM sanctions
        WHERE target_account_id=? AND sanction_type='warning' AND revoked_at IS NULL AND consumed_by_sanction_id IS NULL
    ]],{target.accountId})) or 0
    
    if warningCount >= 3 then
        local banId=sanction('ban',src,target,'Automatic account ban: 3/3 warnings',nil)
        if not banId then return false,'Warning saved, but automatic ban could not be persisted.' end
        
        -- Resolve/consume the contributing warnings so they do not retrigger bans upon future unbans
        MySQL.update.await([[
            UPDATE sanctions SET consumed_by_sanction_id = ?, resolved_at = UTC_TIMESTAMP(6)
            WHERE target_account_id = ? AND sanction_type = 'warning' AND revoked_at IS NULL AND consumed_by_sanction_id IS NULL
        ]], { banId, target.accountId })

        local saveOk, saveErr = exports.rpg_core:SavePlayer(target.source,'three_warnings_ban')
        if not saveOk then
            print(('[RPG][ERROR] Failed to save player before 3-warning drop: %s'):format(tostring(saveErr)))
        end
        DropPlayer(target.source,'Banned permanently: 3/3 warnings.')
        return ('Warning #%d issued; %s reached 3/3 and received permanent ban #%d.'):format(id,target.username,banId)
    end
    return ('Warning #%d issued to %s (%d/3 active warnings).'):format(id,target.username,warningCount)
end })

register({ name = 'history', description = 'Show staff history.', usage = '/history [id]', minimumAdminLevel = 2, arguments = { { required = true } }, handler = function(src,args,reply)
    local target,err=playerOrError(args[1]); if not target then return false,err end
    local rows=MySQL.query.await([[
        SELECT id, sanction_type, actor_username, reason, created_at, expires_at, revoked_at, consumed_by_sanction_id, resolved_at
        FROM sanctions WHERE target_account_id=? ORDER BY created_at DESC LIMIT 10
    ]],{target.accountId})
    if #rows==0 then reply(src,'No sanctions for '..target.username..'.','info')
    else
        for _,row in ipairs(rows) do
            local status = row.revoked_at and ' [REVOKED]' or (row.consumed_by_sanction_id and (' [CONSUMED BY BAN #%d]'):format(row.consumed_by_sanction_id) or '')
            reply(src,('#%d %s by %s: %s (%s)%s'):format(row.id,row.sanction_type,row.actor_username,row.reason,tostring(row.created_at), status),'info')
        end
    end
    return true
end })

register({ name = 'kick', description = 'Kick a player.', usage = '/kick [id] [reason]', minimumAdminLevel = 2, arguments = { { required = true }, { required = true } }, audit = 'important', handler = function(src,args)
    local target,err=playerOrError(args[1]); if not target then return false,err end
    local allowed,denied=canTarget(src,target,false); if not allowed then return false,denied end
    local reason=joinFrom(args,2); if not reason or #reason>500 then return false,'Usage: /kick [id] [reason]' end
    local id=sanction('kick',src,target,reason,nil); if not id then return false,'Kick audit could not be saved.' end
    local saveOk, saveErr = exports.rpg_core:SavePlayer(target.source,'admin_kick')
    if not saveOk then
        print(('[RPG][ERROR] Failed to save player before kick: %s'):format(tostring(saveErr)))
    end
    DropPlayer(target.source,'Kicked: '..reason)
    return ('Kicked %s (%d).'):format(target.username,target.source)
end })

local function banHandler(src,args)
    local target,err=playerOrError(args[1]); if not target then return false,err end
    local allowed,denied=canTarget(src,target,false); if not allowed then return false,denied end
    local seconds,label=parseDuration(string.lower(args[2] or '')); if seconds==false then return false,label end
    local reason=joinFrom(args,3); if not reason or #reason>500 then return false,'Usage: /ban [id] [duration|perm] [reason]' end
    local expires=seconds and os.date('!%Y-%m-%d %H:%M:%S',os.time()+seconds) or nil
    local id=sanction('ban',src,target,reason,expires); if not id then return false,'Ban could not be saved.' end
    local saveOk, saveErr = exports.rpg_core:SavePlayer(target.source,'admin_ban')
    if not saveOk then
        print(('[RPG][ERROR] Failed to save player before ban: %s'):format(tostring(saveErr)))
    end
    DropPlayer(target.source,('Banned (%s): %s'):format(label,reason))
    return ('Ban #%d applied to %s (%s).'):format(id,target.username,label)
end
register({ name='ban',aliases={'tempban'},description='Ban a player.',usage='/ban [id] [duration|perm] [reason]',minimumAdminLevel=3,arguments={{required=true},{required=true},{required=true}},audit='important',handler=banHandler })

register({ name='banip',description='Permanently ban a current IP.',usage='/banip [id] [reason]',minimumAdminLevel=4,arguments={{required=true},{required=true}},audit='important',handler=function(src,args)
    local target,err=playerOrError(args[1]); if not target then return false,err end
    local allowed,denied=canTarget(src,target,false); if not allowed then return false,denied end
    local reason=joinFrom(args,2); if not reason or #reason>500 then return false,'Usage: /banip [id] [reason]' end
    local id=sanction('ip_ban',src,target,reason,nil); if not id then return false,'IP ban could not be saved.' end
    local saveOk, saveErr = exports.rpg_core:SavePlayer(target.source,'admin_ip_ban')
    if not saveOk then
        print(('[RPG][ERROR] Failed to save player before IP ban: %s'):format(tostring(saveErr)))
    end
    DropPlayer(target.source,'IP banned permanently: '..reason)
    return ('IP ban #%d applied to %s.'):format(id,target.username)
end })

register({ name='unban',description='Revoke an active ban.',usage='/unban [ban id|username] [reason]',minimumAdminLevel=3,arguments={{required=true}},audit='important',handler=function(src,args)
    local needle=args[1]; local row
    if tonumber(needle) then row=MySQL.single.await([[SELECT * FROM sanctions WHERE id=? AND sanction_type IN ('ban','ip_ban') AND revoked_at IS NULL]],{tonumber(needle)})
    else row=MySQL.single.await([[SELECT * FROM sanctions WHERE LOWER(target_username)=? AND sanction_type IN ('ban','ip_ban') AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1]],{string.lower(needle)}) end
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

register({ name='announce',aliases={'anno'},description='Broadcast a server announcement.',usage='/anno [message]',minimumAdminLevel=3,arguments={{required=true}},handler=function(src,args)
    local message=joinFrom(args,1); if not message or #message>280 then return false,'Usage: /announce [message] (maximum 280 characters)' end
    local username=exports.rpg_core:GetUsername(src) or 'CONSOLE'
    for _,raw in ipairs(GetPlayers()) do TriggerClientEvent('rpg:chat:message',tonumber(raw),('ANNOUNCEMENT %s (%d): %s'):format(username,src,message),'admin') end
    return 'Announcement sent.'
end })

register({ name='cc',description='Clear chat for everyone.',usage='/cc',minimumAdminLevel=2,handler=function()
    for _,raw in ipairs(GetPlayers()) do TriggerClientEvent('rpg:chat:clear',tonumber(raw)) end return 'Chat cleared.'
end })

register({ name='setadmin',description='Set a player admin level.',usage='/setadmin [id] [0-6]',minimumAdminLevel=6,arguments={{required=true},{required=true}},audit='important',handler=function(src,args)
    local target,err=playerOrError(args[1]); if not target then return false,err end
    if target.source==src then return false,'You cannot change your own admin level.' end
    local level=tonumber(args[2]); if not level or level%1~=0 or level<0 or level>6 then return false,'Usage: /setadmin [id] [0-6]' end
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

register({ name='commands',aliases={'allcommands','servercommands'},description='List all registered server commands grouped by permission tier.',usage='/commands',minimumAdminLevel=1,minimumHelperLevel=1,consoleAllowed=true,handler=function(src,_,reply)
    local allDefs=exports.rpg_core:GetCommandDefinitions()
    local tierPlayer, tierHelper, tierAdmin12, tierAdmin34, tierAdmin56 = {}, {}, {}, {}, {}

    for _, def in ipairs(allDefs) do
        local item = '/' .. def.name
        if def.minimumAdminLevel and def.minimumAdminLevel >= 5 then
            tierAdmin56[#tierAdmin56 + 1] = item
        elseif def.minimumAdminLevel and def.minimumAdminLevel >= 3 then
            tierAdmin34[#tierAdmin34 + 1] = item
        elseif def.minimumAdminLevel and def.minimumAdminLevel >= 1 then
            tierAdmin12[#tierAdmin12 + 1] = item
        elseif def.minimumHelperLevel then
            tierHelper[#tierHelper + 1] = item .. ('(H%d)'):format(def.minimumHelperLevel)
        else
            tierPlayer[#tierPlayer + 1] = item
        end
    end

    reply(src, ('=== ALL SERVER COMMANDS (%d Registered) ==='):format(#allDefs), 'info')
    if #tierPlayer > 0 then
        reply(src, '[Player (L0)] ' .. table.concat(tierPlayer, ', '), 'info')
    end
    if #tierHelper > 0 then
        reply(src, '[Helper (H1-H3)] ' .. table.concat(tierHelper, ', '), 'helper')
    end
    if #tierAdmin12 > 0 then
        reply(src, '[Admin L1-L2] ' .. table.concat(tierAdmin12, ', '), 'admin')
    end
    if #tierAdmin34 > 0 then
        reply(src, '[Admin L3-L4] ' .. table.concat(tierAdmin34, ', '), 'admin')
    end
    if #tierAdmin56 > 0 then
        reply(src, '[Admin L5-L6 (Mgmt)] ' .. table.concat(tierAdmin56, ', '), 'admin')
    end
    reply(src, 'Use /help <command> for syntax details.', 'system')
    return true
end })

RegisterCommand('rpg_setowner',function(source,args)
    if source~=0 then print('[RPG][ADMIN] rpg_setowner is console-only') return end
    local username=table.concat(args,' '):match('^%s*(.-)%s*$')
    if not username or username=='' then print('[RPG][ADMIN] Usage: rpg_setowner <username>') return end
    local row=MySQL.single.await('SELECT id,username,admin_level FROM accounts WHERE username_normalized=? LIMIT 1',{string.lower(username)})
    if not row then print('[RPG][ADMIN] Account not found: '..username) return end
    local target={accountId=row.id,username=row.username,adminLevel=tonumber(row.admin_level) or 0}
    if not setAdminLevelAudited(0,target,6,'Console bootstrap owner') then print('[RPG][ADMIN] Failed to save and audit owner level') return end
    print(('[RPG][ADMIN] %s (account %d) is now Admin Level 6'):format(row.username,row.id))
end,true)

AddEventHandler('playerConnecting',function(_,_,deferrals)
    local src=source; deferrals.defer(); Wait(0); deferrals.update('Checking account security...')
    local ok,banned=pcall(function()
        local result
        for _,raw in ipairs(GetPlayerIdentifiers(src)) do
            local kind,value=raw:match('^([^:]+):(.+)$')
            if kind and value then
                result=MySQL.single.await([[SELECT s.id,s.reason,s.expires_at FROM sanctions s JOIN sanction_identifiers si ON si.sanction_id=s.id WHERE si.identifier_type=? AND si.identifier_value=? AND ((s.sanction_type='ban' AND ?<>'ip') OR (s.sanction_type='ip_ban' AND ?='ip')) AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>UTC_TIMESTAMP(6)) LIMIT 1]],{kind,value,kind,kind})
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
    local src=source; duty[src]=nil; RPGAdmin.helperDuty[src]=nil; helperGotoCooldown[src]=nil; backPositions[src]=nil; frozen[src]=nil; spectating[src]=nil
    for target,actor in pairs(frozen) do if actor==src then frozen[target]=nil; local ped=GetPlayerPed(target); if ped and ped~=0 then FreezeEntityPosition(ped,false) end; TriggerClientEvent('rpg:admin:freeze',target,false) end end
    for admin,state in pairs(spectating) do if state.target==src then stopSpectatingAdmin(admin,'Spectate ended because the target disconnected.') end end
end)

AddEventHandler('onResourceStop',function(resource)
    if resource~=GetCurrentResourceName() then return end
    for target in pairs(frozen) do local ped=GetPlayerPed(target); if ped and ped~=0 then FreezeEntityPosition(ped,false) end; TriggerClientEvent('rpg:admin:freeze',target,false) end
    for admin in pairs(spectating) do stopSpectatingAdmin(admin) end
end)
