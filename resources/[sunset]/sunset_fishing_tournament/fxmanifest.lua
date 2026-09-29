fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_fishing_tournament'
description 'Authoritative server fishing tournament system'
version '2.0.0'

shared_scripts {
    '@sunset_core/shared/config.lua',
    'shared/config.lua',
}

client_scripts {
    'client/main.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
}

dependencies { 'sunset_core', 'sunset_events', 'sunset_ui' }
