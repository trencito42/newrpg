local sent = {}
RPG = { Config = { adminLabels = { [0]='Player',[1]='Admin Level 1',[2]='Admin Level 2',[3]='Admin Level 3',[4]='Admin Level 4',[5]='Admin Level 5',[6]='Admin Level 6' } }, Log = function() end }
GetInvokingResource = function() return 'test' end
GetCurrentResourceName = function() return 'rpg_core' end
GetGameTimer = (function() local n=0 return function() n=n+300 return n end end)()
GetAdminLevel = function(src) return src == 10 and 1 or 0 end
GetHelperLevel = function(src) return src == 12 and 1 or 0 end
TriggerClientEvent = function(event, src, message, kind) sent[#sent+1]={event=event,src=src,message=message,kind=kind} end
AddEventHandler = function() end
exports = setmetatable({}, { __call = function() end })

dofile('resources/[framework]/rpg_core/server/commands.lua')

RPG.RegisterCommand({ name='secure', usage='/secure [id]', minimumAdminLevel=2, arguments={{required=true}}, handler=function() return true end })
RPG.RegisterCommand({ name='find', usage='/find [id]', arguments={{required=true}}, handler=function(_,args) if args[1]=='53' then return false,'Player #53 is not online.' end return true end })
RPG.RegisterCommand({ name='assist', usage='/assist', minimumAdminLevel=1, minimumHelperLevel=1, handler=function() return true end })

assert(DispatchCommand(10,'/missing') == false)
assert(sent[#sent].message == 'Unknown command: /missing')
assert(DispatchCommand(10,'/secure 2') == false)
assert(sent[#sent].message:match('Requires Admin Level 2. Your admin/helper levels: 1/0.'))
assert(DispatchCommand(11,'/find') == false)
assert(sent[#sent].message == 'Usage: /find [id]')
assert(DispatchCommand(11,'/find 53') == false)
assert(sent[#sent].message == 'Player #53 is not online.')
assert(DispatchCommand(12,'/assist') == true)
print('command_spec: ok')
