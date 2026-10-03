fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_hacking'
author 'SunsetMP'
description 'Watch Dogs inspired network graph hacking minigame for FiveM'
version '1.0.0'

ui_page 'web/index.html'

shared_scripts {
    '@sunset_core/shared/config.lua',
    '@sunset_core/shared/utils.lua',
    'shared/config.lua',
    'shared/puzzles.lua',
}

client_scripts {
    '@sunset_core/client/nui_locale.lua',
    '@sunset_core/client/callbacks.lua',
    'client/main.lua',
    'client/debug.lua',
}

server_scripts {
    'server/main.lua',
}

files {
    'web/index.html',
    'web/style.css',
    'web/js/audio.js',
    'web/js/graph.js',
    'web/js/app.js',
}

dependencies {
    'sunset_core',
    'sunset_ui',
}

client_exports {
    'StartHackingPuzzle',
    'CancelHackingPuzzle',
    'IsHackingActive',
}

server_exports {
    'CreateHackingSession',
}
