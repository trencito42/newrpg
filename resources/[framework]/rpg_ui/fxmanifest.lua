fx_version 'cerulean'
game 'gta5'
name 'rpg_ui'
author 'RPG MVP'
description 'Central NUI shell and exclusive focus owner'
version '1.0.0'

loadscreen 'web/loadscreen.html'
loadscreen_manual_shutdown 'yes'

ui_page 'web/dist/index.html'

files {
    'web/loadscreen.html',
    'web/dist/index.html'
}

client_script 'client/main.lua'

dependency 'rpg_core'
