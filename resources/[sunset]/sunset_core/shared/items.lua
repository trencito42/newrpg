Sunset = Sunset or {}

local FISHING_ROD_EQUIP = {
    model = 'prop_fishing_rod_01',
    anim = { dict = 'amb@world_human_stand_fishing@idle_a', name = 'idle_c', flag = 49 },
}

Sunset.Items = {
    -- `icon` is a basename from sunset_ui/web/assets/items (never an emoji).
    water = { labelKey = "config.core.label.water_bottle.71a87c1d", label = 'Water Bottle', weight = 0.2, usable = true, hunger = 0, thirst = 25, category = 'drinks', icon = 'water_bottle' },
    bread = { labelKey = "config.core.label.bread.4cc40404", label = 'Bread', weight = 0.2, usable = true, hunger = 20, thirst = 0, category = 'food', icon = 'bread' },
    burger = { labelKey = "config.core.label.burger.8b09254e", label = 'Burger', weight = 0.3, usable = true, hunger = 35, thirst = -5, category = 'food', icon = 'burger' },
    sandwich = { labelKey = "config.core.label.sandwich.c680cba0", label = 'Sandwich', weight = 0.25, usable = true, hunger = 28, category = 'food', icon = 'sandwich' },
    pizza_slice = { labelKey = "config.core.label.pizza_slice.f0f16fc8", label = 'Pizza Slice', weight = 0.25, usable = true, hunger = 30, thirst = -2, category = 'food', icon = 'pizza_slice' },
    hotdog = { labelKey = "config.core.label.hot_dog.11c898a6", label = 'Hot Dog', weight = 0.25, usable = true, hunger = 26, thirst = -2, category = 'food', icon = 'hotdog' },
    chips = { labelKey = "config.core.label.potato_chips.a0eab70c", label = 'Potato Chips', weight = 0.15, usable = true, hunger = 15, thirst = -4, category = 'food', icon = 'chips_bag' },
    cookies = { labelKey = "config.core.label.cookies.dfab2919", label = 'Cookies', weight = 0.12, usable = true, hunger = 12, thirst = -2, category = 'food', icon = 'cookies' },
    chocolate = { labelKey = "config.core.label.chocolate_bar.a7110cd3", label = 'Chocolate Bar', weight = 0.1, usable = true, hunger = 14, stress = -3, category = 'food', icon = 'chocolate_bar' },
    apple = { labelKey = "config.core.label.apple.b13a6848", label = 'Apple', weight = 0.15, usable = true, hunger = 12, thirst = 3, category = 'food', icon = 'apple' },
    banana = { labelKey = "config.core.label.banana.3f89ace1", label = 'Banana', weight = 0.18, usable = true, hunger = 14, category = 'food', icon = 'banana' },
    soda = { labelKey = "config.core.label.sprunk.2f675c6b", label = 'Sprunk', weight = 0.25, usable = true, thirst = 20, category = 'drinks', icon = 'sprunk' },
    coffee = { labelKey = "config.core.label.coffee.b453166f", label = 'Coffee', weight = 0.2, usable = true, thirst = 12, stress = -5, category = 'drinks', icon = 'coffee' },
    energy_drink = { labelKey = "config.core.label.energy_drink.81d43a1e", label = 'Energy Drink', weight = 0.25, usable = true, thirst = 18, stress = -4, category = 'drinks', icon = 'energy_drink' },
    juice = { labelKey = "config.core.label.fruit_juice.710489c5", label = 'Fruit Juice', weight = 0.25, usable = true, thirst = 22, category = 'drinks', icon = 'juice_carton' },
    beer = { labelKey = "config.core.label.beer.51f7de37", label = 'Beer', weight = 0.3, usable = true, thirst = 20, stress = -5, category = 'drinks', icon = 'beer' },
    wine = { labelKey = "config.core.label.wine_glass.4fbd8c70", label = 'Wine Glass', weight = 0.25, usable = true, thirst = 25, stress = -8, category = 'drinks', icon = 'wine' },
    whiskey = { labelKey = "config.core.label.whiskey.16878374", label = 'Whiskey', weight = 0.3, usable = true, thirst = 30, stress = -12, category = 'drinks', icon = 'whiskey' },
    cocktail = { labelKey = "config.core.label.cocktail.484d1ae0", label = 'Cocktail', weight = 0.25, usable = true, thirst = 35, stress = -10, category = 'drinks', icon = 'glass' },
    champagne = { labelKey = "config.core.label.champagne.f4347136", label = 'Champagne', weight = 0.3, usable = true, thirst = 50, stress = -15, category = 'drinks', icon = 'empty_bottle' },
    casino_chips = { labelKey = "config.core.label.casino_chips.136b80d7", label = 'Casino Chips', weight = 0.0001, usable = false, category = 'misc', icon = 'casinochips' },
    phone = { labelKey = "config.core.label.phone.f7d7af14", label = 'Phone', weight = 0.1, usable = false, category = 'misc', icon = 'phone' },
    id_card = { labelKey = "config.core.label.id_card.aab0ee70", label = 'ID Card', weight = 0.05, usable = false, category = 'misc', icon = 'id_card' },
    driver_license = { labelKey = "config.core.label.driver_license.cf59a704", label = 'Driver License', weight = 0.05, usable = false, category = 'misc', icon = 'driver_license' },
    repairkit = { labelKey = "config.core.label.repair_kit.730927a9", label = 'Repair Kit', weight = 2.0, usable = true, category = 'tools', icon = 'repairkit' },
    bandage = { labelKey = "config.core.label.bandage.5f4b1e0c", label = 'Bandage', weight = 0.1, usable = true, heal = 25, category = 'medical', icon = 'bandage' },
    painkillers = { labelKey = "config.core.label.painkillers.ecb9f083", label = 'Painkillers', weight = 0.05, usable = true, heal = 12, category = 'medical', icon = 'painkillers' },
    cigarette = { labelKey = "config.core.label.cigarette.b9e7dfa5", label = 'Cigarette', weight = 0.05, usable = true, stress = -10, category = 'supplies', icon = 'cigarette_pack' },
    lockpick = { labelKey = "config.core.label.lockpick.90e81020", label = 'Lockpick', weight = 0.2, usable = true, category = 'tools', icon = 'lockpick' },
    metal_scrap = { labelKey = "config.core.label.metal_scrap.b33eeda0", label = 'Metal Scrap', weight = 0.5, usable = false, category = 'materials', icon = 'metalscrap' },
    plastic = { labelKey = "config.core.label.plastic.591c4a9b", label = 'Plastic', weight = 0.15, usable = false, category = 'materials', icon = 'plastic' },
    cloth = { labelKey = "config.core.label.cloth.62f1f785", label = 'Cloth', weight = 0.1, usable = false, category = 'materials', icon = 'cloth' },
    chemicals = { labelKey = "config.core.label.chemicals.26ad6da3", label = 'Chemicals', weight = 0.3, usable = false, category = 'materials', icon = 'acetone' },
    gunpowder = { labelKey = "config.core.label.gunpowder.2413c1f0", label = 'Gunpowder', weight = 0.2, usable = false, category = 'ammo', icon = 'ammo_box_empty' },
    sealed_pouch = { labelKey = "config.core.label.sealed_pouch.84f675fd", label = 'Sealed Pouch', weight = 0.15, usable = true, stress = -15, category = 'supplies', icon = 'filled_evidence_bag' },
    shiv = { labelKey = "config.core.label.shiv.aa0f8626", label = 'Shiv', weight = 0.3, usable = false, weapon = 'WEAPON_SWITCHBLADE', category = 'tools', icon = 'weapon_trigger' },
    gas_can = { labelKey = "config.core.label.gas_can.2cb3dd55", label = 'Gas Can', weight = 3.0, usable = true, maxLiters = 20, category = 'tools', icon = 'jerry_can' },
    fresh_fish    = { labelKey = "config.core.label.fresh_fish.223adc3c", label = 'Fresh Fish',      weight = 0.8,  usable = false, category = 'food',    icon = 'cooked_fish' },
    -- Typed fish (caught with new rarity system) — heavier rarity = more bag space used
    fish_common   = { labelKey = "config.core.label.common_fish.36d9e4be", label = 'Common Fish',     weight = 0.8,  usable = false, category = 'food',    icon = 'fish_common' },
    fish_uncommon = { labelKey = "config.core.label.uncommon_fish.bab57e53", label = 'Uncommon Fish',   weight = 1.2,  usable = false, category = 'food',    icon = 'fish_uncommon' },
    fish_rare     = { labelKey = "config.core.label.rare_fish.5a4fdd06", label = 'Rare Fish',        weight = 2.0,  usable = false, category = 'food',    icon = 'fish_rare' },
    fish_epic     = { labelKey = "config.core.label.epic_fish.ef0faf69", label = 'Epic Fish',        weight = 3.0,  usable = false, category = 'food',    icon = 'fish_epic' },
    fish_legendary = { labelKey = "config.core.label.legendary_fish.7814fbdc", label = 'Legendary Fish', weight = 5.0,  usable = false, category = 'food',    icon = 'fish_legendary' },
    -- Fishing bait (consumabil la fiecare aruncare)
    bait_worm    = { labelKey = "config.core.label.worm_bait.2b22536b", label = 'Worm Bait',         weight = 0.05, usable = false, category = 'fishing', icon = 'bait_worm' },
    bait_lure    = { labelKey = "config.core.label.artificial_lure.0dbe6cf0", label = 'Artificial Lure',   weight = 0.05, usable = false, category = 'fishing', icon = 'bait_lure' },
    bait_premium = { labelKey = "config.core.label.premium_bait.73b05830", label = 'Premium Bait',      weight = 0.05, usable = false, category = 'fishing', icon = 'bait_premium' },
    -- Undita (upgrade sequential prin NPC, tradeable)
    fishing_rod_1 = { labelKey = "config.core.label.fishing_rod_mk1.7db8c0c0", label = 'Fishing Rod Mk1', weight = 1.5,  usable = false, category = 'fishing', icon = 'fishing_rod_1', equipProp = FISHING_ROD_EQUIP },
    fishing_rod_2 = { labelKey = "config.core.label.fishing_rod_mk2.2db1fdba", label = 'Fishing Rod Mk2', weight = 1.5,  usable = false, category = 'fishing', icon = 'fishing_rod_2', equipProp = FISHING_ROD_EQUIP },
    fishing_rod_3 = { labelKey = "config.core.label.fishing_rod_mk3.ebdcc288", label = 'Fishing Rod Mk3', weight = 1.5,  usable = false, category = 'fishing', icon = 'fishing_rod_3', equipProp = FISHING_ROD_EQUIP },
    fishing_rod_4 = { labelKey = "config.core.label.fishing_rod_mk4.ceee8220", label = 'Fishing Rod Mk4', weight = 1.5,  usable = false, category = 'fishing', icon = 'fishing_rod_4', equipProp = FISHING_ROD_EQUIP },
    fishing_rod_5 = { labelKey = "config.core.label.fishing_rod_mk5.589d2445", label = 'Fishing Rod Mk5', weight = 1.5,  usable = false, category = 'fishing', icon = 'fishing_rod_5', equipProp = FISHING_ROD_EQUIP },
    weapon_flashlight = { labelKey = "config.core.label.heavy_duty_flashlight.e58ddef3", label = 'Heavy-Duty Flashlight', weight = 0.8, usable = false, weapon = 'WEAPON_FLASHLIGHT', category = 'utility', icon = 'flashlight' },
    weapon_bat = { labelKey = "config.core.label.baseball_bat.e38afbda", label = 'Baseball Bat', weight = 1.4, usable = false, weapon = 'WEAPON_BAT', category = 'melee', icon = 'weapon_trigger' },
    weapon_knife = { labelKey = "config.core.label.utility_knife.7fe23f75", label = 'Utility Knife', weight = 0.45, usable = false, weapon = 'WEAPON_KNIFE', category = 'melee', icon = 'weapon_trigger' },
    weapon_snspistol = { labelKey = "config.core.label.sns_pistol.bf72a239", label = 'SNS Pistol', weight = 1.0, usable = false, weapon = 'WEAPON_SNSPISTOL', category = 'handguns', icon = 'weapon_trigger' },
    weapon_pistol = { labelKey = "config.core.label.pistol.f4fb60a1", label = 'Pistol', weight = 1.2, usable = false, weapon = 'WEAPON_PISTOL', category = 'handguns', icon = 'weapon_trigger' },
    weapon_vintagepistol = { labelKey = "config.core.label.vintage_pistol.b05b3420", label = 'Vintage Pistol', weight = 1.25, usable = false, weapon = 'WEAPON_VINTAGEPISTOL', category = 'handguns', icon = 'weapon_trigger' },
    weapon_pumpshotgun = { labelKey = "config.core.label.pump_shotgun.fef49025", label = 'Pump Shotgun', weight = 3.4, usable = false, weapon = 'WEAPON_PUMPSHOTGUN', category = 'shotguns', icon = 'weapon_barrel' },
    weapon_sniperrifle = { labelKey = "config.core.label.hunting_rifle.608e71ab", label = 'Hunting Rifle', weight = 4.5, usable = false, weapon = 'WEAPON_SNIPERRIFLE', category = 'rifles', icon = 'hunting_rifle' },
    -- ═══ HUNTER JOB ITEMS ═══
    -- Harvest items carry metadata: species, weight, quality (0-100), grade, harvestedAt, animalId.
    -- Do NOT stack items with different metadata automatically (see inventory stacking behavior).
    venison     = { labelKey = "config.core.label.venison.4038b36b", label = 'Venison',      weight = 1.0, usable = false, category = 'food',      icon = 'venison',          metaDisplay = {'species','weight','quality'} },
    boar_meat   = { labelKey = "config.core.label.boar_meat.53b95450", label = 'Boar Meat',    weight = 1.0, usable = false, category = 'food',      icon = 'boar_meat',        metaDisplay = {'species','weight','quality'} },
    animal_hide = { labelKey = "config.core.label.animal_hide.8dfd6d6f", label = 'Animal Hide',  weight = 0.8, usable = false, category = 'materials', icon = 'animal_hide',      metaDisplay = {'species','grade'} },
    coyote_pelt = { labelKey = "config.core.label.coyote_pelt.5e2cd7b0", label = 'Coyote Pelt',  weight = 0.6, usable = false, category = 'materials', icon = 'coyote_pelt',      metaDisplay = {'species','grade'} },
    antlers     = { labelKey = "config.core.label.antlers.745cfde8", label = 'Antlers',      weight = 1.2, usable = false, category = 'misc',      icon = 'antlers',          metaDisplay = {'species','quality'} },
    hunting_knife = { labelKey = "config.core.label.hunting_knife.c3fe93c1", label = 'Hunting Knife', weight = 0.35, usable = false, weapon = 'WEAPON_KNIFE', category = 'melee', icon = 'hunting_knife' },
    ammo_rifle  = { labelKey = "config.core.label.rifle_ammo_10.c0369566", label = 'Rifle Ammo (10)', weight = 0.6, usable = true, category = 'ammo', icon = 'shotgun_ammo',
                    ammoRounds = 10, ammoWeapons = { 'WEAPON_SNIPERRIFLE', 'WEAPON_MARKSMANRIFLE', 'WEAPON_MARKSMANRIFLE_MK2', 'WEAPON_HEAVYSNIPER', 'WEAPON_HEAVYSNIPER_MK2' } },
    -- ═══ DIVER JOB ITEMS ═══
    -- Salvage items carry metadata: siteId, condition (0-100), rarity, recoveredAt.
    salvage_parts      = { labelKey = "config.core.label.salvage_parts.724ceb96", label = 'Salvage Parts',       weight = 2.0, usable = false, category = 'materials', icon = 'metalscrap',           metaDisplay = {'condition','rarity'} },
    marine_electronics = { labelKey = "config.core.label.marine_electronics.5aa6ea43", label = 'Marine Electronics',  weight = 1.2, usable = false, category = 'materials', icon = 'phone',                metaDisplay = {'condition','rarity'} },
    sealed_cargo       = { labelKey = "config.core.label.sealed_cargo.02a233f8", label = 'Sealed Cargo',        weight = 3.0, usable = false, category = 'misc',      icon = 'filled_evidence_bag',  metaDisplay = {'condition','rarity'} },
    marine_artifact    = { labelKey = "config.core.label.marine_artifact.abd6c203", label = 'Marine Artifact',     weight = 0.8, usable = false, category = 'misc',      icon = 'filled_evidence_bag',  metaDisplay = {'condition','rarity'} },
    scuba_gear         = { labelKey = "config.core.label.basic_scuba_set.8c19b083", label = 'Basic Scuba Set',     weight = 4.0, usable = false, category = 'tools',     icon = 'scuba_gear' },
    standard_tank      = { labelKey = "config.core.label.standard_dive_tank.b88fc34a", label = 'Standard Dive Tank',  weight = 4.0, usable = false, category = 'tools',     icon = 'standard_tank' },
    advanced_tank      = { labelKey = "config.core.label.advanced_dive_tank.d37fdd42", label = 'Advanced Dive Tank',  weight = 5.5, usable = false, category = 'tools',     icon = 'advanced_tank' },
    ammo_9mm = {
        labelKey = "config.core.label.9mm_ammo_box_24.7e1e5963", label = '9mm Ammo Box (24)', weight = 0.4, usable = true, category = 'ammo', icon = 'pistol_ammo',
        ammoRounds = 24, ammoWeapons = { 'WEAPON_SNSPISTOL', 'WEAPON_PISTOL', 'WEAPON_VINTAGEPISTOL' },
    },
    ammo_shotgun = {
        labelKey = "config.core.label.12_gauge_shells_12.755dcf11", label = '12 Gauge Shells (12)', weight = 0.55, usable = true, category = 'ammo', icon = 'shotgun_ammo',
        ammoRounds = 12, ammoWeapons = { 'WEAPON_PUMPSHOTGUN' },
    },
    stolen_silver_watch = { labelKey = "config.core.label.stolen_silver_watch.ad590e82", label = 'Stolen Silver Watch', weight = 0.4, usable = false, category = 'misc', icon = 'stolen_silver_watch' },
    stolen_luxury_watch = { labelKey = "config.core.label.stolen_luxury_watch.6de516a6", label = 'Stolen Luxury Watch', weight = 0.45, usable = false, category = 'misc', icon = 'stolen_luxury_watch' },
    stolen_gold_watch = { labelKey = "config.core.label.stolen_gold_watch.b950f04e", label = 'Stolen Gold Watch', weight = 0.45, usable = false, category = 'misc', icon = 'stolen_gold_watch' },
    stolen_diamond_watch = { labelKey = "config.core.label.stolen_diamond_watch.b24ec78c", label = 'Stolen Diamond Watch', weight = 0.5, usable = false, category = 'misc', icon = 'stolen_diamond_watch' },
    stolen_collector_watch = { labelKey = "config.core.label.stolen_collector_watch.3e07b931", label = 'Stolen Collector Watch', weight = 0.55, usable = false, category = 'misc', icon = 'stolen_collector_watch' },
    stolen_bracelet = { labelKey = "config.core.label.stolen_bracelet.a9936e5d", label = 'Stolen Bracelet', weight = 0.25, usable = false, category = 'misc', icon = 'stolen_bracelet' },
    stolen_gold_chain = { labelKey = "config.core.label.stolen_gold_chain.43e2396a", label = 'Stolen Gold Chain', weight = 0.3, usable = false, category = 'misc', icon = 'stolen_gold_chain' },
    stolen_gold_bracelet = { labelKey = "config.core.label.stolen_gold_bracelet.d5e685d7", label = 'Stolen Gold Bracelet', weight = 0.3, usable = false, category = 'misc', icon = 'stolen_gold_bracelet' },
    stolen_diamond_jewelry = { labelKey = "config.core.label.stolen_designer_jewelry.02f07b55", label = 'Stolen Designer Jewelry', weight = 0.4, usable = false, category = 'misc', icon = 'stolen_diamond_jewelry' },
    -- ═══ DRUGS (manufacture → process → sell) ═══
    weed_leaf     = { labelKey = "config.core.label.weed_leaf.3c62e2c4", label = 'Weed Leaf',       weight = 0.10, usable = false, category = 'drugs', icon = 'weed_leaf' },
    weed_brick    = { labelKey = "config.core.label.weed_brick.6be6ad73", label = 'Weed Brick',      weight = 0.50, usable = false, category = 'drugs', icon = 'weed_brick' },
    coke_leaf     = { labelKey = "config.core.label.coca_leaf.4fb846c3", label = 'Coca Leaf',        weight = 0.10, usable = false, category = 'drugs', icon = 'coke_leaf' },
    coke_brick    = { labelKey = "config.core.label.coke_brick.0c6f04a4", label = 'Coke Brick',       weight = 0.50, usable = false, category = 'drugs', icon = 'coke_brick' },
    meth_chemical = { labelKey = "config.core.label.meth_chemical.3825ad4c", label = 'Meth Chemical',   weight = 0.15, usable = false, category = 'drugs', icon = 'meth_chemical' },
    meth_bag      = { labelKey = "config.core.label.meth_bag.19062286", label = 'Meth Bag',         weight = 0.30, usable = false, category = 'drugs', icon = 'meth_bag' },
}

