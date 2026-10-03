fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_slots'
description '5-Reel Sizzling Fruit Slot Machines for Racket RPG'
author 'XeX / SunsetMP'

ui_page 'html/ui.html'

shared_scripts {
    'config.lua',
}

client_scripts {
    '@sunset_core/client/callbacks.lua',
    '@sunset_core/client/nui_locale.lua',
    'client.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    '@sunset_casino/shared/rng.lua',
    'server_config.lua',
    'server.lua',
}

files {
    'html/ui.html',
    'html/*.js',
    'html/design.css',
    'html/img/*.png',
    'html/audio/*.mp3'
}

dependencies { 'sunset_core', 'sunset_ui', 'oxmysql' }
