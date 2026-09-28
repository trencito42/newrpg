local marks, sleeping, spawnedVehicles = {}, {}, {}
local weapons = {
    pistol = 'WEAPON_PISTOL', combatpistol = 'WEAPON_COMBATPISTOL', stun = 'WEAPON_STUNGUN',
    smg = 'WEAPON_SMG', carbine = 'WEAPON_CARBINERIFLE', shotgun = 'WEAPON_PUMPSHOTGUN',
    bat = 'WEAPON_BAT', knife = 'WEAPON_KNIFE', flashlight = 'WEAPON_FLASHLIGHT',
}

local function register(definition) exports.rpg_core:RegisterCommand(definition) end
local function trim(value) return tostring(value or ''):match('^%s*(.-)%s*$') or '' end
local function join(args, first, last)
    local values = {}
    for i = first, last or #args do values[#values + 1] = args[i] end
    local value = trim(table.concat(values, ' '))
    return value ~= '' and value or nil
end
local function player(id)
    local src = tonumber(id)
    if not src or not GetPlayerName(src) then return nil, ('Player #%s is not online.'):format(tostring(id or '?')) end
    local value = exports.rpg_core:GetPlayer(src)
    if not value then return nil, ('Player #%d is not authenticated.'):format(src) end
    return value
end
local function canAct(actor, target, allowSelf)
    if actor == 0 then return true end
    if actor == target.source then return allowSelf == true, allowSelf and nil or 'You cannot target yourself.' end
    local actorAdmin, actorHelper = exports.rpg_core:GetAdminLevel(actor), exports.rpg_core:GetHelperLevel(actor)
    local targetAdmin, targetHelper = target.adminLevel or 0, target.helperLevel or 0
    if actorAdmin > 0 then
        if targetAdmin >= actorAdmin then return false, 'You cannot target an admin of equal or higher level.' end
        return true
    end
    if targetAdmin > 0 or targetHelper >= actorHelper then return false, 'You cannot target staff of equal or higher level.' end
    return true
end
local function position(src)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return nil end
    local coords = GetEntityCoords(ped)
    return { x = coords.x, y = coords.y, z = coords.z, heading = GetEntityHeading(ped), bucket = GetPlayerRoutingBucket(src) }
end
local function message(src, text, kind) TriggerClientEvent('rpg:chat:message', src, text, kind or 'system') end
local function notify(src, text, kind) exports.rpg_core:Notify(src, text, kind or 'info') end
local function action(name, actor, target, reason, metadata)
    local actorPlayer = actor ~= 0 and exports.rpg_core:GetPlayer(actor) or nil
    MySQL.insert.await([[INSERT INTO admin_actions
        (action,actor_account_id,actor_username,target_account_id,target_username,reason,metadata)
        VALUES (?,?,?,?,?,?,?)]], {
        name, actorPlayer and actorPlayer.accountId or nil, actorPlayer and actorPlayer.username or 'CONSOLE',
        target and target.accountId or nil, target and target.username or nil, reason,
        metadata and json.encode(metadata) or nil,
    })
end
local function staffName(src)
    local value = exports.rpg_core:GetPlayer(src)
    return value and value.username or 'CONSOLE'
end
local function eachOnline(callback)
    for _, raw in ipairs(GetPlayers()) do local src = tonumber(raw); if src then callback(src) end end
end
local function activeMute(src, channel)
    local accountId = exports.rpg_core:GetAccountId(src)
    if not accountId then return nil end
    local kind = channel == 'newbie' and 'newbie_mute' or 'mute'
    return MySQL.single.await([[SELECT id,reason,TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(6),expires_at) remaining
        FROM sanctions WHERE target_account_id=? AND sanction_type=? AND revoked_at IS NULL
        AND expires_at>UTC_TIMESTAMP(6) ORDER BY expires_at DESC LIMIT 1]], { accountId, kind })
end

exports('IsMuted', function(src, channel) return activeMute(tonumber(src), channel or 'global') ~= nil end)