Sunset.Shops = {
    -- fishing_supply handled by sunset_fishingshop (dedicated UI at Paleto)
    twentyfour7 = {
        labelKey = "config.core.label.24_7_store.2364e9ae", label = '24/7 Store',
        coords = vector3(25.74, -1347.32, 29.50),
        items = {
            { item = 'water', price = 6 },
            { item = 'bread', price = 10 },
            { item = 'burger', price = 22 },
            { item = 'sandwich', price = 18 },
            { item = 'pizza_slice', price = 20 },
            { item = 'hotdog', price = 17 },
            { item = 'chips', price = 9 },
            { item = 'cookies', price = 10 },
            { item = 'chocolate', price = 11 },
            { item = 'apple', price = 7 },
            { item = 'banana', price = 7 },
            { item = 'soda', price = 8 },
            { item = 'coffee', price = 11 },
            { item = 'energy_drink', price = 16 },
            { item = 'juice', price = 12 },
            { item = 'bandage', price = 35 },
            { item = 'painkillers', price = 28 },
            { item = 'cigarette', price = 14 },
            { item = 'phone', price = 250, maxAmount = 1 },
            { item = 'gas_can', price = 55 },
            { item = 'chemicals', price = 45 },
        },
    },
    ammunation = {
        labelKey = "config.core.label.ammunation.f6d8020b", label = 'Ammunation',
        coords = vector3(22.56, -1106.24, 29.80),
        blip = { sprite = 110, color = 1, scale = 0.75 },
        items = {
            { item = 'weapon_flashlight', price = 120, maxAmount = 1 },
            { item = 'weapon_bat', price = 450, maxAmount = 1 },
            { item = 'weapon_knife', price = 650, maxAmount = 1 },
            { item = 'weapon_snspistol', price = 8500, minLevel = 2, requiredLicense = 'weapon', maxAmount = 1 },
            { item = 'weapon_pistol', price = 12000, minLevel = 3, requiredLicense = 'weapon', maxAmount = 1 },
            { item = 'weapon_vintagepistol', price = 15000, minLevel = 4, requiredLicense = 'weapon', maxAmount = 1 },
            { item = 'weapon_pumpshotgun', price = 32000, minLevel = 6, requiredLicense = 'weapon', maxAmount = 1 },
            { item = 'ammo_9mm', price = 180, requiredLicense = 'weapon', maxAmount = 10 },
            { item = 'ammo_shotgun', price = 260, requiredLicense = 'weapon', maxAmount = 10 },
            { item = 'weapon_sniperrifle', price = 28000, minLevel = 5, requiredLicense = 'weapon', maxAmount = 1 },
            { item = 'ammo_rifle', price = 320, requiredLicense = 'weapon', maxAmount = 10 },
            { item = 'hunting_knife', price = 800, maxAmount = 1 },
            { item = 'lockpick', price = 350, maxAmount = 5 },
        },
    },
}

