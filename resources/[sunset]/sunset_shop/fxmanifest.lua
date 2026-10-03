fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_shop'
author 'SunsetMP'
description 'Racket Shop — server-authoritative Racket Credit store'
version '1.0.0'

ui_page 'web/index.html'

shared_scripts {
    '@sunset_core/shared/config.lua',
    'shared/products.lua',
    'shared/validation.lua',
}

client_scripts {
    '@sunset_core/client/callbacks.lua',
    '@sunset_core/client/nui_locale.lua',
    'client/main.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/settlement.lua',
    'server/handlers/character.lua',
    'server/handlers/clan.lua',
    'server/handlers/economy.lua',
    'server/main.lua',
}

files {
    'web/index.html',
    'web/css/shop.css',
    'web/js/shop.js',
    'web/racket-coin.svg',
}

dependencies {
    'sunset_core',
    'sunset_ui',
}

exports {
    'OpenShop',
    'CloseShop',
    'IsShopOpen',
}

server_exports {
    'PurchaseProduct',
    'GetProductPrice',
    'GetRacketCredits',
    'TrySpendRacketCredits',
}
