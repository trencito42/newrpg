Config = {}

-- Discord Application Client ID (Racket RPG Official App ID)
Config.DiscordAppId = '1555769124297121883'
Config.DiscordPublicKey = '55441c028a4bcf2b9b28e88f025277855f7d04856203c5fde1d4c29760cd99b2'

-- Refresh Interval (seconds)
Config.RefreshInterval = 15

-- Server branding & links
Config.ServerName = 'Racket RPG • Romania'
Config.WebsiteUrl = 'https://racket.cat'
Config.ConnectUrl = 'fivem://connect/racket.cat'

-- Buttons configuration
Config.Buttons = {
    {
        index = 0,
        labelKey = "config.discord_rpc.label.play_on_the_server.44eecb88", label = '🎮 Joacă pe Server',
        url = 'https://racket.cat' -- Note: Discord requires valid https:// protocol for buttons
    },
    {
        index = 1,
        labelKey = "config.discord_rpc.label.panel_community.59301278", label = '🌐 Panel & Comunitate',
        url = 'https://racket.cat'
    }
}

-- Asset keys
Config.Assets = {
    largeImage = 'racket_logo',
    largeText = 'Racket RPG • racket.cat',
    smallImage = 'fivem_logo',
    smallText = 'Los Santos RPG Experience'
}