-- Every purchasable 24/7 location (shared catalog; each row is a separate business).
Sunset.TwentyFourSevenStores = {
    { id = 'legion',      labelKey = "config.core.label.24_7_legion_square.1c1c7c8f", label = '24/7 - Legion Square',  coords = vector3(25.74,   -1347.32, 29.50), cashier = vector4(24.47,  -1347.38, 29.50, 270.0) },
    { id = 'strawberry',  labelKey = "config.core.label.24_7_strawberry.75a52e5a", label = '24/7 - Strawberry',     coords = vector3(-46.06,  -1757.88, 29.42), cashier = vector4(-47.52, -1758.66, 29.42, 45.0) },
    { id = 'littleseoul', labelKey = "config.core.label.24_7_little_seoul.1851eb09", label = '24/7 - Little Seoul',   coords = vector3(-707.12,  -913.43,  19.22), cashier = vector4(-706.06, -914.63, 19.22, 90.0) },
    { id = 'mirrorpark',  labelKey = "config.core.label.24_7_mirror_park.05ca1694", label = '24/7 - Mirror Park',    coords = vector3(1164.44,  -322.49,  69.21), cashier = vector4(1165.05, -323.68, 69.21, 100.0) },
    { id = 'vinewood',    labelKey = "config.core.label.24_7_vinewood_hills.b85f4255", label = '24/7 - Vinewood Hills', coords = vector3(548.46,   2671.72,  42.16), cashier = vector4(549.04,  2671.36, 42.16, 100.0) },
    { id = 'rockford',    labelKey = "config.core.label.24_7_rockford_hills.e38f3989", label = '24/7 - Rockford Hills', coords = vector3(-3038.24,  584.19,   7.91), cashier = vector4(-3039.54, 584.75,  7.91,  20.0) },
    { id = 'sandy',       labelKey = "config.core.label.24_7_sandy_shores.7324826f", label = '24/7 - Sandy Shores',   coords = vector3(2678.55,  3279.25,  55.24), cashier = vector4(2679.95, 3280.55, 55.24, 0.0) },
    { id = 'paleto',      labelKey = "config.core.label.24_7_paleto_bay.5130c32f", label = '24/7 - Paleto Bay',     coords = vector3(-54.37,   6244.70,  31.09), cashier = vector4(-51.87,  6244.40, 31.09, 315.0) },
}