register({ name='hduty',description='Toggle helper duty.',usage='/hduty',minimumAdminLevel=1,minimumHelperLevel=1,handler=function(src)
    RPGAdmin.helperDuty[src]=not RPGAdmin.helperDuty[src]
    Player(src).state:set('rpg:helperDuty',RPGAdmin.helperDuty[src],true)
    if RPGAdmin.helperDuty[src] then
        for _,row in ipairs(MySQL.query.await("SELECT id,asker_username,asker_source,question FROM newbie_questions WHERE status='open' ORDER BY created_at LIMIT 20")) do
            message(src,('[NEWBIE #%d] %s (%d): %s'):format(row.id,row.asker_username,row.asker_source,row.question),'helper')
        end
    end
    return RPGAdmin.helperDuty[src] and 'Helper duty enabled.' or 'Helper duty disabled.'
end })

register({ name='e',description='Admin and helper chat.',usage='/e [message]',minimumAdminLevel=1,minimumHelperLevel=1,arguments={{required=true}},handler=function(src,args)
    local text=join(args,1); if not text or #text>280 then return false,'Usage: /e [message]' end
    local rendered=('[STAFF] %s (%d): %s'):format(staffName(src),src,text)
    eachOnline(function(target) if exports.rpg_core:GetAdminLevel(target)>0 or exports.rpg_core:GetHelperLevel(target)>0 then message(target,rendered,'helper') end end)
    return true
end })

register({ name='lc',description='Faction leader chat.',usage='/lc [message]',arguments={{required=true}},handler=function(src,args)
    local staff=exports.rpg_core:GetAdminLevel(src)>0
    local profile=exports.rpg_core:GetPlayer(src)
    local leader=profile and MySQL.scalar.await('SELECT faction_leader FROM players WHERE account_id=?',{profile.accountId})
    if not staff and tonumber(leader)~=1 then return false,'Only faction leaders and admins can use /lc.' end
    local text=join(args,1); if not text or #text>280 then return false,'Usage: /lc [message]' end
    local rendered=('[LEADERS] %s (%d): %s'):format(staffName(src),src,text)
    eachOnline(function(target)
        local targetProfile=exports.rpg_core:GetPlayer(target)
        local isLeader=targetProfile and tonumber(MySQL.scalar.await('SELECT faction_leader FROM players WHERE account_id=?',{targetProfile.accountId}))==1
        if exports.rpg_core:GetAdminLevel(target)>0 or isLeader then message(target,rendered,'helper') end
    end)
    return true
end })

register({ name='pm',description='Send a staff private message.',usage='/pm [id] [message]',minimumAdminLevel=1,minimumHelperLevel=1,arguments={{required=true},{required=true}},handler=function(src,args)
    local target,err=player(args[1]); if not target then return false,err end
    local text=join(args,2); if not text or #text>280 then return false,'Usage: /pm [id] [message]' end
    local rendered=('Admin %s (%d): %s'):format(staffName(src),src,text)
    message(target.source,rendered,'private'); message(src,('PM to %s (%d): %s'):format(target.username,target.source,text),'private')
    return true
end })

register({ name='report',description='Send a report to on-duty admins.',usage='/report [message]',arguments={{required=true}},handler=function(src,args)
    local profile=exports.rpg_core:GetPlayer(src); if not profile then return false,'Authenticate first.' end
    local text=join(args,1); if not text or #text>500 then return false,'Usage: /report [message] (maximum 500 characters)' end
    local existing=MySQL.scalar.await("SELECT id FROM player_reports WHERE reporter_account_id=? AND status='open' LIMIT 1",{profile.accountId})
    if existing then return false,('You already have open report #%d.'):format(existing) end
    local id=MySQL.insert.await('INSERT INTO player_reports (reporter_account_id,open_reporter_account_id,reporter_username,reporter_source,message) VALUES (?,?,?,?,?)',{profile.accountId,profile.accountId,profile.username,src,text})
    eachOnline(function(target) if exports.rpg_core:GetAdminLevel(target)>0 and RPGAdmin.adminDuty[target] then message(target,('[REPORT #%d] %s (%d): %s'):format(id,profile.username,src,text),'admin') end end)
    return ('Report #%d sent.'):format(id)
end })

