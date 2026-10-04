fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_social'
description 'RACKET Social Feed domain — posts, likes, comments, notifications'
version '1.0.0'

dependencies { 'sunset_core' }

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/domain.lua',
    'server/main.lua',
}