Sunset.ATMs = {
    vector3(147.58, -1035.78, 29.34),
    vector3(-386.73, 6045.95, 31.50),
    vector3(-1205.02, -324.79, 37.86),
    vector3(-2962.58, 482.63, 15.70),
}

Sunset.Garages = {
    legion = {
        labelKey = "config.core.label.legion_garage.4d56192c", label = 'Legion Garage',
        spawn = vector4(215.12, -805.45, 30.81, 70.0),
        store = vector3(229.70, -800.11, 30.57),
    },
    airport = {
        labelKey = "config.core.label.lsia_garage.ea2ece7e", label = 'LSIA Garage',
        spawn = vector4(-1034.62, -2733.41, 20.17, 328.0),
        store = vector3(-1025.0, -2725.0, 20.17),
    },
}

Sunset.GasStations = {
    {
        labelKey = "config.core.label.ltd_gasoline_legion.f2197baa", label = 'LTD Gasoline - Legion',
        coords = vector3(265.65, -1261.28, 29.14),
        pumps = {
            vector4(264.92, -1254.32, 29.14, 90.0),
            vector4(264.92, -1260.98, 29.14, 90.0),
            vector4(264.92, -1267.64, 29.14, 90.0),
        },
    },
    {
        labelKey = "config.core.label.ron_gas_grove_st.cea96415", label = 'Ron Gas - Grove St',
        coords = vector3(-70.21, -1761.79, 29.53),
        pumps = {
            vector4(-63.61, -1767.94, 29.12, 270.0),
            vector4(-61.18, -1760.46, 29.16, 270.0),
        },
    },
    {
        labelKey = "config.core.label.xero_gas_mirror_park.7cd9b420", label = 'Xero Gas - Mirror Park',
        coords = vector3(1208.61, -1402.29, 35.22),
        pumps = {
            vector4(1204.84, -1400.85, 35.22, 90.0),
            vector4(1207.12, -1398.04, 35.22, 90.0),
        },
    },
    {
        labelKey = "config.core.label.ltd_gasoline_vinewood.b3f1d8ec", label = 'LTD Gasoline - Vinewood',
        coords = vector3(621.07, 269.52, 103.09),
        pumps = {
            vector4(625.71, 269.95, 103.09, 270.0),
            vector4(618.42, 269.12, 103.09, 270.0),
        },
    },
    {
        labelKey = "config.core.label.ron_gas_paleto.c4b741a2", label = 'Ron Gas - Paleto',
        coords = vector3(179.86, 6602.85, 31.86),
        pumps = {
            vector4(186.29, 6606.38, 32.05, 180.0),
            vector4(179.10, 6604.87, 32.05, 180.0),
        },
    },
    {
        labelKey = "config.core.label.xero_gas_sandy_shores.69678b69", label = 'Xero Gas - Sandy Shores',
        coords = vector3(2005.01, 3774.20, 32.18),
        pumps = {
            vector4(2001.52, 3772.28, 32.18, 120.0),
            vector4(2006.31, 3774.85, 32.18, 300.0),
        },
    },
    {
        labelKey = "config.core.label.ltd_gasoline_route_68.0da4f302", label = 'LTD Gasoline - Route 68',
        coords = vector3(1039.34, 2671.78, 39.55),
        pumps = {
            vector4(1035.42, 2674.08, 39.55, 0.0),
            vector4(1042.14, 2674.55, 39.55, 0.0),
        },
    },
    {
        labelKey = "config.core.label.ron_gas_great_ocean.b5320bb3", label = 'Ron Gas - Great Ocean',
        coords = vector3(-2554.85, 2334.40, 33.06),
        pumps = {
            vector4(-2552.14, 2334.48, 33.06, 240.0),
            vector4(-2558.92, 2336.01, 33.06, 60.0),
        },
    },
    {
        labelKey = "config.core.label.xero_gas_lsia.9b1456d1", label = 'Xero Gas - LSIA',
        coords = vector3(-724.62, -935.16, 19.21),
        pumps = {
            vector4(-721.14, -938.86, 19.02, 0.0),
            vector4(-728.56, -938.86, 19.02, 0.0),
        },
    },
    {
        labelKey = "config.core.label.ltd_gasoline_del_perro.02ea148b", label = 'LTD Gasoline - Del Perro',
        coords = vector3(-1437.62, -276.74, 46.21),
        pumps = {
            vector4(-1435.12, -284.68, 46.21, 130.0),
            vector4(-1444.52, -274.22, 46.21, 310.0),
        },
    },
}

