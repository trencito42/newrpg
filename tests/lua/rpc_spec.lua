local events, responses = {}, {}
RPG = { Config = { rpc = { globalWindowMs=10000,globalMax=10,defaultWindowMs=5000,defaultMax=5,timeoutMs=15000 } }, Log=function() end, Util={} }
GetGameTimer = (function() local n=0 return function() n=n+1 return n end end)()
GetInvokingResource=function() return 'test' end
GetCurrentResourceName=function() return 'rpg_core' end
RegisterNetEvent=function(name,handler) events[name]=handler end
TriggerClientEvent=function(_,src,id,payload) responses[#responses+1]={src=src,id=id,payload=payload} end
SetTimeout=function(_,_) end
CreateThread=function(fn) fn() end
AddEventHandler=function() end
GetAccountId=function(src) return src==8 and 100 or nil end
exports=setmetatable({}, {__call=function() end})

dofile('resources/[framework]/rpg_core/server/rpc.lua')
RegisterCallback('test.echo',function(_,value) return value end)
RegisterCallback('test.fail',function() error('private failure') end)

source=8; events['rpg:rpc:request']('id-1','test.echo',table.pack('hello'))
assert(responses[#responses].payload.ok and responses[#responses].payload.data=='hello')
events['rpg:rpc:request']('id-2','does.not.exist',table.pack())
assert(responses[#responses].payload.code=='NOT_FOUND')
events['rpg:rpc:request']('id-3','test.fail',table.pack())
assert(responses[#responses].payload.code=='SERVER_ERROR' and not tostring(responses[#responses].payload.error):match('private failure'))
source=9; events['rpg:rpc:request']('id-4','test.echo',table.pack('x'))
assert(responses[#responses].payload.code=='UNAUTHENTICATED')
print('rpc_spec: ok')

