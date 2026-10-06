fx_version 'cerulean'
game 'gta5'
lua54 'yes'
node_version '22'

name 'racket_vehicle_thumbs'
description 'Admin-only vehicle thumbnail capture and chroma-key processing'
version '1.0.0'

shared_script 'code/config.lua'
client_script 'code/client.lua'
server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'code/server.lua',
    'code/processor.js',
}

dependencies { 'oxmysql', 'sunset_admin', 'sunset_ui', 'screenshot-basic' }

-- FiveM Node sandbox only exposes paths listed here; processor.js require() needs this.
files {
    'code/vanilla_models.json',
}
