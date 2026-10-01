fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_cnn'
description 'SA:MP Style CNN Advertisement System with Queue, Moderation & Helpdesk Integration'
version '1.0.0'

shared_scripts {
    '@sunset_core/shared/config.lua',
    '@sunset_core/shared/utils.lua',
    'shared/config.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
}

client_scripts {
    '@sunset_core/client/callbacks.lua',
    'client/main.lua',
}

dependencies {
    'sunset_core',
    'sunset_admin',
    'sunset_chat',
    'oxmysql',
}

exports {
    'RunChatCommand',
    'ExecutePlayerCommand',
    'IsAdMuted',
    'GetPendingAds',
    'GetAdQueue',
}

server_exports {
    'RunChatCommand',
    'ExecutePlayerCommand',
    'IsAdMuted',
    'GetPendingAds',
    'GetAdQueue',
    'ApproveAd',
    'RejectAd',
    'AdMutePlayer',
}
