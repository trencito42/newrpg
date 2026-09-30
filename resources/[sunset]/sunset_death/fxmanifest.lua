fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_death'
description 'Death and respawn'
version '1.0.0'

dependencies { 'sunset_core', 'oxmysql' }

shared_scripts { '@sunset_core/shared/config.lua', 'shared/config.lua' }

client_scripts { '@sunset_core/client/world_stream.lua', 'client/main.lua', 'client/damage_indicators.lua' }
server_scripts { '@oxmysql/lib/MySQL.lua', 'server/main.lua' }
