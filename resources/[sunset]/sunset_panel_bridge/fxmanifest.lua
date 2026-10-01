fx_version 'cerulean'
game 'gta5'

name 'sunset_panel_bridge'
author 'RPG Server Team'
description 'Database-backed runtime snapshot for the companion panel'
version '1.0.0'

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua'
}
