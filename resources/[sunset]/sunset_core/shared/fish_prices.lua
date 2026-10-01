Sunset = Sunset or {}

-- [JOBS AUTHORITY] ONE table of fish sell prices (min/max per unit) shared by sunset_fishingshop
-- (24/7 + Billy Ray sale) and sunset_jobs (Fish Buyer sale). Decision: values are the former
-- sunset_fishingshop FISH_PRICES (no price is documented in docs/JOBS.md); the jobs midpoint
-- table (45/60/120/225/435/925) was exactly the midpoint of these ranges, so jobs sale value is
-- unchanged for fish without metadata. Per-fish metadata value is always clamped to `max`.
Sunset.FishPrices = {
    fresh_fish     = { min = 30,  max = 60   },
    fish_common    = { min = 40,  max = 80   },
    fish_uncommon  = { min = 90,  max = 150  },
    fish_rare      = { min = 170, max = 280  },
    fish_epic      = { min = 320, max = 550  },
    fish_legendary = { min = 650, max = 1200 },
}

function Sunset.FishPriceMid(item)
    local r = Sunset.FishPrices[item]
    if not r then return 0 end
    return math.floor((r.min + r.max) / 2)
end
