SunsetRobbery = SunsetRobbery or {}

SunsetRobbery.Debug = false

SunsetRobbery.MinPolice = 4
SunsetRobbery.RequireRealPolice = true  -- [BUGFIX] was undefined (nil), so the police gate never enforced
SunsetRobbery.PlayerCooldownSec = 60 * 60
SunsetRobbery.LocationCooldownSec = 4 * 60 * 60  -- 4 hours location cooldown between robberies
SunsetRobbery.RobPointsPerPayday = 1
SunsetRobbery.RobPointsToStart = 2
SunsetRobbery.ConsumeRequiredItemOnStart = true
SunsetRobbery.HackTimeSec = 34
SunsetRobbery.HackTraceFail = 100
SunsetRobbery.HackWrongClickTrace = 18
SunsetRobbery.PerfectHackDelaySec = 20
SunsetRobbery.NormalHackDelaySec = 5
SunsetRobbery.FailedHackDelaySec = 0
SunsetRobbery.BagCapacity = 8
SunsetRobbery.EscapeRadius = 300.0
SunsetRobbery.StoreInteractRadius = 2.0
SunsetRobbery.StartRadius = 18.0
SunsetRobbery.DisplayLootCount = { min = 4, max = 7 }
SunsetRobbery.PoliceEscalateSec = 20
SunsetRobbery.PoliceVehicleSec = 40
SunsetRobbery.RateLimitMs = 220
SunsetRobbery.RequiredItem = 'lockpick'
SunsetRobbery.BlockedFactions = { police = true, sheriff = true, fib = true }

SunsetRobbery.Fence = {
    labelKey = "config.robbery.label.fence.24f64604", label = 'Fence',
    coords = vector3(153.18, -3211.72, 5.91),
    heading = 90.0,
    interact = 2.0,
    blip = { sprite = 500, color = 5, scale = 0.8, labelKey = "config.robbery.label.fence_black_market.fbaac062", label = 'Fence — Black Market' },
    demand = {
        watch = 1.12,
        jewelry = 0.94,
        gold = 0.90,
    },
    -- [AUDIT ECONOMY] Global fence haircut. Robbery used to pay 20-50x legal
    -- hourly income; 0.5 halves all fence offers on top of demand/variance,
    -- keeping crime profitable but no longer the dominant money path.
    globalFactor = 0.5,
}

SunsetRobbery.LootTables = {
    watches = {
        { id = 'stolen_silver_watch', labelKey = "config.robbery.label.silver_watch.3a25c495", label = 'Silver Watch', tier = 'COMMON', weight = 1, baseValue = 283, rarity = 45, family = 'watch' },
        { id = 'stolen_luxury_watch', labelKey = "config.robbery.label.luxury_watch.4bf2c6fe", label = 'Luxury Watch', tier = 'RARE', weight = 1, baseValue = 1400, rarity = 28, family = 'watch' },
        { id = 'stolen_gold_watch', labelKey = "config.robbery.label.gold_watch.04a96257", label = 'Gold Watch', tier = 'RARE', weight = 1, baseValue = 1200, rarity = 18, family = 'watch' },
        { id = 'stolen_diamond_watch', labelKey = "config.robbery.label.diamond_watch.6247a931", label = 'Diamond Watch', tier = 'EPIC', weight = 2, baseValue = 2600, rarity = 7, family = 'watch' },
        { id = 'stolen_collector_watch', labelKey = "config.robbery.label.collector_watch.11bd1107", label = 'Collector Watch', tier = 'VERY_RARE', weight = 2, baseValue = 4166, rarity = 2, family = 'watch' },
    },
    jewelry = {
        { id = 'stolen_bracelet', labelKey = "config.robbery.label.basic_bracelet.2f01a22d", label = 'Basic Bracelet', tier = 'COMMON', weight = 1, baseValue = 206, rarity = 42, family = 'jewelry' },
        { id = 'stolen_gold_chain', labelKey = "config.robbery.label.gold_chain.117540a4", label = 'Gold Chain', tier = 'RARE', weight = 1, baseValue = 966, rarity = 26, family = 'gold' },
        { id = 'stolen_gold_bracelet', labelKey = "config.robbery.label.gold_bracelet.a6976a6f", label = 'Gold Bracelet', tier = 'RARE', weight = 1, baseValue = 800, rarity = 20, family = 'gold' },
        { id = 'stolen_diamond_jewelry', labelKey = "config.robbery.label.designer_jewelry.04ef95fe", label = 'Designer Jewelry', tier = 'EPIC', weight = 2, baseValue = 2300, rarity = 9, family = 'jewelry' },
        { id = 'stolen_collector_watch', labelKey = "config.robbery.label.collector_piece.005b6911", label = 'Collector Piece', tier = 'VERY_RARE', weight = 2, baseValue = 3666, rarity = 3, family = 'jewelry' },
    },
    vault = {
        { id = 'stolen_silver_watch', labelKey = "config.robbery.label.banded_cash_stack.b67151fe", label = 'Banded Cash Stack', tier = 'COMMON', weight = 1, baseValue = 950, rarity = 40, family = 'cash' },
        { id = 'stolen_gold_chain', labelKey = "config.robbery.label.small_gold_bullion.ac82aac1", label = 'Small Gold Bullion', tier = 'RARE', weight = 2, baseValue = 2800, rarity = 25, family = 'gold' },
        { id = 'stolen_diamond_jewelry', labelKey = "config.robbery.label.bearer_bonds.5bbfc70c", label = 'Bearer Bonds', tier = 'EPIC', weight = 1, baseValue = 4500, rarity = 12, family = 'bonds' },
        { id = 'stolen_collector_watch', labelKey = "config.robbery.label.safety_deposit_box.1980dd9d", label = 'Safety Deposit Box', tier = 'VERY_RARE', weight = 3, baseValue = 7500, rarity = 5, family = 'jewelry' },
    },
}

