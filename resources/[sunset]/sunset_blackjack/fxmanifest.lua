fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_blackjack'
description 'Playable 3D Blackjack at Diamond Casino for Racket RPG.'
author 'Xinerki / SunsetMP'

shared_script 'coords.lua'
client_scripts {
    'timerbars.lua',
    'client.lua',
}
server_scripts {
	'@oxmysql/lib/MySQL.lua',
	'@sunset_casino/shared/rng.lua',
	'server.lua',
}


-- [STARTUP] declared so the exports used at runtime are guaranteed started first
dependencies { 'sunset_inventory', 'oxmysql' }
