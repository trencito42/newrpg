-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — The Diamond Casino (shared/config.lua)
--  All coordinates verified via /casinoprobe (interior id=275201).
-- ═══════════════════════════════════════════════════════════════

SunsetCasino = SunsetCasino or {}

SunsetCasino.Config = {
    -- Casino interior IPL — bob74_ipl auto-loads vw_casino_main on build >= 2060.
    ipl = 'vw_casino_main',
    interiorId = 275201,

    -- Entry marker (outside the casino, street level)
    entrance = vector3(924.64, 46.16, 81.06),
    -- Exit marker (INSIDE the casino, verified interiorExit)
    exit = vector3(1089.63, 205.89, -49.00),

    -- ── CASHIER (cash ↔ chips) ──
    cashier = vector3(1116.03, 219.69, -49.44),

    -- ── BAR ──
    bar = vector3(1108.45, 208.87, -49.44),

    -- ── CHIPS ──
    chipExchangeRate = 1,  -- $1 = 1 chip
    minChipExchange = 100,
    maxChipExchange = 100000,

    -- ── BAR DRINKS ──
    barDrinks = {
        { id = 'beer',       labelKey = "config.casino.label.beer.042edc80", label = 'Beer',        price = 50,  effect = 'thirst', value = 20 },
        { id = 'wine',       labelKey = "config.casino.label.wine.40d5ba7f", label = 'Wine',        price = 100, effect = 'thirst', value = 25 },
        { id = 'whiskey',    labelKey = "config.casino.label.whiskey.9d9537fc", label = 'Whiskey',     price = 150, effect = 'thirst', value = 30 },
        { id = 'cocktail',   labelKey = "config.casino.label.cocktail.f364c737", label = 'Cocktail',    price = 200, effect = 'thirst', value = 35 },
        { id = 'champagne',  labelKey = "config.casino.label.champagne.47892af0", label = 'Champagne',   price = 500, effect = 'thirst', value = 50 },
    },

    society = 'casino',
}