SunsetRobbery.SellVariance = { min = 0.50, max = 0.68 }

SunsetRobbery.Animations = {
    hack = { dict = 'anim@heists@keypad@', clip = 'idle_a', flag = 49 },
    smash = { dict = 'missheist_jewel', clip = 'smash_case', flag = 0 },
    grab = { dict = 'missheist_jewel', clip = 'pickup_necklace_e', flag = 0 },
    bag = { dict = 'anim@heists@ornate_bank@ig_4_grab_gold', clip = 'idle', flag = 49 },
    fence = { dict = 'mp_common', clip = 'givetake1_a', flag = 0 },
}

SunsetRobbery.Sounds = {
    hackOk = { name = 'Hack_Success', set = 'DLC_HEIST_FLEECA_SOUNDSET' },
    hackFail = { name = 'Hack_Failed', set = 'DLC_HEIST_FLEECA_SOUNDSET' },
    glass = { name = 'Glass_Smash', set = 'BREATHING_SWIM_SOUNDSET' },
    pickup = { name = 'PICK_UP', set = 'HUD_FRONTEND_DEFAULT_SOUNDSET' },
    bag = { name = 'PICK_UP_WEAPON', set = 'HUD_FRONTEND_CUSTOM_SOUNDSET' },
}

SunsetRobbery.BagProp = {
    model = `prop_cs_heist_bag_02`,
    bone = 24818,
    pos = vector3(0.06, -0.22, -0.02),
    rot = vector3(0.0, 90.0, 180.0),
}