register({ name='cr',description='Close a player report.',usage='/cr [report id] [reason]',minimumAdminLevel=1,arguments={{required=true}},handler=function(src,args)
    local id=tonumber(args[1]); if not id then return false,'Usage: /cr [report id] [reason]' end
    local staff=exports.rpg_core:GetPlayer(src); local reason=join(args,2) or 'Resolved'
    local row=MySQL.single.await("SELECT * FROM player_reports WHERE id=? AND status='open'",{id}); if not row then return false,'Open report not found.' end
    local changed=MySQL.update.await("UPDATE player_reports SET status='closed',open_reporter_account_id=NULL,closed_by_account_id=?,closed_by_username=?,close_reason=?,closed_at=UTC_TIMESTAMP(6) WHERE id=? AND status='open'",{staff.accountId,staff.username,reason,id})
    if changed~=1 then return false,'Report was already handled.' end
    local current=exports.rpg_core:GetPlayer(row.reporter_source)
    if current and current.accountId==tonumber(row.reporter_account_id) then notify(row.reporter_source,('Your report #%d was closed by %s: %s'):format(id,staff.username,reason),'success') end
    action('close_report',src,{accountId=row.reporter_account_id,username=row.reporter_username},reason,{reportId=id})
    return ('Report #%d closed.'):format(id)
end })

local function submitQuestion(src,args)
    local profile=exports.rpg_core:GetPlayer(src); if not profile then return false,'Authenticate first.' end
    local mute=activeMute(src,'newbie'); if mute then return false,('You are muted from asking questions for %d more minute(s).'):format(math.max(1,math.ceil((tonumber(mute.remaining) or 0)/60))) end
    local text=join(args,1); if not text or #text>500 then return false,'Usage: /n [question] (maximum 500 characters)' end
    local existing=MySQL.scalar.await("SELECT id FROM newbie_questions WHERE asker_account_id=? AND status='open' LIMIT 1",{profile.accountId})
    if existing then return false,('You already have open question #%d.'):format(existing) end
    local id=MySQL.insert.await('INSERT INTO newbie_questions (asker_account_id,open_asker_account_id,asker_username,asker_source,question) VALUES (?,?,?,?,?)',{profile.accountId,profile.accountId,profile.username,src,text})
    eachOnline(function(target)
        if (exports.rpg_core:GetAdminLevel(target)>0 and RPGAdmin.adminDuty[target]) or (exports.rpg_core:GetHelperLevel(target)>0 and RPGAdmin.helperDuty[target]) then
            message(target,('[NEWBIE #%d] %s (%d): %s'):format(id,profile.username,src,text),'helper')
        end
    end)
    return ('Question #%d sent.'):format(id)
end
register({ name='n',aliases={'helpme'},description='Ask staff a newbie question.',usage='/n [question]',arguments={{required=true}},handler=submitQuestion })

register({ name='an',description='Answer a newbie question.',usage='/an [question id] [answer]',minimumAdminLevel=1,minimumHelperLevel=1,arguments={{required=true},{required=true}},handler=function(src,args)
    local id=tonumber(args[1]); local answer=join(args,2); if not id or not answer or #answer>500 then return false,'Usage: /an [question id] [answer]' end
    local staff=exports.rpg_core:GetPlayer(src); local row=MySQL.single.await("SELECT * FROM newbie_questions WHERE id=? AND status='open'",{id}); if not row then return false,'Open question not found.' end
    local changed=MySQL.update.await("UPDATE newbie_questions SET status='answered',open_asker_account_id=NULL,handled_by_account_id=?,handled_by_username=?,answer=?,handled_at=UTC_TIMESTAMP(6) WHERE id=? AND status='open'",{staff.accountId,staff.username,answer,id})
    if changed~=1 then return false,'Question was already handled.' end
    local rendered=('Newbie %s (%d): %s\nHelper %s (%d): %s'):format(row.asker_username,row.asker_source,row.question,staff.username,src,answer)
    eachOnline(function(target) message(target,rendered,'helper') end)
    return ('Question #%d answered.'):format(id)
end })

