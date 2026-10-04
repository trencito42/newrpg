fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_inventory'
description 'Character inventory system'
version '1.0.0'

dependencies { 'sunset_core' }

shared_scripts {
    '@sunset_core/shared/config.lua',
    '@sunset_core/shared/items.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
    'server/api.lua',
    'server/quickslots.lua',
    'server/asset_catalog.lua',
    'server/trade.lua',
    'server/containers.lua',
}

client_scripts {
    '@sunset_core/client/callbacks.lua',
    'client/main.lua',
    'client/weapons.lua',
    'client/props.lua',
    'client/quickslots.lua',
    'client/containers.lua',
}

server_exports {
    'GetInventory', 'AddItem', 'RemoveItem', 'HasItem', 'UseItem',
    'SetItemMetadata', 'GetGasCanLiters', 'CountItem', 'TakeAllItems',
    'TryAddItem', 'RemoveItemById', 'ReloadInventory', 'SetCapacityBonus', 'SetWeaponAmmo',
    'ApplyOperation', 'RemoveStolenByRobbery', 'PurgeStolenLoot',
    'IsAssetOfferedInTrade',
    'GetPlayerAssetCatalog', 'ResolvePublicAsset', 'ResolveChatAttachment',
    'ResolveMarketListing', 'SanitizePublicAttachment',
}

client_exports {
    'EquipHotbarWeapon', 'HolsterHotbarWeapon', 'GetHotbarEquippedHash',
    'EquipHotbarProp', 'HolsterHotbarProp', 'GetHotbarEquippedPropItem',
    'GetHotbarPropEntity', 'IsHotbarPropEntity',
}
