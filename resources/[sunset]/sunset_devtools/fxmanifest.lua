fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_devtools'
author 'SunsetMP'
description 'DEV-ONLY: in-game placement studio and route editor. Disabled by default.'
version '1.0.0'

-- NOT ensured in production server.cfg. Enabled explicitly by devs:
--   ensure sunset_devtools
--   setr sunset_devtools_enabled true

shared_scripts {
    '@sunset_core/shared/config.lua',
    'shared/config.lua',
    'shared/adapters.lua',
}

client_scripts {
    '@sunset_core/client/callbacks.lua',
    'client/visualizers.lua',
    'client/validators.lua',
    'client/gizmo.lua',
    'client/world_probe.lua',
    'client/placement.lua',
    'client/route_editor.lua',
    'client/main.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/drafts.lua',
    'server/main.lua',
}

dependencies { 'sunset_core', 'sunset_admin' }
