fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_devtools'
author 'SunsetMP'
description 'DEV-ONLY: in-game placement studio and visual route creator. Disabled by default.'
version '2.0.0'

ui_page 'web/index.html'

files {
    'web/index.html',
    'web/css/style.css',
    'web/js/app.js',
}

shared_scripts {
    '@sunset_core/shared/config.lua',
    '@sunset_core/shared/jobs_workplaces.lua',
    'shared/config.lua',
    'shared/adapters.lua',
}

client_scripts {
    '@sunset_core/client/callbacks.lua',
    '@sunset_core/client/nui_locale.lua',
    '@sunset_jobs/client/visual_shared.lua',
    'client/visualizers.lua',
    'client/validators.lua',
    'client/gizmo.lua',
    'client/world_probe.lua',
    'client/placement.lua',
    'client/route_creator.lua',
    'client/route_editor.lua',
    'client/main.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/drafts.lua',
    'server/routes.lua',
    'server/main.lua',
}

dependencies { 'sunset_core', 'sunset_admin', 'sunset_jobs', 'sunset_ui' }
