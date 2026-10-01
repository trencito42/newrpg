fx_version 'cerulean'
game 'gta5'

name 'sunset_panel_bridge'
author 'Sunset RPG Team'
description 'Companion FiveM bridge for official Sunset RPG web panel: authentication PINs, linking tokens, and live status'
version '1.0.0'

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua'
}
