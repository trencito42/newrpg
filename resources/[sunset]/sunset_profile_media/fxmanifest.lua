fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_profile_media'
description 'Production player skin snapshot and vehicle preview capture pipeline'
author 'Sunset RPG'
version '1.0.0'

shared_scripts {
    'shared/config.lua'
}

client_scripts {
    'client/main.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua'
}
