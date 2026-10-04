Config = Config or {}

Config.CNN = {
    -- Locations where players can post CNN advertisements (4 canonical RPG stations)
    locations = {
        -- 1. Weazel News HQ (Little Seoul / Rockford)
        { coords = vector3(-599.44, -929.74, 23.86), radius = 25.0, nameKey = 'cnn.location.weazel_hq' },
        -- 2. CNN Los Santos Downtown (Legion Square / Pillbox)
        { coords = vector3(-248.54, -912.44, 32.31), radius = 25.0, nameKey = 'cnn.location.ls_downtown' },
        -- 3. CNN Sandy Shores (Algonquin Blvd)
        { coords = vector3(1697.88, 3780.24, 34.70), radius = 25.0, nameKey = 'cnn.location.sandy_shores' },
        -- 4. CNN Paleto Bay (Duluoz Ave)
        { coords = vector3(-142.12, 6301.88, 31.55), radius = 25.0, nameKey = 'cnn.location.paleto_bay' },
    },

    -- Economic and timing parameters (SA:MP RPG standard)
    price = 500,               -- Cost in $ per advertisement
    minLength = 5,             -- Minimum character length
    maxLength = 140,           -- Maximum character length
    minDelay = 60,             -- Minimum queue delay before publication (seconds)
    publishInterval = 45,      -- Spacing between successive ads in seconds
    maxQueueDelay = 300,       -- Maximum delay cap (seconds)
    playerCooldown = 120,      -- Seconds cooldown between ad submissions for the same player
    promoteCooldown = 3600,    -- Seconds before the same marketplace listing can be promoted again
    maxPendingQueue = 50,      -- Maximum pending ads allowed in queue
    -- Marketplace "Promote on CNN" uses this price and the same station, mute,
    -- queue, and cooldown rules as /ad. It does not bypass the physical CNN location.

    -- Map Blip settings
    blip = {
        sprite = 459,          -- News / Microphone icon
        color = 2,             -- Green
        scale = 0.8,
        labelKey = 'cnn.blip.announcements',
    },
}
