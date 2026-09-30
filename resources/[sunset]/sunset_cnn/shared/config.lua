Config = Config or {}

Config.CNN = {
    -- Locations where players can post CNN advertisements
    locations = {
        { coords = vector3(-1082.0, -247.5, 37.8), radius = 6.0, name = 'Weazel News Headquarters (Little Seoul)' },
        { coords = vector3(-596.5, -929.8, 23.9), radius = 6.0, name = 'Los Santos CNN Office (Pillbox Hill)' },
        { coords = vector3(-118.0, 6467.5, 31.6), radius = 6.0, name = 'Paleto Bay News Station' },
        { coords = vector3(1853.5, 3687.5, 34.2), radius = 6.0, name = 'Sandy Shores Local Station' },
    },

    -- Economic and timing parameters (SA:MP RPG standard)
    price = 500,               -- Cost in $ per advertisement
    minLength = 5,             -- Minimum character length
    maxLength = 140,           -- Maximum character length
    minDelay = 60,             -- Minimum queue delay before publication (seconds)
    publishInterval = 45,      -- Spacing between successive ads in seconds
    maxQueueDelay = 300,       -- Maximum delay cap (seconds)
    playerCooldown = 120,      -- Seconds cooldown between ad submissions for the same player
    maxPendingQueue = 50,      -- Maximum pending ads allowed in queue

    -- Map Blip settings
    blip = {
        sprite = 459,          -- News / Microphone icon
        color = 2,             -- Green
        scale = 0.8,
        label = 'CNN - Announcements',
    },
}
