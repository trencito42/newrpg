fx_version 'cerulean'
game 'gta5'

name 'sunset_discord_rpc'
description 'Racket RPG Discord Rich Presence Integration'
version '1.0.0'

shared_scripts {
    'config.lua'
}

client_scripts {
    'client/main.lua'
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua'
}
