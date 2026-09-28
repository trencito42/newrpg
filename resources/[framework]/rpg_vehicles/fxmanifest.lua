fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'rpg_vehicles'
author 'Blipmade RPG Team'
description 'Minimal authoritative server vehicles domain service'
version '0.1.0'

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
}
