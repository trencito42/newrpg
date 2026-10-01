SunsetSkins = {}

-- NPC position for the skin shop (outside Ponsonbys, Rockford Hills).
-- Swap coords to move the NPC to a different location.
SunsetSkins.ShopNPC = {
    model  = 'mp_m_shopkeep_01',
    coords = vector4(-706.15, -152.15, 37.42, 329.42),
    blip   = { sprite = 366, color = 8, scale = 0.85, labelKey = 'skins.blip.shop' },
}

-- GTA ped model skin list.
-- battlepass = true  → not purchasable; granted via battlepass tier rewards.
-- priceCash / pricePP are ignored for battlepass skins.
SunsetSkins.Skins = {
    -- ── Civilian male ────────────────────────────────────────────────────────
    { model = 'a_m_y_skater_01',   label = 'Skater',          category = 'civilian', priceCash = 5000,  pricePP = 50  },
    { model = 'a_m_m_business_01', label = 'Business Man',    category = 'civilian', priceCash = 8000,  pricePP = 80  },
    { model = 'a_m_y_hipster_01',  label = 'Hipster',         category = 'civilian', priceCash = 5000,  pricePP = 50  },
    { model = 'a_m_m_beach_01',    label = 'Beach Dude',      category = 'civilian', priceCash = 4000,  pricePP = 40  },
    { model = 'a_m_y_business_01', label = 'Young Executive', category = 'civilian', priceCash = 8000,  pricePP = 80  },
    { model = 'a_m_o_tramp_01',    label = 'Tramp',           category = 'civilian', priceCash = 2000,  pricePP = 20  },
    { model = 'a_m_y_stwhi_01',    label = 'Street Hood',     category = 'civilian', priceCash = 6000,  pricePP = 60  },
    -- ── Civilian female ──────────────────────────────────────────────────────
    { model = 'a_f_y_beach_01',    label = 'Beach Girl',      category = 'civilian', priceCash = 4000,  pricePP = 40  },
    { model = 'a_f_y_skater_01',   label = 'Skater Girl',     category = 'civilian', priceCash = 5000,  pricePP = 50  },
    { model = 'a_f_y_hipster_01',  label = 'Hipster Girl',    category = 'civilian', priceCash = 5000,  pricePP = 50  },
    { model = 'a_f_m_business_02', label = 'Business Woman',  category = 'civilian', priceCash = 8000,  pricePP = 80  },
    -- ── Special & Story Characters ───────────────────────────────────────────
    { model = 'player_zero',       label = 'Michael De Santa', category = 'special',  priceCash = 50000, pricePP = 500 },
    { model = 'player_one',        label = 'Franklin Clinton', category = 'special',  priceCash = 50000, pricePP = 500 },
    { model = 'player_two',        label = 'Trevor Philips',   category = 'special',  priceCash = 50000, pricePP = 500 },
    { model = 'ig_lamardavis',     label = 'Lamar Davis',      category = 'special',  priceCash = 35000, pricePP = 350 },
    { model = 'ig_lestercrest',    label = 'Lester Crest',     category = 'special',  priceCash = 35000, pricePP = 350 },
    { model = 'ig_davenorton',     label = 'Dave Norton',      category = 'special',  priceCash = 30000, pricePP = 300 },
    { model = 's_m_m_doctor_01',   label = 'Doctor',           category = 'special',  priceCash = 15000, pricePP = 150 },
    { model = 's_m_m_chef_01',     label = 'Chef',             category = 'special',  priceCash = 12000, pricePP = 120 },
    { model = 's_m_m_security_01', label = 'Security Guard',   category = 'special',  priceCash = 12000, pricePP = 120 },
    { model = 's_f_y_nurse_01',    label = 'Nurse',            category = 'special',  priceCash = 15000, pricePP = 150 },
    -- ── Premium ──────────────────────────────────────────────────────────────
    { model = 'ig_bankman',        label = 'Bank Manager',     category = 'premium',  priceCash = 25000, pricePP = 250 },
    { model = 'csb_burgerdrug',    label = 'Cook',             category = 'premium',  priceCash = 20000, pricePP = 200 },
    -- ── Battlepass exclusive ─────────────────────────────────────────────────
    { model = 's_m_y_swat_01',      label = 'SWAT',            category = 'exclusive', battlepass = true },
    { model = 'u_m_m_streetart_01', label = 'Street Artist',   category = 'exclusive', battlepass = true },
}
