SunsetClans = SunsetClans or {}

SunsetClans.CreationCost = 500
SunsetClans.MaxMembers = 25
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
SunsetClans.RenewalCash = 250000
SunsetClans.RenewalPP = 500

-- Clan Member Slot Upgrade Tiers (Base is 10 slots)
SunsetClans.BaseSlots = 10
SunsetClans.SlotTiers = {
    { slots = 10, cash = 0, pp = 0 },
    { slots = 15, cash = 100000, pp = 200 },
    { slots = 20, cash = 250000, pp = 400 },
    { slots = 25, cash = 500000, pp = 750 },
}

SunsetClans.TagStyles = {
    brackets = { labelKey = "config.clans.label.tag_name.1ba0b50e", label = '[tag]name', order = 1 },
    prefix_dot = { labelKey = "config.clans.label.tag_name.35b168d3", label = 'tag.name', order = 2 },
    suffix_brackets = { labelKey = "config.clans.label.name_tag.9e359e19", label = 'name[tag]', order = 3 },
    suffix_dot = { labelKey = "config.clans.label.name_tag.52402e5b", label = 'name.tag', order = 4 },
    glued_prefix = { labelKey = "config.clans.label.tagname.19a85606", label = 'tagname', order = 5 },
    glued_suffix = { labelKey = "config.clans.label.nametag.ba22ebd6", label = 'nametag', order = 6 },
}

