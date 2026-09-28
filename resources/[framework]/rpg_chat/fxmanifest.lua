fx_version 'cerulean'
game 'gta5'
name 'rpg_chat'
author 'RPG MVP'
description 'Global chat and central command input adapter'
version '1.0.0'

server_script 'server/main.lua'
client_script 'client/main.lua'

dependencies {
    'rpg_core',
    'rpg_ui',
    'rpg_admin'
}
