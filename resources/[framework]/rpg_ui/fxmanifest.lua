fx_version 'cerulean'
game 'gta5'
name 'rpg_ui'
author 'RPG MVP'
description 'Central NUI shell and exclusive focus owner'
version '1.0.0'

ui_page 'web/dist/index.html'
loadscreen 'web/loadscreen.html'
loadscreen_manual_shutdown 'yes'
loadscreen_hide_busyspinner 'yes'
loadscreen_cursor 'no'

files {
    'web/dist/index.html',
    'web/dist/assets/*',
    'web/loadscreen.html'
}

client_script 'client/main.lua'

dependency 'rpg_core'
