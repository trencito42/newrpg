fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_missions'
author 'SunsetMP'
description 'Illegal missions — Hot Wheels & Container 47'
version '1.0.0'

ui_page 'web/index.html'

files {
    'web/index.html',
    'web/css/*.css',
    'web/js/*.js',
    'web/assets/**/*',
}

dependencies { 'sunset_core', 'sunset_ui' }

shared_scripts {
    '@sunset_core/shared/config.lua',
    '@sunset_core/shared/utils.lua',
    'shared/config.lua',
    'shared/contacts.lua',
    'missions/vehicle_recovery.lua',
    'missions/container_47.lua',
}

client_scripts {
    '@sunset_core/client/nui_locale.lua',
    '@sunset_core/client/callbacks.lua',
    'client/nui.lua',
    'client/entities.lua',
    'client/ai.lua',
    'client/runtime.lua',
    'client/main.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/sessions.lua',
    'server/validator.lua',
    'server/reputation.lua',
    'server/rewards.lua',
    'server/main.lua',
}
