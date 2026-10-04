SunsetClans = SunsetClans or {}

SunsetClans.CreationCost = 500
-- Absolute normal capacity. 25 is the free base; 50 and 75 are sequential upgrades.
SunsetClans.MaxMembers = 75
SunsetClans.MinTagLength = 2
SunsetClans.MaxTagLength = 6
SunsetClans.MinNameLength = 3
SunsetClans.MaxNameLength = 32
SunsetClans.MaxDescriptionLength = 512
SunsetClans.MaxMotdLength = 512
SunsetClans.InviteExpirySec = 120

-- Clan Lifetime & Grace Period
SunsetClans.LifetimeDays = 30
SunsetClans.GracePeriodDays = 7
-- Default cash renewal is the 30-day tier. RC prices stay in products.lua.
SunsetClans.RenewalCash = 250000
-- Cash lifetime products. RC counterparts: clan_renew_7 / _30 / _90.
-- A courier run is about $540 and a trucker route about $700–$1,800, so these
-- are multi-hour crew sinks rather than a single paycheck.
SunsetClans.RenewalTiers = {
    { days = 7, cash = 80000 },
    { days = 30, cash = 250000 },
    { days = 90, cash = 650000 },
}
-- Racket Credit prices for renewals and slot tiers live only in
-- sunset_shop/shared/products.lua (clan_renew_* / clan_slots_*).

-- 25 is the default capacity, not a purchase. Upgrades are sequential: 50 then 75.
-- Cash: ~150 trucker routes to double a clan, then a larger sink for the last tier.
SunsetClans.BaseSlots = 25
SunsetClans.SlotTiers = {
    { slots = 25, cash = 0 },
    { slots = 50, cash = 1000000 },
    { slots = 75, cash = 2500000 },
}

function SunsetClans.renewalTier(days)
    days = math.floor(tonumber(days) or 0)
    for _, tier in ipairs(SunsetClans.RenewalTiers or {}) do
        if tier.days == days then return tier end
    end
    return nil
end

-- Next purchasable capacity strictly above the clan's current max.
function SunsetClans.nextSlotTier(current)
    current = tonumber(current) or SunsetClans.BaseSlots or 25
    local best
    for _, tier in ipairs(SunsetClans.SlotTiers or {}) do
        if tier.slots > current and tier.slots > (SunsetClans.BaseSlots or 25) then
            if not best or tier.slots < best.slots then best = tier end
        end
    end
    return best
end

-- Lowest capacity that may buy this tier (the previous rung, or the base).
function SunsetClans.slotFloor(target)
    target = tonumber(target) or 0
    local floor = SunsetClans.BaseSlots or 25
    for _, tier in ipairs(SunsetClans.SlotTiers or {}) do
        if tier.slots < target and tier.slots > floor then floor = tier.slots end
    end
    if target <= (SunsetClans.BaseSlots or 25) then return 0 end
    return floor
end

SunsetClans.TagStyles = {
    brackets = { labelKey = "config.clans.label.tag_name.1ba0b50e", label = '[tag]name', order = 1 },
    prefix_dot = { labelKey = "config.clans.label.tag_name.35b168d3", label = 'tag.name', order = 2 },
    suffix_brackets = { labelKey = "config.clans.label.name_tag.9e359e19", label = 'name[tag]', order = 3 },
    suffix_dot = { labelKey = "config.clans.label.name_tag.52402e5b", label = 'name.tag', order = 4 },
    glued_prefix = { labelKey = "config.clans.label.tagname.19a85606", label = 'tagname', order = 5 },
    glued_suffix = { labelKey = "config.clans.label.nametag.ba22ebd6", label = 'nametag', order = 6 },
}

