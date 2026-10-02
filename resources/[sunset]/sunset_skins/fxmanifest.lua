fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_skins'
author 'SunsetMP'
description 'Skin shop — GTA ped models, NPC, /skins from home, admin tools'
version '1.0.0'

shared_scripts {
    '@sunset_core/shared/utils.lua',
    'shared/config.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
}

client_scripts {
    '@sunset_core/client/callbacks.lua',
    'client/main.lua',
}

-- [STARTUP] declared so the exports used at runtime are guaranteed started first
dependencies { 'sunset_core' }