register({ name='nd',description='Delete an invalid newbie question.',usage='/nd [question id] [reason]',minimumAdminLevel=1,minimumHelperLevel=1,arguments={{required=true},{required=true}},handler=function(src,args)
    local id=tonumber(args[1]); local reason=join(args,2); if not id or not reason then return false,'Usage: /nd [question id] [reason]' end
    local staff=exports.rpg_core:GetPlayer(src); local row=MySQL.single.await("SELECT * FROM newbie_questions WHERE id=? AND status='open'",{id}); if not row then return false,'Open question not found.' end
    local changed=MySQL.update.await("UPDATE newbie_questions SET status='deleted',open_asker_account_id=NULL,handled_by_account_id=?,handled_by_username=?,close_reason=?,handled_at=UTC_TIMESTAMP(6) WHERE id=? AND status='open'",{staff.accountId,staff.username,reason,id})
    if changed~=1 then return false,'Question was already handled.' end
    local current=exports.rpg_core:GetPlayer(row.asker_source)
    if current and current.accountId==tonumber(row.asker_account_id) then notify(row.asker_source,('Question #%d removed: %s'):format(id,reason),'warning') end
    return ('Question #%d removed.'):format(id)
end })

local function mutePlayer(kind,src,target,minutes,reason)
    local actor=exports.rpg_core:GetPlayer(src); local expires=os.date('!%Y-%m-%d %H:%M:%S',os.time()+minutes*60)
    return MySQL.insert.await([[INSERT INTO sanctions (sanction_type,target_account_id,target_username,actor_account_id,actor_username,reason,expires_at)
        VALUES (?,?,?,?,?,?,?)]],{kind,target.accountId,target.username,actor.accountId,actor.username,reason,expires})
