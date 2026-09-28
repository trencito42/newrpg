fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'rpg_economy'
author 'Blipmade RPG Team'
description 'Minimal authoritative economy domain service'
version '0.1.0'

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
}
