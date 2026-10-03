fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_phone'
description 'In-game phone'
version '1.0.0'

dependencies { 'sunset_core' }

client_scripts {
    '@sunset_core/client/callbacks.lua',
    '@sunset_core/shared/jobs_workplaces.lua',
    '@sunset_impound/shared/config.lua',
    '@sunset_cnn/shared/config.lua',
    'client/main.lua',
    'client/apps.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/calls.lua',
    'server/apps.lua',
    'server/main.lua',
}
