fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_jobs'
description 'Job center, civilian job loops, and setjob'
version '1.0.0'

files {
    'data/job_routes.json',
}

shared_scripts {
    '@sunset_core/shared/config.lua',
    '@sunset_core/shared/utils.lua',
    '@sunset_core/shared/jobs_civilian.lua',
    '@sunset_core/shared/jobs_workplaces.lua',
    '@sunset_core/shared/jobs_config.lua',
    '@sunset_core/shared/job_session.lua',
    '@sunset_core/shared/profile.lua',
    '@sunset_core/shared/factions.lua',
    '@sunset_core/shared/items.lua',
    '@sunset_core/shared/fish_prices.lua',
}

dependencies { 'sunset_core', 'sunset_world', 'sunset_inventory' }

client_scripts {
    '@sunset_core/client/callbacks.lua',
    'client/core.lua',
    'client/visual_shared.lua',
    'client/workplaces.lua',
    'client/trucker.lua',
    'client/trucker_npc.lua',
    'client/garbage.lua',
    'client/courier.lua',
    'client/busdriver.lua',
    'client/fisherman.lua',
    'client/mechanic.lua',
    'client/hunter.lua',
    'client/diver.lua',
    'client/commands.lua',
    'client/main.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/core.lua',
    'server/route_store.lua',
    'server/workplaces.lua',
    'server/trucker.lua',
    'server/garbage.lua',
    'server/courier.lua',
    'server/busdriver.lua',
    'server/fisherman.lua',
    'server/mechanic.lua',
    'server/hunter.lua',
    'server/diver.lua',
    'server/main.lua',
}


server_exports {
    'GetMechanicProviders',
    'CancelSession',
    'PayReward',
    'AddJobXP',
    'GetJobLevel',
    'HireCivilianJob',
    'GetRoutes',
    'GetRouteById',
    'SaveRoutes',
    'ReloadRoutes',
}

client_exports {
    'IsFishermanShiftActive',
    'DrawTruckerDeliveryPreview',
    'DrawTruckerParkingBayPreview',
    'DrawTruckerPickupPreview',
    'DrawGarbageBinPreview',
    'GetGroundCoords',
}
