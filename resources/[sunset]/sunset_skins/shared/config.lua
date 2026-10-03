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
    { model = 'a_m_y_skater_01',   labelKey = "config.skins.label.skater.25293053", label = 'Skater',          category = 'civilian', priceCash = 5000,  pricePP = 50  },
    { model = 'a_m_m_business_01', labelKey = "config.skins.label.business_man.78c668b1", label = 'Business Man',    category = 'civilian', priceCash = 8000,  pricePP = 80  },
    { model = 'a_m_y_hipster_01',  labelKey = "config.skins.label.hipster.603bc52d", label = 'Hipster',         category = 'civilian', priceCash = 5000,  pricePP = 50  },
    { model = 'a_m_m_beach_01',    labelKey = "config.skins.label.beach_dude.d481959e", label = 'Beach Dude',      category = 'civilian', priceCash = 4000,  pricePP = 40  },
    { model = 'a_m_y_business_01', labelKey = "config.skins.label.young_executive.dcc5a071", label = 'Young Executive', category = 'civilian', priceCash = 8000,  pricePP = 80  },
    { model = 'a_m_o_tramp_01',    labelKey = "config.skins.label.tramp.e4ddb1ed", label = 'Tramp',           category = 'civilian', priceCash = 2000,  pricePP = 20  },
    { model = 'a_m_y_stwhi_01',    labelKey = "config.skins.label.street_hood.8dbbbf80", label = 'Street Hood',     category = 'civilian', priceCash = 6000,  pricePP = 60  },
    -- ── Civilian female ──────────────────────────────────────────────────────
    { model = 'a_f_y_beach_01',    labelKey = "config.skins.label.beach_girl.4525d061", label = 'Beach Girl',      category = 'civilian', priceCash = 4000,  pricePP = 40  },
    { model = 'a_f_y_skater_01',   labelKey = "config.skins.label.skater_girl.097e618a", label = 'Skater Girl',     category = 'civilian', priceCash = 5000,  pricePP = 50  },
    { model = 'a_f_y_hipster_01',  labelKey = "config.skins.label.hipster_girl.1dd07cd6", label = 'Hipster Girl',    category = 'civilian', priceCash = 5000,  pricePP = 50  },
    { model = 'a_f_m_business_02', labelKey = "config.skins.label.business_woman.4e8b5676", label = 'Business Woman',  category = 'civilian', priceCash = 8000,  pricePP = 80  },
    -- ── Special & Story Characters ───────────────────────────────────────────
    { model = 'player_zero',       labelKey = "config.skins.label.michael_de_santa.d7d7f21a", label = 'Michael De Santa', category = 'special',  priceCash = 50000, pricePP = 500 },
    { model = 'player_one',        labelKey = "config.skins.label.franklin_clinton.f6c91f27", label = 'Franklin Clinton', category = 'special',  priceCash = 50000, pricePP = 500 },
    { model = 'player_two',        labelKey = "config.skins.label.trevor_philips.705687b2", label = 'Trevor Philips',   category = 'special',  priceCash = 50000, pricePP = 500 },
    { model = 'ig_lamardavis',     labelKey = "config.skins.label.lamar_davis.378c5e7b", label = 'Lamar Davis',      category = 'special',  priceCash = 35000, pricePP = 350 },
    { model = 'ig_lestercrest',    labelKey = "config.skins.label.lester_crest.4214f2c6", label = 'Lester Crest',     category = 'special',  priceCash = 35000, pricePP = 350 },
    { model = 'ig_davenorton',     labelKey = "config.skins.label.dave_norton.9afbfcc0", label = 'Dave Norton',      category = 'special',  priceCash = 30000, pricePP = 300 },
    { model = 's_m_m_doctor_01',   labelKey = "config.skins.label.doctor.1a22820f", label = 'Doctor',           category = 'special',  priceCash = 15000, pricePP = 150 },
    { model = 's_m_m_chef_01',     labelKey = "config.skins.label.chef.94e0212c", label = 'Chef',             category = 'special',  priceCash = 12000, pricePP = 120 },
    { model = 's_m_m_security_01', labelKey = "config.skins.label.security_guard.f3c2a861", label = 'Security Guard',   category = 'special',  priceCash = 12000, pricePP = 120 },
    { model = 's_f_y_nurse_01',    labelKey = "config.skins.label.nurse.dbc793ef", label = 'Nurse',            category = 'special',  priceCash = 15000, pricePP = 150 },
    -- ── Premium ──────────────────────────────────────────────────────────────
    { model = 'ig_bankman',        labelKey = "config.skins.label.bank_manager.c62f97f1", label = 'Bank Manager',     category = 'premium',  priceCash = 25000, pricePP = 250 },
    { model = 'csb_burgerdrug',    labelKey = "config.skins.label.cook.3ecb6ee4", label = 'Cook',             category = 'premium',  priceCash = 20000, pricePP = 200 },
    -- ── Battlepass exclusive ─────────────────────────────────────────────────
    { model = 's_m_y_swat_01',      labelKey = "config.skins.label.swat.84ecdd17", label = 'SWAT',            category = 'exclusive', battlepass = true },
    { model = 'u_m_m_streetart_01', labelKey = "config.skins.label.street_artist.c112f109", label = 'Street Artist',   category = 'exclusive', battlepass = true },
}
