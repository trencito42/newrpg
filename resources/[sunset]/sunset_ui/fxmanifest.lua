fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'sunset_ui'
author 'SunsetMP'
description 'NUI framework — cinematic sunset design system'
version '1.0.0'

ui_page 'web/index.html'

files {
    'web/index.html',
    'web/css/*.css',
    'web/js/*.js',
    'web/vendor/**/*',
    'web/assets/**/*',
    'web/modules/**/*',
}

shared_scripts {
    '@sunset_core/shared/boot_debug.lua',
}

client_scripts {
    'client/main.lua',
    'client/nui_bridge.lua',
}

server_scripts {
    'server/main.lua',
}

exports {
    'Show',
    'Hide',
    'Send',
    'JobHud',
    'JobHudResult',
    'JobHudClear',
    'IsOpen',
    'MarkGameplayEntered',
    'Notify',
    'ProgressBar',
    'SetFocus',
    'ReleaseFocusUnlessModal',
    'ShowTransition',
    'HideTransition',
    'IsTransitionVisible',
}
