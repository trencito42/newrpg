fx_version 'cerulean'
game 'gta5'
name 'rpg_admin'
author 'RPG MVP'
description 'Staff commands, sanctions and immutable audit trail'
version '1.0.0'

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
    'server/extended.lua'
}

client_script 'client/main.lua'

dependencies {
    'oxmysql',
    'rpg_core',
    'rpg_ui',
    'rpg_spawn'
}