end
register({ name='mute',description='Mute global chat.',usage='/mute [id] [minutes] [reason]',minimumAdminLevel=2,arguments={{required=true},{required=true},{required=true}},handler=function(src,args)
    local target,err=player(args[1]); if not target then return false,err end
    local allowed,denied=canAct(src,target,false); if not allowed then return false,denied end
    local minutes=tonumber(args[2]); local reason=join(args,3); if not minutes or minutes<1 or minutes>43200 or not reason then return false,'Usage: /mute [id] [minutes] [reason]' end
    local id=mutePlayer('mute',src,target,math.floor(minutes),reason); if not id then return false,'Mute could not be saved.' end
    notify(target.source,('You are muted from global chat for %d minutes: %s'):format(minutes,reason),'error'); return ('Mute #%d applied.'):format(id)
end })
register({ name='nmute',description='Mute newbie questions.',usage='/nmute [id] [reason] [minutes]',minimumAdminLevel=1,minimumHelperLevel=2,arguments={{required=true},{required=true},{required=true}},handler=function(src,args)
    local target,err=player(args[1]); if not target then return false,err end
    local allowed,denied=canAct(src,target,false); if not allowed then return false,denied end
    local minutes=tonumber(args[#args]); local reason=join(args,2,#args-1); if not minutes or minutes<1 or minutes>43200 or not reason then return false,'Usage: /nmute [id] [reason] [minutes]' end
    local id=mutePlayer('newbie_mute',src,target,math.floor(minutes),reason); if not id then return false,'Newbie mute could not be saved.' end
    notify(target.source,('You are muted from asking questions for %d minutes: %s'):format(minutes,reason),'error'); return ('Newbie mute #%d applied.'):format(id)
end })

register({ name='noclip',description='Toggle admin noclip.',usage='/noclip',minimumAdminLevel=1,handler=function(src) TriggerClientEvent('rpg:admin:noclip',src); return 'Noclip toggled.' end })
register({ name='mark',description='Save current admin position.',usage='/mark',minimumAdminLevel=1,handler=function(src)
    marks[src]=position(src); if not marks[src] then return false,'Your entity is unavailable.' end return 'Mark saved.'
end })
register({ name='gotomark',description='Teleport to saved mark.',usage='/gotomark',minimumAdminLevel=1,handler=function(src)
    local mark=marks[src]; if not mark then return false,'Use /mark first.' end
    SetPlayerRoutingBucket(src,mark.bucket); TriggerClientEvent('rpg:admin:teleport',src,mark); return 'Teleported to mark.'
end })
register({ name='disarm',description='Remove all weapons from a player.',usage='/disarm [id]',minimumAdminLevel=2,arguments={{required=true}},handler=function(src,args)
    local target,err=player(args[1]); if not target then return false,err end local allowed,denied=canAct(src,target,true); if not allowed then return false,denied end TriggerClientEvent('rpg:admin:disarm',target.source); action('disarm',src,target); return ('Disarmed %s.'):format(target.username)
end })
register({ name='disarmarea',description='Disarm players in range.',usage='/disarmarea [distance]',minimumAdminLevel=3,arguments={{required=true}},handler=function(src,args)
    local radius=tonumber(args[1]); local origin=position(src); if not radius or radius<1 or radius>200 or not origin then return false,'Distance must be 1-200.' end
    local count=0; eachOnline(function(target) if target~=src then local profile=exports.rpg_core:GetPlayer(target); local allowed=profile and canAct(src,profile,false); local p=position(target); if allowed and p and #(vector3(origin.x,origin.y,origin.z)-vector3(p.x,p.y,p.z))<=radius then TriggerClientEvent('rpg:admin:disarm',target); count=count+1 end end end)
    action('disarmarea',src,nil,nil,{radius=radius,count=count}); return ('Disarmed %d player(s).'):format(count)
end })
register({ name='sethp',description='Set player health.',usage='/sethp [id] [1-200]',minimumAdminLevel=2,arguments={{required=true},{required=true}},handler=function(src,args)
    local target,err=player(args[1]); if not target then return false,err end local hp=tonumber(args[2]); if not hp or hp<1 or hp>200 then return false,'HP must be 1-200.' end
    local allowed,denied=canAct(src,target,true); if not allowed then return false,denied end
    SetEntityHealth(GetPlayerPed(target.source),math.floor(hp)); TriggerClientEvent('rpg:admin:setHealth',target.source,math.floor(hp)); action('sethp',src,target,nil,{health=hp}); return ('Set %s HP to %d.'):format(target.username,hp)
end })
register({ name='sethparea',description='Heal players in range.',usage='/sethparea [distance]',minimumAdminLevel=3,arguments={{required=true}},handler=function(src,args)
    local radius=tonumber(args[1]); local origin=position(src); if not radius or radius<1 or radius>200 or not origin then return false,'Distance must be 1-200.' end
    local count=0; eachOnline(function(target) local profile=exports.rpg_core:GetPlayer(target); local allowed=profile and canAct(src,profile,true); local p=position(target); if allowed and p and #(vector3(origin.x,origin.y,origin.z)-vector3(p.x,p.y,p.z))<=radius then SetEntityHealth(GetPlayerPed(target),200); TriggerClientEvent('rpg:admin:setHealth',target,200); count=count+1 end end)
    action('sethparea',src,nil,nil,{radius=radius,count=count}); return ('Healed %d player(s).'):format(count)
end })
register({ name='givegun',description='Give a whitelisted weapon.',usage='/givegun [id] [weapon]',minimumAdminLevel=4,arguments={{required=true},{required=true}},handler=function(src,args)
    local target,err=player(args[1]); if not target then return false,err end local weapon=weapons[string.lower(args[2])]; if not weapon then return false,'Allowed: '..table.concat({'pistol','combatpistol','stun','smg','carbine','shotgun','bat','knife','flashlight'},', ') end
    local allowed,denied=canAct(src,target,true); if not allowed then return false,denied end
    TriggerClientEvent('rpg:admin:giveWeapon',target.source,weapon); action('givegun',src,target,nil,{weapon=weapon}); return ('Gave %s to %s.'):format(weapon,target.username)
end })
register({ name='givemoney',description='Give persisted money.',usage='/givemoney [id] [amount]',minimumAdminLevel=4,arguments={{required=true},{required=true}},handler=function(src,args)
    local target,err=player(args[1]); if not target then return false,err end local amount=tonumber(args[2]); if not amount or amount<1 or amount>100000000 then return false,'Amount must be 1-100000000.' end
    local allowed,denied=canAct(src,target,true); if not allowed then return false,denied end
    if not exports.rpg_core:IncrementStat(target.source,'money',math.floor(amount)) then return false,'Money update failed.' end action('givemoney',src,target,nil,{amount=amount}); return ('Gave $%d to %s.'):format(amount,target.username)
end })
register({ name='giverpall',description='Give Respect Points to online players.',usage='/giverpall [amount]',minimumAdminLevel=5,arguments={{required=true}},handler=function(src,args)
    local amount=tonumber(args[1]); if not amount or amount<1 or amount>1000000 then return false,'Amount must be 1-1000000.' end local count=0
    eachOnline(function(target) if exports.rpg_core:GetAccountId(target) and exports.rpg_core:IncrementStat(target,'respectPoints',math.floor(amount)) then count=count+1 end end)
    action('giverpall',src,nil,nil,{amount=amount,count=count}); return ('Gave %d RP to %d player(s).'):format(amount,count)
end })
register({ name='setstat',description='Set a whitelisted persisted statistic.',usage='/setstat [id] [money|rp|level|xp] [value]',minimumAdminLevel=5,arguments={{required=true},{required=true},{required=true}},handler=function(src,args)
    local target,err=player(args[1]); if not target then return false,err end local map={money='money',rp='respectPoints',respect_points='respectPoints',level='level',xp='xp'}; local stat=map[string.lower(args[2])]; local value=tonumber(args[3])
    local allowed,denied=canAct(src,target,true); if not allowed then return false,denied end
    if not stat or not value or value<0 or value>1000000000 or (stat=='level' and value<1) then return false,'Usage: /setstat [id] [money|rp|level|xp] [value]' end
    if not exports.rpg_core:SetStat(target.source,stat,math.floor(value)) then return false,'Stat update failed.' end action('setstat',src,target,nil,{stat=stat,value=value}); return ('Updated %s for %s.'):format(stat,target.username)
end })

register({ name='setvw',description='Set a player virtual world.',usage='/setvw [id] [world]',minimumAdminLevel=3,arguments={{required=true},{required=true}},handler=function(src,args)
    local target,err=player(args[1]); if not target then return false,err end local world=tonumber(args[2]); if not world or world<0 or world>999999 then return false,'World must be 0-999999.' end
    local allowed,denied=canAct(src,target,true); if not allowed then return false,denied end
    SetPlayerRoutingBucket(target.source,math.floor(world)); action('setvw',src,target,nil,{world=world}); return ('Moved %s to virtual world %d.'):format(target.username,world)
end })
register({ name='createhouse',description='Create a persisted house at your position.',usage='/createhouse [level] [price]',minimumAdminLevel=5,arguments={{required=true},{required=true}},handler=function(src,args)
    local level,price=tonumber(args[1]),tonumber(args[2]); local p=position(src); local creator=exports.rpg_core:GetPlayer(src)
    if not level or level%1~=0 or level<1 or level>10 or not price or price%1~=0 or price<1 or not p then return false,'Usage: /createhouse [level 1-10] [price]' end
    local id=MySQL.insert.await('INSERT INTO houses (level,price,x,y,z,heading,virtual_world,created_by_account_id) VALUES (?,?,?,?,?,?,?,?)',{level,price,p.x,p.y,p.z,p.heading,p.bucket,creator.accountId})
    action('createhouse',src,nil,nil,{houseId=id,level=level,price=price}); return ('House #%d created.'):format(id)
end })
register({ name='setleader',description='Set a faction leader.',usage='/setleader [id] [faction name]',minimumAdminLevel=4,arguments={{required=true},{required=true}},handler=function(src,args)
    local target,err=player(args[1]); if not target then return false,err end local name=join(args,2); if not name or #name>64 then return false,'Usage: /setleader [id] [faction name]' end
    local allowed,denied=canAct(src,target,true); if not allowed then return false,denied end
    local normalized=string.lower(name); MySQL.insert.await('INSERT IGNORE INTO factions (name,name_normalized) VALUES (?,?)',{name,normalized}); local factionId=MySQL.scalar.await('SELECT id FROM factions WHERE name_normalized=?',{normalized})
    local committed=MySQL.transaction.await({{query='UPDATE players SET faction_leader=FALSE WHERE faction_id=?',values={factionId}},{query='UPDATE players SET faction_id=?,faction_leader=TRUE WHERE account_id=?',values={factionId,target.accountId}}})
    if not committed or not exports.rpg_core:RefreshProfileFields(target.accountId) then return false,'Faction leader update failed.' end action('setleader',src,target,nil,{factionId=factionId,faction=name}); notify(target.source,'You are now leader of '..name,'success'); return ('%s is now leader of %s.'):format(target.username,name)
end })
register({ name='sethelper',description='Set helper level.',usage='/sethelper [id] [0-3]',minimumAdminLevel=6,arguments={{required=true},{required=true}},handler=function(src,args)
    local target,err=player(args[1]); if not target then return false,err end local level=tonumber(args[2]); if not level or level%1~=0 or level<0 or level>3 then return false,'Usage: /sethelper [id] [0-3]' end
    local allowed,denied=canAct(src,target,false); if not allowed then return false,denied end
    local changed=MySQL.update.await('UPDATE accounts SET helper_level=? WHERE id=?',{level,target.accountId}); if changed==nil or exports.rpg_core:RefreshHelperLevel(target.accountId)~=level then return false,'Helper level update failed.' end
    action('sethelper',src,target,nil,{level=level}); notify(target.source,('Your helper level is now %d.'):format(level),'success'); return ('%s helper level set to %d.'):format(target.username,level)
end })

local function spawnVehicle(row)
    local entity=CreateVehicleServerSetter(GetHashKey(row.model),'automobile',tonumber(row.x),tonumber(row.y),tonumber(row.z),tonumber(row.heading))
    if not entity or entity==0 then return nil end
    SetEntityOrphanMode(entity,2); SetEntityRoutingBucket(entity,tonumber(row.virtual_world) or 0); spawnedVehicles[tonumber(row.id)]=entity
    return entity
end
register({ name='spawncar',description='Spawn a persistent server vehicle.',usage='/spawncar [model]',minimumAdminLevel=4,arguments={{required=true}},handler=function(src,args)
    local model=string.lower(args[1]); if not model:match('^[%w_]+$') or #model>64 then return false,'Invalid vehicle model.' end local p=position(src); local creator=exports.rpg_core:GetPlayer(src); if not p then return false,'Your entity is unavailable.' end
    local id=MySQL.insert.await('INSERT INTO server_vehicles (model,x,y,z,heading,virtual_world,created_by_account_id) VALUES (?,?,?,?,?,?,?)',{model,p.x,p.y,p.z,p.heading,p.bucket,creator.accountId}); local entity=spawnVehicle({id=id,model=model,x=p.x,y=p.y,z=p.z,heading=p.heading,virtual_world=p.bucket})
    if not entity then MySQL.query.await('DELETE FROM server_vehicles WHERE id=?',{id}); return false,'Vehicle model could not be spawned.' end action('spawncar',src,nil,nil,{vehicleId=id,model=model}); return ('Server vehicle #%d (%s) spawned.'):format(id,model)
end })
register({ name='gotocar',description='Teleport to a server vehicle.',usage='/gotocar [vehicle id]',minimumAdminLevel=2,arguments={{required=true}},handler=function(src,args)
    local id=tonumber(args[1]); local entity=id and spawnedVehicles[id]; if not entity or not DoesEntityExist(entity) then return false,'Server vehicle not found.' end local c=GetEntityCoords(entity); SetPlayerRoutingBucket(src,GetEntityRoutingBucket(entity)); TriggerClientEvent('rpg:admin:teleport',src,{x=c.x,y=c.y,z=c.z+1.0,heading=GetEntityHeading(entity)}); return ('Teleported to vehicle #%d.'):format(id)
end })
register({ name='getcar',description='Bring a server vehicle.',usage='/getcar [vehicle id]',minimumAdminLevel=3,arguments={{required=true}},handler=function(src,args)
    local id=tonumber(args[1]); local entity=id and spawnedVehicles[id]; local p=position(src); if not entity or not DoesEntityExist(entity) or not p then return false,'Server vehicle or your position is unavailable.' end SetEntityRoutingBucket(entity,p.bucket); SetEntityCoords(entity,p.x,p.y,p.z,false,false,false,false); SetEntityHeading(entity,p.heading); action('getcar',src,nil,nil,{vehicleId=id}); return ('Brought vehicle #%d.'):format(id)
end })
register({ name='respawncars',description='Respawn all server vehicles.',usage='/respawncars',minimumAdminLevel=3,handler=function(src)
    local rows=MySQL.query.await('SELECT * FROM server_vehicles'); local count=0
    for _,row in ipairs(rows) do local old=spawnedVehicles[tonumber(row.id)]; if old and DoesEntityExist(old) then DeleteEntity(old) end; if spawnVehicle(row) then count=count+1 end end action('respawncars',src,nil,nil,{count=count}); return ('Respawned %d server vehicle(s).'):format(count)
end })
register({ name='fixveh',description='Repair and refuel current vehicle.',usage='/fixveh',minimumAdminLevel=2,handler=function(src) TriggerClientEvent('rpg:admin:fixVehicle',src); return 'Vehicle repair requested.' end })
register({ name='entercar',description='Enter nearest vehicle.',usage='/entercar',minimumAdminLevel=1,handler=function(src) TriggerClientEvent('rpg:admin:enterNearestVehicle',src); return true end })
register({ name='togfind',description='Toggle tracking immunity.',usage='/togfind',minimumAdminLevel=1,handler=function(src) local value=not Player(src).state['rpg:trackingImmune']; Player(src).state:set('rpg:trackingImmune',value,true); return value and 'Tracking immunity enabled.' or 'Tracking immunity disabled.' end })
register({ name='sleep',description='Toggle AFK/sleep state.',usage='/sleep',handler=function(src) sleeping[src]=not sleeping[src]; Player(src).state:set('rpg:sleeping',sleeping[src],true); return sleeping[src] and 'Sleep/AFK enabled.' or 'Sleep/AFK disabled.' end })
register({ name='afklist',description='List sleeping players.',usage='/afklist',minimumAdminLevel=1,handler=function(src,_,reply) local list={}; for target in pairs(sleeping) do if GetPlayerName(target) then list[#list+1]=('%s (%d)'):format(staffName(target),target) end end reply(src,#list>0 and table.concat(list,', ') or 'No players are sleeping.','info'); return true end })

CreateThread(function()
    while GetResourceState('oxmysql')~='started' do Wait(100) end
    Wait(500)
    for _,row in ipairs(MySQL.query.await('SELECT * FROM server_vehicles')) do spawnVehicle(row) end
end)
AddEventHandler('playerDropped',function() marks[source]=nil; sleeping[source]=nil end)
AddEventHandler('onResourceStop',function(resource) if resource~=GetCurrentResourceName() then return end for _,entity in pairs(spawnedVehicles) do if DoesEntityExist(entity) then DeleteEntity(entity) end end end)
