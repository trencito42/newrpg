Sunset = Sunset or {}

--- Physical Workplaces and Dispatcher NPCs for Civilian Jobs
Sunset.JobWorkplaces = {
    fisherman = {
        jobId = 'fisherman',
        jobLabel = 'Fisherman',
        locationLabel = 'Paleto Waterfront',
        address = 'Procopio Drive, Paleto Bay',
        description = 'Catch fresh fish along the northern coastline and pontoon, then sell your haul at local stores.',
        npc = {
            id = 'workplace_fisherman',
            name = 'Billy Ray',
            title = 'Master Angler',
            model = 'a_m_m_hillbilly_01',
            coords = vector4(-1593.23, 5207.74, 3.31, 25.49),
            scenario = 'WORLD_HUMAN_STAND_IMPATIENT',
            icon = 'ph-fish',
            badgeClass = 'fishing',
            badge = 'FISHING WORKPLACE',
        },
        secondaryLocation = {
            label = 'Bait & Tackle Shop',
            coords = vector3(-1602.11, 5203.87, 4.31),
        },
        guide = {
            title = 'Fisherman Career Guide',
            steps = {
                '1. Buy bait and a fishing rod from Billy Ray or local 24/7 stores.',
                '2. Head to the Paleto Bay waterfront or pontoon area.',
                '3. Press [E] to cast your line into the water and wait for a bite.',
                '4. Follow the minigame prompts to successfully reel in the fish.',
                '5. Sell your fresh catch to Billy Ray or any 24/7 store cashier.'
            }
        },
        requirements = {
            minLevel = 1,
            licenses = {},
        },
        actions = {
            apply = true,
            startShift = true,
            stopShift = true,
            guide = true,
            quitJob = true,
            special = {
                { id = 'open_bait_shop', label = 'Bait & Tackle Shop', icon = 'ph-shopping-bag', group = 'EQUIPMENT' },
                { id = 'sell_fish', label = 'Sell Fresh Catch', icon = 'ph-currency-dollar', group = 'EQUIPMENT' },
            }
        },
    },

    trucker = {
        jobId = 'trucker',
        jobLabel = 'Trucker',
        locationLabel = 'Port of Los Santos',
        address = 'Terminal Way, Port of LS',
        description = 'Haul heavy industrial cargo and fuel tanker trailers across San Andreas highway networks.',
        npc = {
            id = 'workplace_trucker',
            name = 'Earl - Depot Dispatcher',
            title = 'Freight Supervisor',
            model = 'g_m_y_strpunk_02',
            coords = vector4(1200.59, -3107.89, 6.03, 312.11),
            scenario = 'WORLD_HUMAN_CLIPBOARD',
            icon = 'ph-truck',
            badgeClass = 'trucker',
            badge = 'TRUCKER DEPOT',
        },
        secondaryLocation = {
            label = 'Route Laptop',
            coords = vector4(1207.92, -3114.87, 5.54, 259.54),
        },
        guide = {
            title = 'Trucker Career Guide',
            steps = {
                '1. Apply as a Trucker with Dispatcher Earl at the dock depot.',
                '2. Use the Route Laptop inside the office to select a delivery contract.',
                '3. Hitch your truck to the assigned trailer in the loading bay.',
                '4. Follow GPS navigation to the destination delivery entrance.',
                '5. Choose Quick Deliver [E] or Manual Docking [G] in the bay for bonus pay.'
            }
        },
        requirements = {
            minLevel = 1,
            licenses = { 'driver' },
        },
        actions = {
            apply = true,
            startShift = false, -- Shift is initiated via route selection on the laptop
            stopShift = true,
            guide = true,
            quitJob = true,
            special = {
                { id = 'open_laptop', label = 'Open Route Laptop', icon = 'ph-laptop', group = 'DISPATCH' },
            }
        },
    },

    garbage = {
        jobId = 'garbage',
        jobLabel = 'Garbage Collector',
        locationLabel = 'Davis Sanitation Yard',
        address = 'Innocence Blvd, Davis',
        description = 'Collect waste routes across city neighborhoods and unload at the central compaction depot.',
        npc = {
            id = 'workplace_garbage',
            name = 'Sal - Sanitation Foreman',
            title = 'Sanitation Supervisor',
            model = 's_m_y_garbage',
            coords = vector4(-321.70, -1545.94, 27.72, 270.0),
            scenario = 'WORLD_HUMAN_CLIPBOARD',
            icon = 'ph-trash',
            badgeClass = 'garbage',
            badge = 'SANITATION DEPOT',
        },
        secondaryLocation = {
            label = 'Compaction Unload Bay',
            coords = vector3(-350.45, -1560.22, 25.22),
        },
        guide = {
            title = 'Garbage Collector Career Guide',
            steps = {
                '1. Apply with Foreman Sal at the Davis Sanitation Yard.',
                '2. Start your route to dispatch a company Trashmaster truck.',
                '3. Drive to each authored bin stop in sequence along the route.',
                '4. Pick up trash bags [E] and toss them into the rear hopper.',
                '5. Return to the depot unload zone to compact and collect your payout.'
            }
        },
        requirements = {
            minLevel = 1,
            licenses = { 'driver' },
        },
        actions = {
            apply = true,
            startShift = true,
            stopShift = true,
            guide = true,
            quitJob = true,
        },
    },

    courier = {
        jobId = 'courier',
        jobLabel = 'Courier',
        locationLabel = 'Post OP Warehouse',
        address = 'Elysian Fields Fwy, Terminal',
        description = 'Load parcel crates at the distribution warehouse and make door-to-door deliveries.',
        npc = {
            id = 'workplace_courier',
            name = 'Artie - Parcel Dispatcher',
            title = 'Logistics Coordinator',
            model = 's_m_m_postal_01',
            coords = vector4(78.45, 112.22, 81.16, 160.0),
            scenario = 'WORLD_HUMAN_CLIPBOARD',
            icon = 'ph-package',
            badgeClass = 'courier',
            badge = 'POST OP DEPOT',
        },
        secondaryLocation = {
            label = 'Loading Dock',
            coords = vector4(112.48, 103.98, 81.15, 346.18),
        },
        guide = {
            title = 'Courier Career Guide',
            steps = {
                '1. Apply with Dispatcher Artie at the Post OP warehouse.',
                '2. Start your delivery run to spawn your delivery van.',
                '3. Park at the loading bay, pick up packages [E] and load them into the back of your van.',
                '4. Follow GPS to each recipient address and deliver the package on foot.',
                '5. Complete all assigned drop-offs to earn your delivery commission.'
            }
        },
        requirements = {
            minLevel = 1,
            licenses = { 'driver' },
        },
        actions = {
            apply = true,
            startShift = true,
            stopShift = true,
            guide = true,
            quitJob = true,
        },
    }
}
