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
            minLevel = 5,
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
    },

    hunter = {
        jobId = 'hunter',
        jobLabel = 'Hunter',
        locationLabel = 'Sandy Shores Hunting Lodge',
        address = 'Hunting Lodge, Sandy Shores, Blaine County',
        description = 'Take on wildlife management contracts across Blaine County. Requires Character Level 10, a valid Firearm License and Hunting License.',
        npc = {
            id = 'mason_hunter',
            name = 'Mason',
            title = 'Hunting Guide',
            model = 's_m_m_highsec_01',
            coords = vector4(1838.0, 3673.0, 34.2, 290.0),
            scenario = 'WORLD_HUMAN_SMOKING',
            icon = 'ph-target',
            badgeClass = 'hunter',
            badge = 'HUNTING LODGE',
        },
        guide = {
            title = 'Hunter Career Guide',
            steps = {
                '1. Reach Level 10 and ensure you hold a valid Firearm License and Hunting License (from LSSI).',
                '2. Apply as Hunter with Mason at the Hunting Lodge.',
                '3. Start a shift and choose a Hunting Contract from the board.',
                '4. Travel to the assigned zone. No exact animal GPS — track them.',
                '5. Shoot humanely with an approved firearm (bolt-action rifle preferred).',
                '6. Inspect the carcass, then Harvest to collect meat, hide, and trophies.',
                '7. Return to Mason to Sell Harvest and complete the contract.',
            },
        },
        requirements = {
            minLevel = 10,
            licenses = { 'weapon', 'hunting' },
        },
        actions = {
            apply = true,
            startShift = true,
            stopShift = true,
            guide = true,
            quitJob = true,
            special = {
                { id = 'contracts',    label = 'Hunting Contracts',  icon = 'ph-list-bullets' },
                { id = 'equipment',    label = 'Equipment',           icon = 'ph-backpack'     },
                { id = 'sell_harvest', label = 'Sell Harvest',        icon = 'ph-currency-dollar' },
            },
        },
    },

    diver = {
        jobId = 'diver',
        jobLabel = 'Marine Salvage Diver',
        locationLabel = 'Vespucci Marine Salvage',
        address = 'Vespucci Canals Waterfront, South LS',
        description = 'Recover submerged cargo, electronics, and artifacts from coastal wrecks.',
        npc = {
            id = 'terry_diver',
            name = 'Terry',
            title = 'Dive Contractor',
            model = 's_m_m_dockwork_01',
            coords = vector4(-812.0, -1282.0, 5.0, 270.0),
            scenario = 'WORLD_HUMAN_CLIPBOARD',
            icon = 'ph-waves',
            badgeClass = 'diver',
            badge = 'MARINE SALVAGE',
        },
        guide = {
            title = 'Marine Salvage Career Guide',
            steps = {
                '1. Reach Level 6 and apply as Diver with Terry at the Vespucci waterfront.',
                '2. Rent Diving Gear (required before diving).',
                '3. Start a shift and choose a Salvage Contract.',
                '4. Travel to the search area — no exact marker, use your detector underwater.',
                '5. Dive, locate cargo with the sonar detector, and recover salvage.',
                '6. Return to Terry with your salvage to complete the contract and sell.',
                '7. Offshore sites require a Boat License and a rented work boat.',
            },
        },
        requirements = {
            minLevel = 6,
            licenses = {},  -- No baseline license; boat license checked per-contract
        },
        actions = {
            apply = true,
            startShift = true,
            stopShift = true,
            guide = true,
            quitJob = true,
            special = {
                { id = 'contracts',  label = 'Salvage Contracts',  icon = 'ph-anchor'       },
                { id = 'rent_gear',  label = 'Rent Diving Gear',   icon = 'ph-waves'        },
                { id = 'rent_boat',  label = 'Rent Work Boat',     icon = 'ph-boat'         },
                { id = 'sell',       label = 'Sell Salvage',       icon = 'ph-currency-dollar' },
            },
        },
    },

    busdriver = {
        jobId = 'busdriver',
        jobLabel = 'Bus Driver',
        locationLabel = 'Transit Terminal',
        address = 'Integrity Way / Pillbox Hill Transit Center',
        description = 'Operate scheduled public bus lines across Los Santos. Pick up waiting passengers at bus stops, issue tickets, and earn passenger fares + transit bonuses.',
        npc = {
            id = 'workplace_busdriver',
            name = 'Gus - Transit Dispatcher',
            title = 'Operations Supervisor',
            model = 's_m_m_cntrybar_01',
            coords = vector4(435.44, -646.28, 28.74, 124.73),
            scenario = 'WORLD_HUMAN_CLIPBOARD',
            icon = 'ph-bus',
            badgeClass = 'busdriver',
            badge = 'TRANSIT DEPOT',
        },
        guide = {
            title = 'Bus Driver Career Guide',
            steps = {
                '1. Apply as a Bus Driver with Dispatcher Gus at the Transit Terminal.',
                '2. Start your shift to dispatch an official LS Transit Bus.',
                '3. Follow the Green Line route markers to each designated bus stop in order.',
                '4. Pull into the bus bay, stop and press [E] to board waiting passengers.',
                '5. Complete all scheduled stops and return the bus to the depot for your route completion bonus.'
            }
        },
        requirements = {
            minLevel = 4,
            licenses = { 'driver' },
            progressionGate = 'job.busdriver',
        },
        actions = {
            apply = true,
            startShift = true,
            stopShift = true,
            guide = true,
            quitJob = true,
        },
    },
}

