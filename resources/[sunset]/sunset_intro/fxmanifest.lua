fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_intro'
author 'SunsetMP'
description 'Prezentare server la primul spawn — 7 slide-uri skip-abile, NUI curat'
version '1.0.0'

ui_page 'web/index.html'

files {
    'web/index.html',
}

shared_scripts {
    '@sunset_core/shared/config.lua',
}

client_scripts {
    '@sunset_core/client/callbacks.lua',
    'client/main.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
}

dependencies {
    'sunset_core',
    'oxmysql',
}