SunsetRobbery.Locations = {
    luxury_store = {
        id = 'luxury_store',
        labelKey = "config.robbery.label.vangelico_luxury_watches.cb4dcf19", label = 'Vangelico Luxury Watches',
        street = 'Rockford Drive',
        zone = 'Rockford Hills',
        coords = vector3(-622.25, -230.93, 38.06),
        radius = 22.0,
        minPolice = nil,
        startHint = '[E] Start robbery',
        blip = { sprite = 617, color = 1, scale = 0.9, labelKey = "config.robbery.label.robbery_vangelico.25343d1c", label = 'Robbery — Vangelico' },
        entrance = {
            coords = vector3(-631.04, -237.76, 38.08),
            radius = 5.0,
        },
        doors = {
            { model = `p_jewel_door_l`, coords = vector3(-631.96, -236.33, 38.21) },
            { model = `p_jewel_door_r`, coords = vector3(-630.43, -238.44, 38.21) },
        },
        hackTerminal = {
            coords = vector3(-631.02, -230.06, 38.06),
            heading = 35.0,
            labelKey = "config.robbery.label.e_bypass_security.970377fd", label = '[E] Bypass security',
        },
        displays = {
            { id = 'd1', coords = vector3(-626.73, -235.42, 38.06), lootTable = 'watches', labelKey = "config.robbery.label.luxury_watches.7fe0691d", label = 'Luxury Watches' },
            { id = 'd2', coords = vector3(-625.68, -237.46, 38.06), lootTable = 'watches', labelKey = "config.robbery.label.display_watches.910161a8", label = 'Display Watches' },
            { id = 'd3', coords = vector3(-623.08, -232.96, 38.06), lootTable = 'jewelry', labelKey = "config.robbery.label.diamond_jewelry.7892eee0", label = 'Diamond Jewelry' },
            { id = 'd4', coords = vector3(-620.24, -234.38, 38.06), lootTable = 'jewelry', labelKey = "config.robbery.label.designer_case.93f20051", label = 'Designer Case' },
            { id = 'd5', coords = vector3(-617.86, -230.48, 38.06), lootTable = 'watches', labelKey = "config.robbery.label.gold_watches.4afef2f5", label = 'Gold Watches' },
            { id = 'd6', coords = vector3(-619.20, -227.28, 38.06), lootTable = 'jewelry', labelKey = "config.robbery.label.gold_bracelets.2059284c", label = 'Gold Bracelets' },
        },
    },
    fleeca_legion = {
        id = 'fleeca_legion',
        labelKey = "config.robbery.label.fleeca_bank_legion.a53540e7", label = 'Fleeca Bank Legion',
        street = 'Legion Square',
        zone = 'Downtown',
        coords = vector3(147.05, -1044.88, 29.37),
        radius = 20.0,
        minPolice = 3,
        startHint = '[E] Rob Fleeca Bank',
        blip = { sprite = 500, color = 2, scale = 0.9, labelKey = "config.robbery.label.bank_fleeca_legion.abe4ffa9", label = 'Bank — Fleeca Legion' },
        entrance = {
            coords = vector3(149.20, -1040.50, 29.37),
            radius = 4.0,
        },
        -- [FLEECA FIX] Vault door (v_ilev_gb_vauldoor) is articulated and animated
        -- manually via world.lua heading rotation. Normal doors array is empty so
        -- DoorSystem does not fight the manual rotation.
        doors = {
            { model = `v_ilev_gb_teldr`, coords = vector3(145.42, -1041.81, 29.64) },
        },
        vaultOnHackSuccess = true, -- doors only unlock and swing AFTER a successful hack
        vault = {
            model = `v_ilev_gb_vauldr`,
            coords = vector3(148.03, -1044.36, 29.51),
            searchRadius = 5.0,
            closedHeading = 249.85,
            openDelta = -90.0,
            openMs = 2500,
            closeMs = 2000,
        },
        hackTerminal = {
            coords = vector3(147.89, -1043.29, 29.47),
            heading = 250.0,
            labelKey = "config.robbery.label.e_hack_vault_keypad.7499e51f", label = '[E] Hack vault keypad',
        },
        -- Loot points inside the actual Fleeca Legion vault room
        displays = {
            { id = 'fb1', coords = vector3(146.70, -1048.90, 29.37), lootTable = 'vault', labelKey = "config.robbery.label.safety_deposit_row_a.0d98eb5e", label = 'Safety Deposit Row A' },
            { id = 'fb2', coords = vector3(148.20, -1048.90, 29.37), lootTable = 'vault', labelKey = "config.robbery.label.cash_safe_compartment.49413989", label = 'Cash Safe Compartment' },
            { id = 'fb3', coords = vector3(146.70, -1050.40, 29.37), lootTable = 'vault', labelKey = "config.robbery.label.safety_deposit_row_b.c93a2071", label = 'Safety Deposit Row B' },
            { id = 'fb4', coords = vector3(148.20, -1050.40, 29.37), lootTable = 'vault', labelKey = "config.robbery.label.teller_vault_box.b4edd0ee", label = 'Teller Vault Box' },
        },
    },
}
