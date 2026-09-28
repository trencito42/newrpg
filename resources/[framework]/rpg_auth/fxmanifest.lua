fx_version 'cerulean'
game 'gta5'
name 'rpg_auth'
author 'RPG MVP'
description 'Username/password authentication protocol'
version '1.0.0'

server_script 'server/main.lua'
client_script 'client/main.lua'

dependencies {
    'rpg_core',
    'rpg_ui'
}
