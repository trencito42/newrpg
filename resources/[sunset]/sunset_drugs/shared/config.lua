-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Drug Pipeline (shared/config.lua)
--  Manufacture (Harvest) → Process (Clandestine Lab) → Street Sale.
-- ═══════════════════════════════════════════════════════════════

SunsetDrugs = SunsetDrugs or {}

SunsetDrugs.Config = {
    -- ═══ STAGE 1: HARVEST HUD (Manufacture) ═══
    manufacture = {
        spots = {
            { coords = vector3(2230.00, 5578.00, 53.00),  drug = 'weed', label = 'Paleto Bay Fields' },
            { coords = vector3(2400.00, 4900.00, 42.00),  drug = 'weed', label = 'Grapeseed Farm' },
            { coords = vector3(-1200.00, 4800.00, 220.00), drug = 'meth', label = 'Mount Chiliad Scraps' },
            { coords = vector3(1800.00, 3700.00, 33.00),  drug = 'coke', label = 'Sandy Shores Plantation' },
            { coords = vector3(-300.00, 6200.00, 31.00),  drug = 'coke', label = 'Paleto North Plantation' },
        },
        spotRadius = 15.0,
        maxBagCapacity = 50,     -- Max raw items per harvest batch in UI
        minHitIntervalMs = 280,  -- Anti-autoclicker rate-limit validation
    },

    -- ═══ STAGE 2: CLANDESTINE LAB PROCESSING ═══
    process = {
        labs = {
            { coords = vector3(1089.00, -3100.00, -39.00), label = 'Underground Chemical Lab' },
            { coords = vector3(-1170.00, -1580.00, 4.00),  label = 'Del Perro Secret Warehouse' },
            { coords = vector3(1389.00, 3605.00, 38.90),   label = 'Sandy Shores Meth Lab' },
        },
        labRadius = 5.0,
        minProcessDurationMs = 3500, -- Minimum elapsed time before accept
        recipes = {
            weed = {
                label = 'Pachete Weed',
                rawItem = 'weed_leaf',
                rawCount = 5,
                secondaryItem = nil,
                secondaryCount = 0,
                productItem = 'weed_brick',
                productCount = 1,
                difficulty = 'easy',
            },
            coca = {
                label = 'Pudră Cocaină',
                rawItem = 'coke_leaf',
                rawCount = 5,
                secondaryItem = 'chemicals',
                secondaryCount = 1,
                productItem = 'coke_brick',
                productCount = 1,
                difficulty = 'medium',
            },
            meth = {
                label = 'Cristale Meth',
                rawItem = 'meth_chemical',
                rawCount = 3,
                secondaryItem = 'chemicals',
                secondaryCount = 1,
                productItem = 'meth_bag',
                productCount = 1,
                difficulty = 'hard',
            },
        },
    },

    -- ═══ STAGE 3: STREET SALE (Vânzare Stradală) ═══
    streetSale = {
        interactionDistance = 2.5,
        pedCooldownSec = 60,     -- A ped won't buy again for 60 seconds
        negotiationBonusPct = 0.25, -- +25% price increase on successful negotiation
        alertPoliceChanceOnFail = 0.45, -- 45% chance ped calls 911 when negotiation fails
        drugs = {
            weed = {
                item = 'weed_brick',
                label = 'Pachete Weed',
                basePrice = 250,
                minQty = 1,
                maxQty = 5,
            },
            coca = {
                item = 'coke_brick',
                label = 'Pudră Cocaină',
                basePrice = 800,
                minQty = 1,
                maxQty = 3,
            },
            meth = {
                item = 'meth_bag',
                label = 'Cristale Meth',
                basePrice = 1200,
                minQty = 1,
                maxQty = 2,
            },
        },
    },

    -- ═══ STAGE 4: WHOLESALE DELIVERY DROPOFFS (Locații Livrare Droguri) ═══
    delivery = {
        interactionRadius = 2.5,
        dropoffs = {
            {
                id = 1,
                coords = vector4(130.74, -1181.86, 29.50, 179.72),
                minRank = 1,
                maxRank = 3,
                name = 'Livrare Cartier (Strawberry)',
                dealerLabel = 'Contact Local',
                rankBadge = 'Rank 1 - 3',
                pedModel = 'g_m_y_famca_02',
                bonusPct = 0.05, -- +5% bonus en-gros
                scenario = 'WORLD_HUMAN_SMOKING',
            },
            {
                id = 2,
                coords = vector4(-810.95, 187.93, 72.48, 106.99),
                minRank = 4,
                maxRank = 5,
                name = 'Livrare Cartel (Rockford Hills)',
                dealerLabel = 'Intermediar Cartel',
                rankBadge = 'Rank 4 - 5',
                pedModel = 'g_m_m_mexboss_01',
                bonusPct = 0.15, -- +15% bonus en-gros
                scenario = 'WORLD_HUMAN_STAND_MOBILE',
            },
            {
                id = 3,
                coords = vector4(1237.81, -1632.55, 52.06, 20.93),
                minRank = 6,
                maxRank = 999,
                name = 'Livrare Sindicat (El Burro)',
                dealerLabel = 'Boss Sindicat',
                rankBadge = 'Rank 6+ (Elită)',
                pedModel = 'g_m_m_armboss_01',
                bonusPct = 0.30, -- +30% bonus en-gros
                scenario = 'WORLD_HUMAN_GUARD_STAND',
            },
        },
    },

    -- Shared Drug definitions for legacy references
    drugs = {
        weed = {
            raw = 'weed_leaf',
            product = 'weed_brick',
            label = 'Weed',
            rawLabel = 'Weed Leaves',
            productLabel = 'Weed Brick',
            basePrice = 250,
        },
        coke = {
            raw = 'coke_leaf',
            product = 'coke_brick',
            label = 'Cocaine',
            rawLabel = 'Coca Leaves',
            productLabel = 'Cocaine Brick',
            basePrice = 800,
        },
        meth = {
            raw = 'meth_chemical',
            product = 'meth_bag',
            label = 'Meth',
            rawLabel = 'Meth Chemicals',
            productLabel = 'Meth Bag',
            basePrice = 1200,
        },
    },
}

