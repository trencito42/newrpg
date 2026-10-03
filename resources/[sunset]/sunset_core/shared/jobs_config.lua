Sunset = Sunset or {}

--- Civilian job gameplay config (depots, routes, payouts). Hire data in jobs_civilian.lua.
Sunset.JobsConfig = {
    trucker = {
        label = 'Trucker',
        help = 'Go to the depot, spawn your rig, pick up cargo, deliver, then return the truck. Use /recovertrailer if your trailer detaches or is destroyed.',
        depot = {
            coords = vector3(1208.77, -3114.84, 5.54),
            -- Spawn & Return camion Phantom la depou (h=266.29).
            spawn        = vector4(1195.16, -3099.54, 5.93, 266.29),
            returnCoords = vector4(1195.16, -3099.54, 5.93, 266.29),
            -- Locatii de spawn pentru remorci (bays)
            trailerBays  = {
                vector4(1234.3, -3104.2, 4.8, 3.5),
                vector4(1219.3, -3104.1, 4.8, 3.5),
                vector4(1178.8, -3135.6, 4.6, 89.4),
                vector4(1178.8, -3148.8, 4.6, 89.4),
                vector4(1178.8, -3155.9, 4.6, 89.4),
            },
            trailerSpawn = vector4(1234.3, -3104.2, 4.8, 3.5),
            blip = { sprite = 477, color = 5, scale = 0.85 },
        },
        -- Truck model pool per delivery category.
        -- hasTrailer = true  → spawn + validate a cargo trailer (semi routes).
        categoryTrucks = {
            fuel = { models = {'phantom'}, hasTrailer = true, trailerModel = 'tanker' },
        },
        truckModel   = 'phantom',
        trailerModel = 'tanker',
        routes = {
            -- ── Fuel (Phantom + tanker — designated trailer bays at depot) ───
            { category = 'fuel', pay = 650,
              pickup     = vector4(1234.3, -3104.2, 4.8, 3.5),
              delivery   = vector4(-1434.9, -298.1, 45.1, 311.2),
              parkingBay = vector4(-1434.1, -250.7, 48.0, 131.9),
              label      = 'Depot → West Eclipse Gas Station' },
            { category = 'fuel', pay = 700,
              pickup   = vector4(1219.3, -3104.1, 4.8, 3.5),
              delivery = vector3(1181.2, 2671.5, 37.9),
              label    = 'Depot → Sandy Shores Gas Station' },
            { category = 'fuel', pay = 750,
              pickup   = vector4(1178.8, -3135.6, 4.6, 89.4),
              delivery = vector3(1702.55, 6416.12, 32.76),
              label    = 'Depot → Paleto Bay Gas Station' },
            { category = 'fuel', pay = 800,
              pickup   = vector4(1178.8, -3148.8, 4.6, 89.4),
              delivery = vector3(2747.32, 3472.88, 55.67),
              label    = 'Depot → Sandy Shores Refinery' },
            { category = 'fuel', pay = 900,
              pickup   = vector4(1178.8, -3155.9, 4.6, 89.4),
              delivery = vector3(-1710.29, 4924.05, 42.06),
              label    = 'Depot → Grapeseed Gas Station' },
        },
        xpPerDelivery = 45,
        timeoutSec = 1800,
        deliveryRadius = 85.0,
        deliveryZTolerance = 15.0,
        manualParkingRadius = 4.5,
        manualParkingAngleTolerance = 35.0,
        manualParkingBonusMultiplier = 2.0, -- 2x pay & xp for manual docking
        returnRadius = 25.0,
        requiresWorkVehicle = true,
        vehicleExitGraceSec = 60,
        failOnWorkVehicleLoss = true, -- [JOBS AUTHORITY] wrecked/deleted work vehicle fails the shift, no reward
        requiresAttachedTrailer = true,
        trailerGraceSec = 60,
        trailerRecoveryCooldownSec = 180,
        trailerRecoveryMaxUses = 3,
        trailerRecoveryMaxDistance = 30.0,
        trailerLossPartialPayFraction = 0.5,
    },

    garbage = {
        label = 'Garbage Collector',
        help = 'Drive to bins, pick up trash (E), dump at the truck rear, then unload at the depot when full.',
        depot = {
            coords = vector3(-321.70, -1545.94, 27.72),
            spawn = vector4(-341.12, -1530.45, 27.72, 270.0),
            unload = vector3(-350.45, -1560.22, 25.22),
            blip = { sprite = 318, color = 2, scale = 0.85 },
        },
        truckModel = 'trash',
        capacity = 8,
        bins = {
            vector3(-128.45, -1415.22, 29.35),
            vector3(45.12, -1398.55, 29.35),
            vector3(180.88, -1315.45, 29.22),
            vector3(295.45, -1270.12, 29.45),
            vector3(-55.22, -1755.88, 29.42),
            vector3(120.55, -1688.22, 29.30),
            vector3(380.12, -1512.45, 29.28),
            vector3(510.88, -1455.22, 29.28),
            vector3(-200.45, -1605.12, 33.48),
            vector3(-350.22, -1470.88, 30.55),
        },
        payPerBin = 48,
        payPerUnload = 120,
        xpPerBin = 12,
        xpPerUnload = 30,
        collectRadius = 3.0,
        dumpRadius = 3.5,
        truckRearOffset = -4.5,
        timeoutSec = 1500,
        requiresWorkVehicle = true,
        vehicleExitGraceSec = 60,
        failOnWorkVehicleLoss = true, -- [JOBS AUTHORITY] wrecked/deleted work vehicle fails the shift, no reward
    },

    courier = {
        label = 'Courier',
        help = 'Spawn your van, load all packages at the warehouse loading dock, then deliver them door-to-door without returning between stops.',
        warehouse = {
            coords = vector3(112.48, 103.98, 81.15),
            blip = { sprite = 478, color = 3, scale = 0.85 },
        },
        packagePickup = vector4(112.48, 103.98, 81.15, 346.18),
        loadingBay = vector4(118.0, 99.5, 80.7, 251.6),
        -- Van spawns at the parking lot
        vehicleModel = 'speedo',
        vehicleSpawn = vector4(62.8, 123.7, 78.9, 161.0),
        deliveries = {
            { coords = vector3(-47.22, -1758.45, 29.42),  label = 'Davis Ave' },
            { coords = vector3(213.88, -810.45, 30.73),   label = 'Legion Square' },
            { coords = vector3(-706.22, -914.55, 19.22),  label = 'Little Seoul' },
            { coords = vector3(373.45, -828.22, 29.28),   label = 'Pillbox Hill' },
            { coords = vector3(-1288.45, -1115.22, 6.99), label = 'Vespucci Canals' },
            { coords = vector3(127.55, -1298.88, 29.22),  label = 'Strawberry' },
            { coords = vector3(-540.22, -183.55, 37.65),  label = 'Rockford Hills' },
        },
        packageProp = 'prop_cs_cardbox_01',
        packagesPerRun = 6,
        failOnWorkVehicleLoss = true, -- destroy the van mid-route => shift cancelled, no further pay
        payPerPackage = 90,
        xpPerPackage = 18,
        deliveryRadius = 3.0,
        loadingRadius = 3.5,
        vanRearOffset = -3.2,
        dumpRadius = 3.8,
        pickupZTolerance = 5.0,
        timeoutSec = 1500,
    },

    fisherman = {
        label = 'Fisherman',
        help = 'Fish in the Paleto Bay area near Billy Ray, then sell your catch at any 24/7 store.',
        -- [ZONE FIX] The fishing spot is the measured water/pontoon area, NOT the
        -- NPC position. GPS/objective point here on shift start.
        -- Derived from the centroid of the previously measured waterfront strip.
        spots = {
            { coords = vector3(-1600.56, 5237.43, 1.0) },
        },
        -- [ZONE FIX] Old polygon spanned y=5211..5265 only — it lay entirely
        -- NORTH of Billy Ray (y=5207.74) and the bait shop (y=5203.87), so the
        -- ray-casting test returned false at every real fishing position and
        -- /fish always answered "not in the Paleto Bay fishing area".
        -- New zone covers both VERIFIED anchors (Billy Ray, bait shop) plus the
        -- previously measured waterfront strip, i.e. the whole pier/waterfront.
        -- Rectangle: x -1620..-1578, y 5195..5268.
        -- Refine with /fishdebug in-game if the shoreline needs tightening.
        fishZone = {
            { x = -1660.00, y = 5175.00 },
            { x = -1560.00, y = 5175.00 },
            { x = -1560.00, y = 5295.00 },
            { x = -1660.00, y = 5295.00 },
        },
        fishZoneMinZ = -10.0,   -- include barca pe apa
        fishZoneMaxZ = 25.0,   -- include pontoon/dig ridicat/catwalk
        biteDelayMinMs = 2500,
        biteDelayMaxMs = 6500,
        reactionWindowMs = 1500,
        catchRadius    = 60.0,   -- fallback daca fishZone lipseste
        catchZTolerance = 15.0,  -- fallback Z tolerance
        markerSize     = 2.0,    -- visible water marker at the fishing spot
        markerDrawRadius = 80.0, -- draw it while approaching on shift
        -- [FIX] sellPoint was missing — cfg.sellPoint.coords crashed on
        -- every sell attempt. Coordinates from items.lua 24/7 Paleto Bay.
        sellPoint = { coords = vector3(-54.37, 6244.70, 31.09) },
        sellRadius = 5.0,
        catchPayMin = 28,
        catchPayMax = 85,
        fishItem = 'fresh_fish',
        carryBase = 2,
        carryPerLevel = 1,
        carryMax = 12,
        xpPerCatch = 15,
        sellBonusMultiplier = 1.15,
        timeoutSec = 900,
    },

    hunter = {
        label = 'Hunter',
        help = 'Choose a hunting contract, travel to the zone, track and harvest wildlife. Requires Firearm and Hunting Licenses.',
        timeoutSec = 7200,

        -- Licensed hunting firearms (reward quality penalty for others)
        approvedWeapons = {
            ['WEAPON_SNIPERRIFLE']     = { tier = 'hunting',   qualityBonus = 5  },
            ['WEAPON_MARKSMANRIFLE']   = { tier = 'hunting',   qualityBonus = 0  },
            ['WEAPON_MARKSMANRIFLE_MK2'] = { tier = 'hunting', qualityBonus = 0  },
            ['WEAPON_HEAVYSNIPER']     = { tier = 'heavy',     qualityBonus = -5 },
            ['WEAPON_HEAVYSNIPER_MK2'] = { tier = 'heavy',     qualityBonus = -5 },
            ['WEAPON_PUMPSHOTGUN']     = { tier = 'shotgun',   qualityBonus = -10 },
        },

        species = {
            deer = {
                model = 'a_c_deer',
                label = 'Deer',
                minRank = 1,
                protected = false,
                weightMin = 55.0,
                weightMax = 110.0,
                meatItem = 'venison',
                hideItem = 'animal_hide',
                trophyItem = 'antlers',
                trophyMinQuality = 70,
                meatYieldMin = 8.0,
                meatYieldMax = 22.0,
                baseValue = 12,
            },
            boar = {
                model = 'a_c_boar',
                label = 'Wild Boar',
                minRank = 2,
                protected = false,
                weightMin = 40.0,
                weightMax = 95.0,
                meatItem = 'boar_meat',
                hideItem = 'animal_hide',
                trophyItem = nil,
                meatYieldMin = 6.0,
                meatYieldMax = 18.0,
                baseValue = 10,
            },
            coyote = {
                model = 'a_c_coyote',
                label = 'Coyote',
                minRank = 3,
                protected = false,
                weightMin = 10.0,
                weightMax = 22.0,
                meatItem = nil,
                hideItem = 'coyote_pelt',
                trophyItem = nil,
                meatYieldMin = 0,
                meatYieldMax = 0,
                baseValue = 18,
            },
        },

        -- Rank thresholds and unlock descriptions
        ranks = {
            [1] = { label = 'Novice',        xpRequired = 0,    unlocks = 'Deer contracts, Paleto Forest zone' },
            [2] = { label = 'Tracker',        xpRequired = 200,  unlocks = 'Boar contracts, Alamo Sea Hills zone' },
            [3] = { label = 'Marksman',       xpRequired = 500,  unlocks = 'Coyote contracts, night-time zone access' },
            [4] = { label = 'Guide',          xpRequired = 1000, unlocks = 'Trophy contracts, premium payout multiplier' },
            [5] = { label = 'Master Hunter',  xpRequired = 2000, unlocks = 'Rare high-difficulty hunts' },
        },

        contracts = {
            {
                id = 'deer_paleto_01',
                label = 'Paleto Deer Control',
                description = 'Manage deer population in Paleto Forest.',
                species = 'deer',
                requiredHarvests = 3,
                minRank = 1,
                zoneId = 'paleto_forest_01',
                pay = 320,
                xp = 90,
            },
            {
                id = 'boar_alamo_01',
                label = 'Alamo Boar Control',
                description = 'Control the wild boar numbers in the Alamo Sea hills.',
                species = 'boar',
                requiredHarvests = 3,
                minRank = 2,
                zoneId = 'alamo_hills_01',
                pay = 420,
                xp = 120,
            },
            {
                id = 'coyote_blaine_01',
                label = 'Blaine Coyote Control',
                description = 'Reduce predator numbers in the Sandy Shores area.',
                species = 'coyote',
                requiredHarvests = 2,
                minRank = 3,
                zoneId = 'sandy_shores_01',
                pay = 560,
                xp = 160,
            },
            {
                id = 'deer_trophy_01',
                label = 'Trophy Buck',
                description = 'Harvest one high-quality qualifying deer. Shot discipline matters.',
                species = 'deer',
                requiredHarvests = 1,
                minRank = 4,
                zoneId = 'paleto_forest_01',
                pay = 850,
                xp = 250,
                trophyRequired = true,
            },
        },

        -- Quality calculation weights
        qualityBaseScore  = 100,
        qualityPenaltyExtraShot = 15,
        qualityPenaltyHeadshot  = 10,
        qualityPenaltyBadWeapon = 25,
        qualityPenaltyVehicle   = 100,
        qualityPenaltyFire      = 100,
        qualityPenaltyExplosive = 100,

        -- Sell price multipliers by grade
        gradeMultiplier = {
            pristine  = 1.00,
            good      = 0.75,
            fair      = 0.50,
            poor      = 0.25,
        },

        harvestRadius = 4.0,
        harvestOwnerWindowSec = 60,
        animalPopCap = 6,
        animalRespawnSec = 180,
        trackingClueRadius = 80.0,
        xpPerHarvest = 30,
        xpPerContract = 60,
    },

    diver = {
        label = 'Marine Salvage Diver',
        help = 'Pick a salvage contract, dive to the search area, use the detector to locate cargo, and return to sell.',
        timeoutSec = 5400,

        ranks = {
            [1] = { label = 'Snorkeler',      xpRequired = 0,    unlocks = 'Nearshore sites, basic scuba gear' },
            [2] = { label = 'Open Water',     xpRequired = 200,  unlocks = 'Offshore sites (requires Boat License)' },
            [3] = { label = 'Advanced Diver', xpRequired = 500,  unlocks = 'Deeper wrecks, improved detector' },
            [4] = { label = 'Rescue Diver',   xpRequired = 1000, unlocks = 'Aircraft / cargo wrecks' },
            [5] = { label = 'Master Diver',   xpRequired = 2000, unlocks = 'Rare deep salvage contracts' },
        },

        -- Scuba gear tiers (rented at workplace).
        -- [SECTION 25] Key is o2Duration (seconds) everywhere in code — do NOT rename to o2Seconds.
        -- server/diver.lua reads gearCfg.o2Duration; changing the key here without changing
        -- server reads caused all tiers to silently fall back to 120s (basic tier only).
        gear = {
            basic    = { label = 'Basic Scuba Set',    o2Duration = 120, minRank = 1, rentCost = 30  },
            standard = { label = 'Standard Tank',      o2Duration = 200, minRank = 2, rentCost = 60  },
            advanced = { label = 'Advanced Tank',      o2Duration = 320, minRank = 3, rentCost = 100 },
        },

        -- Detector radius at which each pulse tier activates
        detectorFar    = 30.0,  -- slow pulse
        detectorMid    = 15.0,  -- medium pulse
        detectorClose  = 5.0,   -- fast pulse + world highlight
        detectorItemHash = 'WEAPON_FLASHLIGHT',  -- equip anim only

        boatModel = 'dinghy',
        boatRentCost = 80,
        salvageRadius = 4.0,   -- max distance to interact with loot point
        lootPerContract = 4,   -- active loot points selected from site's authored pool

        xpPerSalvage = 25,
        xpPerContract = 80,

        -- Loot table per site difficulty
        lootTables = {
            easy   = {
                { item = 'salvage_parts',      weight = 50, value = 120 },
                { item = 'sealed_cargo',        weight = 35, value = 200 },
                { item = 'marine_electronics',  weight = 15, value = 350 },
            },
            medium = {
                { item = 'salvage_parts',      weight = 35, value = 160 },
                { item = 'sealed_cargo',        weight = 35, value = 280 },
                { item = 'marine_electronics',  weight = 20, value = 450 },
                { item = 'marine_artifact',     weight = 10, value = 650 },
            },
            hard   = {
                { item = 'sealed_cargo',        weight = 30, value = 320 },
                { item = 'marine_electronics',  weight = 30, value = 550 },
                { item = 'marine_artifact',     weight = 30, value = 800 },
                { item = 'marine_artifact',     weight = 10, value = 1200 },
            },
        },
    },

    mechanic = {
        label = 'Roadside Mechanic',
        help = 'Go on duty to accept /service mechanic calls. Repair vehicles to earn pay.',
        depot = {
            coords = vector3(-347.45, -133.22, 39.01),
            blip = { sprite = 402, color = 47, scale = 0.85 },
        },
        repairRadius = 6.0,
        repairDurationMs = 12000,
        payPerRepair = 160,
        xpPerRepair = 25,
        healthRestoreMin = 400,
        healthRestoreMax = 1000,
        timeoutSec = 2400,
        dispatchServiceType = 'mechanic',
    },

    busdriver = {
        label = 'Bus Driver',
        help = 'Drive your transit bus along the scheduled route, stop at bus stops [E] to board passengers, collect fares, and return to depot for the route bonus.',
        depot = {
            coords = vector3(435.44, -646.28, 28.74),
            blip = { sprite = 513, color = 46, scale = 0.85 },
            spawns = {
                vector4(463.21, -606.43, 28.49, 214.23),
                vector4(461.90, -611.70, 28.50, 214.44),
                vector4(461.28, -619.32, 28.50, 214.44),
                vector4(460.95, -626.78, 28.50, 214.44),
                vector4(459.93, -633.95, 28.50, 214.44),
                vector4(459.96, -641.55, 28.50, 214.44),
                vector4(458.80, -648.45, 28.50, 214.44),
            },
            returnCoords = vector4(463.21, -606.43, 28.49, 214.23),
        },
        busModel = 'bus',
        stopRadius = 7.5,
        boardingDurationMs = 3500,
        payPerStop = 120,
        payPerPassenger = 35,
        routeBonusPay = 450,
        xpPerStop = 20,
        xpPerRoute = 65,
        routes = {
            {
                id = 'green_route',
                label = 'Linia Verde (Green Route Express)',
                stops = {
                    {
                        coords = vector4(306.71, -766.26, 28.79, 162.78),
                        label = 'Oprirea 1: Transit Center West',
                        passengerCoords = {
                            vector4(304.07, -766.32, 29.31, 239.64),
                            vector4(305.14, -763.82, 29.31, 272.49),
                        },
                    },
                    {
                        coords = vector4(785.89, -776.10, 25.91, 3.63),
                        label = 'Oprirea 2: Mirror Park Blvd',
                        passengerCoords = {
                            vector4(788.65, -776.10, 26.25, 270.0),
                            vector4(788.75, -778.50, 26.25, 270.0),
                        },
                    },
                    {
                        coords = vector4(770.40, -941.32, 25.17, 188.14),
                        label = 'Oprirea 3: East Los Santos',
                        passengerCoords = {
                            vector4(767.15, -941.32, 25.55, 90.0),
                            vector4(767.25, -943.60, 25.55, 90.0),
                        },
                    },
                    {
                        coords = vector4(787.35, -1369.32, 26.03, 182.59),
                        label = 'Oprirea 4: Popular Street',
                        passengerCoords = {
                            vector4(784.15, -1369.32, 26.45, 90.0),
                            vector4(784.25, -1371.80, 26.45, 90.0),
                        },
                    },
                    {
                        coords = vector4(808.11, -1352.63, 25.80, 1.31),
                        label = 'Oprirea 5: Cypress Flats North',
                        passengerCoords = {
                            vector4(811.35, -1352.63, 26.25, 270.0),
                            vector4(811.45, -1355.00, 26.25, 270.0),
                        },
                    },
                    {
                        coords = vector4(824.75, -1639.46, 29.80, 175.04),
                        label = 'Oprirea 6: Port Boulevard',
                        passengerCoords = {
                            vector4(821.45, -1639.46, 30.25, 90.0),
                            vector4(821.55, -1642.00, 30.25, 90.0),
                        },
                    },
                },
                returnDepot = vector4(463.21, -606.43, 28.49, 214.23),
            },
        },

    },
}

function Sunset.GetJobConfig(jobId)
    return Sunset.JobsConfig and Sunset.JobsConfig[jobId]
end

