fx_version 'cerulean'
game 'gta5'
name 'rpg_spawn'
author 'RPG MVP'
description 'Deterministic onboarding and LSIA spawn pipeline'
version '1.0.0'

shared_script 'shared/config.lua'
server_script 'server/main.lua'
client_script 'client/main.lua'

dependencies {
    'rpg_core',
    'rpg_ui'
}
