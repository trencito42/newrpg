local sent = {}
RPG = { Config = { adminLabels = { [0]='Player',[1]='Helper',[2]='Moderator',[3]='Admin',[4]='Super Admin',[5]='Owner' } }, Log = function() end }
GetInvokingResource = function() return 'test' end
GetCurrentResourceName = function() return 'rpg_core' end
GetGameTimer = (function() local n=0 return function() n=n+300 return n end end)()
GetAdminLevel = function(src) return src == 10 and 1 or 0 end
TriggerClientEvent = function(event, src, message, kind) sent[#sent+1]={event=event,src=src,message=message,kind=kind} end
AddEventHandler = function() end
exports = setmetatable({}, { __call = function() end })

dofile('resources/[framework]/rpg_core/server/commands.lua')

RPG.RegisterCommand({ name='secure', usage='/secure [id]', minimumAdminLevel=2, arguments={{required=true}}, handler=function() return true end })
RPG.RegisterCommand({ name='find', usage='/find [id]', arguments={{required=true}}, handler=function(_,args) if args[1]=='53' then return false,'Player #53 is not online.' end return true end })

assert(DispatchCommand(10,'/missing') == false)
assert(sent[#sent].message == 'Unknown command: /missing')
assert(DispatchCommand(10,'/secure 2') == false)
assert(sent[#sent].message:match('Requires Moderator %(level 2%). Your level: 1.'))
assert(DispatchCommand(11,'/find') == false)
assert(sent[#sent].message == 'Usage: /find [id]')
assert(DispatchCommand(11,'/find 53') == false)
assert(sent[#sent].message == 'Player #53 is not online.')
print('command_spec: ok')
