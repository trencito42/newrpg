Config = {}

Config.WheelModel = `vw_prop_vw_luckywheel_02a`
Config.Vehicle = 	'tempesta'
Config.Amount = 100 -- Chips required if not free spin
Config.WheelPos = vector3(1111.052, 229.84, -50.38)
Config.SpinPos = vector3(1110.88, 228.87, -49.85)
Config.VehPos = vector4(1100.22, 220.04, -49.44, 0.0)
Config.SpinCooldownMinutes = 60
Config.VideoType = 'CASINO_DIA_PL'

Config.Prizes = {
    [1]  = { type = 'chips',   amount = 500,    labelKey = "config.luckywheel.label.500_chips.90f7e22f", label = '500 Chips' },
    [2]  = { type = 'item',    item = 'bandage', count = 5, labelKey = "config.luckywheel.label.5x_bandages.127675a0", label = '5x Bandages' },
    [3]  = { type = 'cash',    amount = 5000,   labelKey = "config.luckywheel.label.5_000_cash.ce874074", label = '$5,000 Cash' },
    [4]  = { type = 'chips',   amount = 1000,   labelKey = "config.luckywheel.label.1_000_chips.ffb4fd5f", label = '1,000 Chips' },
    [5]  = { type = 'cash',    amount = 25000,  labelKey = "config.luckywheel.label.25_000_cash.b2c512b9", label = '$25,000 Cash' },
    [6]  = { type = 'item',    item = 'repairkit', count = 2, labelKey = "config.luckywheel.label.2x_repair_kits.a406cc68", label = '2x Repair Kits' },
    [7]  = { type = 'cash',    amount = 10000,  labelKey = "config.luckywheel.label.10_000_cash.6c40b824", label = '$10,000 Cash' },
    [8]  = { type = 'chips',   amount = 2500,   labelKey = "config.luckywheel.label.2_500_chips.b4ca2f4e", label = '2,500 Chips' },
    [9]  = { type = 'cash',    amount = 15000,  labelKey = "config.luckywheel.label.15_000_cash.ad840f15", label = '$15,000 Cash' },
    [10] = { type = 'item',    item = 'duffel_bag', count = 1, labelKey = "config.luckywheel.label.duffel_bag.e5b8a222", label = 'Duffel Bag' },
    [11] = { type = 'chips',   amount = 5000,   labelKey = "config.luckywheel.label.5_000_chips.f929ebeb", label = '5,000 Chips' },
    [12] = { type = 'cash',    amount = 50000,  labelKey = "config.luckywheel.label.50_000_cash.ff746c79", label = '$50,000 Cash' },
    [13] = { type = 'chips',   amount = 7500,   labelKey = "config.luckywheel.label.7_500_chips.e2b7a725", label = '7,500 Chips' },
    [14] = { type = 'item',    item = 'radio', count = 1, labelKey = "config.luckywheel.label.radio.59a4e861", label = 'Radio' },
    [15] = { type = 'cash',    amount = 20000,  labelKey = "config.luckywheel.label.20_000_cash.6c5c48f9", label = '$20,000 Cash' },
    [16] = { type = 'chips',   amount = 10000,  labelKey = "config.luckywheel.label.10_000_chips.d8b1024c", label = '10,000 Chips' },
    [17] = { type = 'cash',    amount = 35000,  labelKey = "config.luckywheel.label.35_000_cash.a50a246c", label = '$35,000 Cash' },
    [18] = { type = 'item',    item = 'armor', count = 2, labelKey = "config.luckywheel.label.2x_heavy_armor.c31f8842", label = '2x Heavy Armor' },
    [19] = { type = 'vehicle', model = 'tempesta', labelKey = "config.luckywheel.label.pegassi_tempesta_jackpot_vehicle.c60e4df4", label = 'Pegassi Tempesta (Jackpot Vehicle!)' },
    [20] = { type = 'cash',    amount = 100000, labelKey = "config.luckywheel.label.100_000_grand_prize.058368f6", label = '$100,000 GRAND PRIZE' },
}