Sunset.ClothingShops = {
    vector3(72.25, -1399.10, 29.38),
    vector3(-703.78, -152.26, 37.42),
}

Sunset.BarberShops = {
    vector3(-814.31, -183.82, 37.57),
    vector3(136.78, -1708.40, 29.29),
}

Sunset.JobCenters = {
    cityhall = {
        labelKey = "config.core.label.job_center.d9a5db95", label = 'Job Center',
        coords = vector3(-265.04, -963.62, 31.22),
        blip = { sprite = 407, color = 2, scale = 0.85 },
        jobs = {
            { id = 'unemployed', labelKey = "config.core.label.unemployed.31dcb33a", label = 'Unemployed' },
            { id = 'fisherman', labelKey = "config.core.label.fisherman.3357a18b", label = 'Fisherman' },
            { id = 'mechanic', labelKey = "config.core.label.roadside_mechanic.9c9e21d1", label = 'Roadside Mechanic' },
        },
    },
}

-- Blip presets for world map (GTA V / FiveM standard references)
Sunset.WorldBlips = {
    shop = { sprite = 52, color = 2, scale = 0.70 },
    ammunation = { sprite = 110, color = 1, scale = 0.75 },
    atm = { sprite = 108, color = 2, scale = 0.65 },
    garage = { sprite = 357, color = 3, scale = 0.75 },
    clothing = { sprite = 73, color = 47, scale = 0.70 },
    barber = { sprite = 71, color = 47, scale = 0.70 },
    property = { sprite = 374, color = 5, scale = 0.75 },
    jobcenter = { sprite = 407, color = 2, scale = 0.85 },
    gas = { sprite = 361, color = 1, scale = 0.70 },
}
