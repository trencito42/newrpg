SunsetPass = SunsetPass or {}

SunsetPass.SeasonId = 'season_01'
SunsetPass.SeasonLabel = 'Season 01'
SunsetPass.XpPerTier = 500
SunsetPass.PremiumCost = 250

SunsetPass.Tiers = {
    {
        level = 1,
        free = { type = 'cash', amount = 800, labelKey = "config.pass.label.800_cash.3993c775", label = '$800 Cash', icon = 'cash' },
        premium = { type = 'premium_points', amount = 15, labelKey = "config.pass.label.15_blaze_points.fd95c9a7", label = '15 Racket Coins', icon = 'coins' },
    },
    {
        level = 2,
        free = { type = 'item', item = 'water', count = 5, labelKey = "config.pass.label.water_x5.8f969c63", label = 'Water x5', icon = 'water_bottle' },
        premium = { type = 'item', item = 'lockpick', count = 2, labelKey = "config.pass.label.lockpick_x2.23b93a99", label = 'Lockpick x2', icon = 'lockpick' },
    },
    {
        level = 3,
        free = { type = 'item', item = 'bread', count = 5, labelKey = "config.pass.label.bread_x5.031e5b86", label = 'Bread x5', icon = 'bread' },
        premium = { type = 'bank', amount = 4000, labelKey = "config.pass.label.4_000_bank.e5d73c72", label = '$4,000 Bank', icon = 'bank' },
    },
    {
        level = 4,
        free = { type = 'item', item = 'bandage', count = 3, labelKey = "config.pass.label.bandage_x3.501841ce", label = 'Bandage x3', icon = 'bandage' },
        premium = { type = 'premium_points', amount = 35, labelKey = "config.pass.label.35_blaze_points.28847151", label = '35 Racket Coins', icon = 'coins' },
    },
    {
        level = 5,
        free = { type = 'bank', amount = 3000, labelKey = "config.pass.label.3_000_bank.3523cb90", label = '$3,000 Bank', icon = 'bank' },
        premium = { type = 'cash', amount = 6000, labelKey = "config.pass.label.6_000_cash.83f784ee", label = '$6,000 Cash', icon = 'cash' },
    },
    {
        level = 6,
        free = { type = 'premium_points', amount = 10, labelKey = "config.pass.label.10_blaze_points.e0f0073d", label = '10 Racket Coins', icon = 'coins' },
        premium = { type = 'item', item = 'bandage', count = 5, labelKey = "config.pass.label.bandage_x5.4f8ba126", label = 'Bandage x5', icon = 'bandage' },
    },
}

SunsetPass.Missions = {
    {
        id = 'robbery_complete',
        type = 'weekly',
        title = 'Jewelry Run',
        titleKey = 'pass.mission.robbery_complete.title',
        descriptionKey = 'pass.mission.robbery_complete.description',
        description = 'Complete a luxury-store robbery and sell loot at the fence.',
        goal = 1,
        xp = 500,
        icon = 'golden_watch',
    },
    {
        id = 'fish_catch',
        type = 'daily',
        title = 'Angler',
        titleKey = 'pass.mission.fish_catch.title',
        descriptionKey = 'pass.mission.fish_catch.description',
        description = 'Catch 10 fish while on a fisherman shift.',
        goal = 10,
        xp = 400,
        icon = 'cooked_fish',
    },
    {
        id = 'courier_deliveries',
        type = 'daily',
        title = 'Dedicated Courier',
        titleKey = 'pass.mission.courier_deliveries.title',
        descriptionKey = 'pass.mission.courier_deliveries.description',
        description = 'Complete 5 courier deliveries.',
        goal = 5,
        xp = 600,
        icon = 'backpack',
    },
    {
        id = 'trucker_delivery',
        type = 'daily',
        title = 'Long Hauler',
        titleKey = 'pass.mission.trucker_delivery.title',
        descriptionKey = 'pass.mission.trucker_delivery.description',
        description = 'Complete 3 trucker deliveries.',
        goal = 3,
        xp = 600,
        icon = 'cash_stack',
    },
    {
        id = 'paydays',
        type = 'daily',
        title = 'Steady Earner',
        titleKey = 'pass.mission.paydays.title',
        descriptionKey = 'pass.mission.paydays.description',
        description = 'Receive 2 paydays.',
        goal = 2,
        xp = 350,
        icon = 'cash_stack',
    },
    {
        id = 'contract_missions',
        type = 'weekly',
        title = 'Contract Specialist',
        titleKey = 'pass.mission.contract_missions.title',
        descriptionKey = 'pass.mission.contract_missions.description',
        description = 'Complete 3 contact missions.',
        goal = 3,
        xp = 650,
        icon = 'backpack',
    },
    {
        id = 'business_owner',
        type = 'weekly',
        title = 'Local Entrepreneur',
        titleKey = 'pass.mission.business_owner.title',
        descriptionKey = 'pass.mission.business_owner.description',
        description = 'Purchase a player business.',
        goal = 1,
        xp = 500,
        icon = 'cash_stack',
    },
}
