-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — Vehicle Impound (shared/config.lua)
-- ═══════════════════════════════════════════════════════════════

SunsetImpound = SunsetImpound or {}

SunsetImpound.Config = {
    -- Impound lot location (marker + recovery point)
    lot = vector3(409.30, -1623.00, 29.30),
    lotHeading = 230.0,

    -- Fees
    baseFee = 500,
    dailyFee = 100,

    -- Auto-sell after N days if not recovered
    autoSellDays = 7,

    -- Impound reasons (police select from these)
    reasons = {
        { id = 'no_license', labelKey = "config.impound.label.driving_without_a_license.d483e135", label = 'Driving without a license', fee = 500 },
        { id = 'reckless', labelKey = "config.impound.label.reckless_driving.37f5ee6d", label = 'Reckless driving', fee = 750 },
        { id = 'stolen', labelKey = "config.impound.label.stolen_vehicle.147a9f74", label = 'Stolen vehicle', fee = 1000 },
        { id = 'illegal_mods', labelKey = "config.impound.label.illegal_modifications.f188983b", label = 'Illegal modifications', fee = 600 },
        { id = 'evading', labelKey = "config.impound.label.evading_police.5e404190", label = 'Evading police', fee = 1500 },
        { id = 'other', labelKey = "config.impound.label.other.4c972147", label = 'Other', fee = 500 },
    },
}
