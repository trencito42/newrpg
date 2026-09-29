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
}

function Sunset.GetJobConfig(jobId)
    return Sunset.JobsConfig and Sunset.JobsConfig[jobId]
end
