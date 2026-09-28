fx_version 'cerulean'
game 'gta5'
name 'rpg_core'
author 'RPG MVP'
description 'Small authoritative registry, lifecycle, RPC, command and stats foundation'
version '1.0.0'

shared_scripts {
    'shared/config.lua',
    'shared/utils.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/password.js',
    'server/log.lua',
    'server/registry.lua',
    'server/rpc.lua',
    'server/commands.lua',
    'server/main.lua'
}

client_scripts {
    'client/rpc.lua',
    'client/main.lua'
}

dependencies {
    'oxmysql'
}
