fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_vehicle_dynamics'
author 'SunsetMP'
description 'Canonical realistic vehicle dynamics, handling baseline, and drivetrain physics for FiveM RPG'
version '1.0.0'

shared_scripts {
    '@sunset_core/shared/config.lua',
    '@sunset_core/shared/utils.lua',
    'shared/config.lua',
    'shared/classes.lua',
    'shared/profiles_vanilla.lua',
    'shared/profiles_addon.lua',
    'shared/profiles_emergency.lua',
    'shared/resolver.lua',
}

client_scripts {
    'client/baseline.lua',
    'client/apply.lua',
    'client/lifecycle.lua',
    'client/diagnostics.lua',
}

server_scripts {
    'server/main.lua',
}

dependencies {
    'sunset_core',
}

client_exports {
    'GetCanonicalBaseline',
    'GetVehicleDynamicsProfile',
    'ApplyVehicleDynamics',
    'IsVehicleManaged',
}

server_exports {
    'GetModelProfile',
}
