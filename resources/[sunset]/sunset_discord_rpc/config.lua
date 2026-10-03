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
        label = '🎮 Joacă pe Server',
        url = 'https://racket.cat'
    },
    {
        index = 1,
        label = '💬 Comunitate Discord',
        url = 'https://discord.gg/racket'
    }
}

-- Asset keys
Config.Assets = {
    largeImage = 'racket_logo',
    largeText = 'Racket RPG • racket.cat',
    smallImage = 'fivem_logo',
    smallText = 'Los Santos RPG Experience'
}
