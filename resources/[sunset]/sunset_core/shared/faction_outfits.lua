Sunset = Sunset or {}

local function piece(drawable, texture)
    return { drawable = drawable or 0, texture = texture or 0 }
end

local function leoOutfit(top, pants, opts)
    opts = opts or {}
    local outfit = {
        [1] = piece(0, 0),
        [4] = piece(pants or 35, 0),
        [6] = piece(opts.shoes or 25, 0),
        [8] = piece(opts.undershirt or 58, 0),
        [11] = piece(top or 55, opts.topTexture or 0),
    }
    if opts.arms ~= nil then
        outfit[3] = piece(opts.arms, 0)
    end
    return outfit
end

function Sunset.BuildLeoGradeOutfits(style)
    style = style or 'lspd'
    local maleTops = {
        lspd = { 55, 56, 57, 58, 59, 60, 61, 62 },
        fib = { 55, 56, 57, 58, 59, 60, 61, 62 },
        sheriff = { 55, 55, 55, 55, 55, 55, 55, 55 },
    }
    local femaleTops = {
        lspd = { 48, 49, 50, 51, 52, 53, 54, 55 },
        fib = { 48, 49, 50, 51, 52, 53, 54, 55 },
        sheriff = { 48, 48, 48, 48, 48, 48, 48, 48 },
    }
    local malePants = style == 'sheriff' and 36 or 35
    local femalePants = style == 'sheriff' and 33 or 34
    local topsM = maleTops[style] or maleTops.lspd
    local topsF = femaleTops[style] or femaleTops.lspd
    local gradeOutfits = {}
    for grade = 0, 7 do
        local idx = grade + 1
        local sheriffTex = style == 'sheriff' and 1 or 0
        gradeOutfits[grade] = {
            male = leoOutfit(topsM[idx], malePants, {
                undershirt = style == 'fib' and 58 or 58,
                shoes = style == 'sheriff' and 24 or 25,
                topTexture = style == 'sheriff' and sheriffTex or 0,
            }),
            female = leoOutfit(topsF[idx], femalePants, {
                undershirt = style == 'fib' and 35 or 35,
                shoes = style == 'sheriff' and 24 or 25,
                topTexture = style == 'sheriff' and sheriffTex or 0,
            }),
        }
    end
    return gradeOutfits
end

function Sunset.BuildEmsGradeOutfits()
    local maleTops = { 250, 251, 252, 253, 254, 255, 256, 257 }
    local femaleTops = { 258, 259, 260, 261, 262, 263, 264, 265 }
    local gradeOutfits = {}
    for grade = 0, 7 do
        local idx = grade + 1
        gradeOutfits[grade] = {
            male = leoOutfit(maleTops[idx], 96, { undershirt = 15, shoes = 42 }),
            female = leoOutfit(femaleTops[idx], 99, { undershirt = 15, shoes = 42 }),
        }
    end
    return gradeOutfits
end

function Sunset.BuildFireGradeOutfits()
    local maleTops = { 314, 315, 316, 317, 318, 319, 320, 321 }
    local femaleTops = { 322, 323, 324, 325, 326, 327, 328, 329 }
    local gradeOutfits = {}
    for grade = 0, 7 do
        local idx = grade + 1
        gradeOutfits[grade] = {
            male = leoOutfit(maleTops[idx], 120, { undershirt = 15, shoes = 24 }),
            female = leoOutfit(femaleTops[idx], 126, { undershirt = 15, shoes = 24 }),
        }
    end
    return gradeOutfits
end

local SERVICE_OUTFIT_PRESETS = {
    mechanic = {
        maleTops = { 66, 66, 66, 73, 73, 73, 89, 89 },
        femaleTops = { 59, 59, 59, 62, 62, 62, 65, 65 },
        maleTopTextures = { 2, 2, 2, 0, 0, 0, 0, 0 },
        femaleTopTextures = { 2, 2, 2, 0, 0, 0, 0, 0 },
        malePants = 98, femalePants = 101,
        maleShoes = 12, femaleShoes = 26,
        maleArms = 11, femaleArms = 14,
        maleUndershirt = 15, femaleUndershirt = 15,
    },
    taxi = {
        maleTops = { 13, 13, 32, 32, 32, 32, 32, 32 },
        femaleTops = { 27, 27, 41, 41, 41, 41, 41, 41 },
        maleTopTextures = { 5, 5, 0, 0, 0, 0, 0, 0 },
        femaleTopTextures = { 5, 5, 0, 0, 0, 0, 0, 0 },
        malePants = 24, femalePants = 34,
        maleShoes = 10, femaleShoes = 29,
        maleArms = 11, femaleArms = 14,
        maleUndershirt = 31, femaleUndershirt = 35,
    },
    cartel = {
        maleTops = { 13, 13, 31, 31, 31, 31, 31, 31 },
        femaleTops = { 27, 27, 38, 38, 38, 38, 38, 38 },
        maleTopTextures = { 0, 0, 0, 0, 0, 0, 0, 0 },
        femaleTopTextures = { 0, 0, 0, 0, 0, 0, 0, 0 },
        malePants = 10, femalePants = 6,
        maleShoes = 12, femaleShoes = 26,
        maleArms = 11, femaleArms = 14,
        maleUndershirt = 15, femaleUndershirt = 15,
    },
    syndicate = {
        maleTops = { 16, 16, 57, 57, 57, 57, 57, 57 },
        femaleTops = { 30, 30, 49, 49, 49, 49, 49, 49 },
        maleTopTextures = { 0, 0, 0, 0, 0, 0, 0, 0 },
        femaleTopTextures = { 0, 0, 0, 0, 0, 0, 0, 0 },
        malePants = 4, femalePants = 3,
        maleShoes = 1, femaleShoes = 3,
        maleArms = 0, femaleArms = 14,
        maleUndershirt = 15, femaleUndershirt = 15,
    },
}

function Sunset.BuildServiceGradeOutfits(presetKey)
    local preset = SERVICE_OUTFIT_PRESETS[presetKey] or SERVICE_OUTFIT_PRESETS.mechanic
    local gradeOutfits = {}
    for grade = 0, 7 do
        local idx = grade + 1
        gradeOutfits[grade] = {
            male = leoOutfit(preset.maleTops[idx], preset.malePants, {
                undershirt = preset.maleUndershirt,
                shoes = preset.maleShoes,
                topTexture = preset.maleTopTextures[idx] or 0,
            }),
            female = leoOutfit(preset.femaleTops[idx], preset.femalePants, {
                undershirt = preset.femaleUndershirt,
                shoes = preset.femaleShoes,
                topTexture = preset.femaleTopTextures[idx] or 0,
            }),
        }
    end
    return gradeOutfits
end

function Sunset.BuildServiceLoadout(presetKey, opts)
    opts = opts or {}
    local gradeOutfits = Sunset.BuildServiceGradeOutfits(presetKey)
    local fallbackMale = gradeOutfits[0] and gradeOutfits[0].male
    local fallbackFemale = gradeOutfits[0] and gradeOutfits[0].female
    return {
        armor = opts.armor or 0,
        male = fallbackMale,
        female = fallbackFemale,
        gradeOutfits = gradeOutfits,
        weapons = opts.weapons or {
            { weapon = 'WEAPON_FLASHLIGHT', ammo = 0 },
        },
    }
end

function Sunset.BuildLawEnforcementLoadout(style, vehicle, extraWeapons)
    local gradeOutfits = Sunset.BuildLeoGradeOutfits(style)
    local fallbackMale = gradeOutfits[0] and gradeOutfits[0].male
    local fallbackFemale = gradeOutfits[0] and gradeOutfits[0].female
    return {
        armor = 100,
        male = fallbackMale,
        female = fallbackFemale,
        gradeOutfits = gradeOutfits,
        weapons = {
            { weapon = 'WEAPON_NIGHTSTICK', ammo = 0 },
            { weapon = 'WEAPON_FLASHLIGHT', ammo = 0 },
            { weapon = 'WEAPON_STUNGUN', ammo = 0 },
            { weapon = 'WEAPON_COMBATPISTOL', ammo = 90 },
        },
        gradeWeapons = {
            [3] = {
                { weapon = 'WEAPON_CARBINERIFLE', ammo = 120 },
                { weapon = 'WEAPON_PUMPSHOTGUN', ammo = 24 },
            },
            [4] = (extraWeapons and extraWeapons[4]) or {
                { weapon = 'WEAPON_CARBINERIFLE', ammo = 150 },
                { weapon = 'WEAPON_PUMPSHOTGUN', ammo = 32 },
            },
            [5] = (extraWeapons and extraWeapons[5]) or {
                { weapon = 'WEAPON_CARBINERIFLE', ammo = 180 },
                { weapon = 'WEAPON_SMG', ammo = 120 },
            },
            [6] = (extraWeapons and extraWeapons[6]) or {
                { weapon = 'WEAPON_CARBINERIFLE', ammo = 210 },
                { weapon = 'WEAPON_SMG', ammo = 150 },
            },
            [7] = (extraWeapons and extraWeapons[7]) or {
                { weapon = 'WEAPON_CARBINERIFLE', ammo = 240 },
                { weapon = 'WEAPON_SMG', ammo = 180 },
                { weapon = 'WEAPON_PUMPSHOTGUN', ammo = 40 },
            },
        },
        vehicle = vehicle,
    }
end

function Sunset.ResolveFactionOutfit(loadout, grade, gender)
    if not loadout then return nil end
    grade = tonumber(grade) or 0
    gender = tonumber(gender) or 0
    local gradeOutfits = loadout.gradeOutfits
    local row = gradeOutfits and gradeOutfits[grade]
    if row then
        return (gender == 1 and row.female) or row.male
    end
    return (gender == 1 and loadout.female) or loadout.male
end

-- ====================================================================
-- AUTHENTIC REAL GTA V PED SKINS FOR ALL FACTIONS
-- ====================================================================
Sunset.FactionSkins = {
    police = {
        labelKey = "config.core.label.lspd.6cf89c44", label = 'LSPD',
        defaultMale = 's_m_y_cop_01',
        defaultFemale = 's_f_y_cop_01',
        gradeMale = {
            [0] = 's_m_y_cop_01',
            [1] = 's_m_y_cop_01',
            [2] = 's_m_y_hwaycop_01',
            [3] = 'csb_cop',
            [4] = 's_m_m_ciasec_01',
            [5] = 's_m_y_swat_01',
            [6] = 's_m_m_fiboffice_01',
            [7] = 'ig_fbisuit_01',
        },
        gradeFemale = {
            [0] = 's_f_y_cop_01',
            [1] = 's_f_y_cop_01',
            [2] = 's_f_y_cop_01',
            [3] = 's_f_y_cop_01',
            [4] = 's_f_y_cop_01',
            [5] = 's_f_y_cop_01',
            [6] = 's_f_y_cop_01',
            [7] = 's_f_y_cop_01',
        },
        options = {
            { key = 'cop', labelKey = "config.core.label.lspd_patrol_officer.b72062a6", label = 'LSPD Patrol Officer', male = 's_m_y_cop_01', female = 's_f_y_cop_01', minGrade = 0 },
            { key = 'hway', labelKey = "config.core.label.highway_patrol_officer.9f332959", label = 'Highway Patrol Officer', male = 's_m_y_hwaycop_01', female = 's_f_y_cop_01', minGrade = 1 },
            { key = 'senior', labelKey = "config.core.label.lspd_senior_sergeant.0f5a7d5e", label = 'LSPD Senior / Sergeant', male = 'csb_cop', female = 's_f_y_cop_01', minGrade = 2 },
            { key = 'swat', labelKey = "config.core.label.swat_special_weapons_tactics.5b68ba6e", label = 'SWAT Special Weapons & Tactics', male = 's_m_y_swat_01', female = 's_f_y_cop_01', minGrade = 4 },
            { key = 'command', labelKey = "config.core.label.command_chief_executive.94014fe1", label = 'Command / Chief Executive', male = 'ig_fbisuit_01', female = 's_f_y_cop_01', minGrade = 6 },
        },
    },
    sheriff = {
        labelKey = "config.core.label.san_andreas_sheriff.9c5edfc3", label = 'San Andreas Sheriff',
        defaultMale = 's_m_y_sheriff_01',
        defaultFemale = 's_f_y_sheriff_01',
        gradeMale = {
            [0] = 's_m_y_sheriff_01',
            [1] = 's_m_y_sheriff_01',
            [2] = 's_m_y_hwaycop_01',
            [3] = 's_m_y_sheriff_01',
            [4] = 's_m_y_ranger_01',
            [5] = 's_m_y_swat_01',
            [6] = 's_m_m_armoured_01',
            [7] = 's_m_m_highsec_01',
        },
        gradeFemale = {
            [0] = 's_f_y_sheriff_01',
            [1] = 's_f_y_sheriff_01',
            [2] = 's_f_y_sheriff_01',
            [3] = 's_f_y_sheriff_01',
            [4] = 's_f_y_ranger_01',
            [5] = 's_f_y_sheriff_01',
            [6] = 's_f_y_sheriff_01',
            [7] = 's_f_y_sheriff_01',
        },
        options = {
            { key = 'sheriff', labelKey = "config.core.label.sheriff_patrol_deputy.7d4575c2", label = 'Sheriff Patrol Deputy', male = 's_m_y_sheriff_01', female = 's_f_y_sheriff_01', minGrade = 0 },
            { key = 'hway', labelKey = "config.core.label.county_highway_patrol.a0b16985", label = 'County Highway Patrol', male = 's_m_y_hwaycop_01', female = 's_f_y_sheriff_01', minGrade = 1 },
            { key = 'ranger', labelKey = "config.core.label.park_county_ranger.50c4de5c", label = 'Park & County Ranger', male = 's_m_y_ranger_01', female = 's_f_y_ranger_01', minGrade = 3 },
            { key = 'swat', labelKey = "config.core.label.county_tactical_response_swat.9f4cb67c", label = 'County Tactical Response / SWAT', male = 's_m_y_swat_01', female = 's_f_y_sheriff_01', minGrade = 4 },
            { key = 'command', labelKey = "config.core.label.high_sheriff_command.54c2b7dd", label = 'High Sheriff Command', male = 's_m_m_highsec_01', female = 's_f_y_sheriff_01', minGrade = 6 },
        },
    },
    fib = {
        labelKey = "config.core.label.fib.dbe1d4cc", label = 'FIB',
        defaultMale = 'mp_m_fibsec_01',
        defaultFemale = 's_f_m_fembarber',
        gradeMale = {
            [0] = 'mp_m_fibsec_01',
            [1] = 's_m_m_fiboffice_01',
            [2] = 's_m_m_fiboffice_02',
            [3] = 's_m_m_ciasec_01',
            [4] = 'ig_fbisuit_01',
            [5] = 's_m_y_blackops_01',
            [6] = 'ig_davenorton',
            [7] = 'ig_stevehains',
        },
        gradeFemale = {
            [0] = 's_f_m_fembarber',
            [1] = 's_f_m_fembarber',
            [2] = 's_f_m_fembarber',
            [3] = 's_f_m_fembarber',
            [4] = 's_f_m_fembarber',
            [5] = 's_f_m_fembarber',
            [6] = 's_f_m_fembarber',
            [7] = 's_f_m_fembarber',
        },
        options = {
            { key = 'tactical', labelKey = "config.core.label.fib_security_agent.f5ed22d1", label = 'FIB Security Agent', male = 'mp_m_fibsec_01', female = 's_f_y_cop_01', minGrade = 0 },
            { key = 'agent', labelKey = "config.core.label.special_agent_suit.7344511c", label = 'Special Agent Suit', male = 's_m_m_fiboffice_02', female = 's_f_m_fembarber', minGrade = 1 },
            { key = 'raid', labelKey = "config.core.label.black_ops_raid_specialist.93f7045a", label = 'Black Ops Raid Specialist', male = 's_m_y_blackops_01', female = 's_f_y_cop_01', minGrade = 3 },
            { key = 'director', labelKey = "config.core.label.fib_executive_director.86a267b3", label = 'FIB Executive Director', male = 'ig_stevehains', female = 's_f_m_fembarber', minGrade = 5 },
        },
    },
    medic = {
        labelKey = "config.core.label.pillbox_ems.9792953d", label = 'Pillbox EMS',
        defaultMale = 's_m_m_paramedic_01',
        defaultFemale = 's_f_y_scrubs_01',
        gradeMale = {
            [0] = 's_m_m_paramedic_01',
            [1] = 's_m_m_paramedic_01',
            [2] = 's_m_m_paramedic_01',
            [3] = 's_m_y_autopsy_01',
            [4] = 's_m_m_doctor_01',
            [5] = 's_m_m_doctor_01',
            [6] = 's_m_m_doctor_01',
            [7] = 's_m_m_scientist_01',
        },
        gradeFemale = {
            [0] = 's_f_y_scrubs_01',
            [1] = 's_f_y_scrubs_01',
            [2] = 's_f_y_scrubs_01',
            [3] = 's_f_y_scrubs_01',
            [4] = 's_f_y_scrubs_01',
            [5] = 's_f_y_scrubs_01',
            [6] = 's_f_y_scrubs_01',
            [7] = 's_f_y_scrubs_01',
        },
        options = {
            { key = 'paramedic', labelKey = "config.core.label.ambulance_paramedic.fb8d0249", label = 'Ambulance Paramedic', male = 's_m_m_paramedic_01', female = 's_f_y_scrubs_01', minGrade = 0 },
            { key = 'coroner', labelKey = "config.core.label.medical_examiner_coroner.a9f830a2", label = 'Medical Examiner / Coroner', male = 's_m_y_autopsy_01', female = 's_f_y_scrubs_01', minGrade = 2 },
            { key = 'doctor', labelKey = "config.core.label.hospital_doctor_surgeon.ae98ee42", label = 'Hospital Doctor / Surgeon', male = 's_m_m_doctor_01', female = 's_f_y_scrubs_01', minGrade = 4 },
        },
    },
    lsfd = {
        labelKey = "config.core.label.ls_fire_department.29e234c9", label = 'LS Fire Department',
        defaultMale = 's_m_y_fireman_01',
        defaultFemale = 's_m_y_fireman_01',
        gradeMale = {
            [0] = 's_m_y_fireman_01',
            [1] = 's_m_y_fireman_01',
            [2] = 's_m_y_fireman_01',
            [3] = 's_m_y_fireman_01',
            [4] = 's_m_y_fireman_01',
            [5] = 's_m_y_fireman_01',
            [6] = 's_m_m_paramedic_01',
            [7] = 's_m_m_highsec_01',
        },
        gradeFemale = {
            [0] = 's_m_y_fireman_01',
            [1] = 's_m_y_fireman_01',
            [2] = 's_m_y_fireman_01',
            [3] = 's_m_y_fireman_01',
            [4] = 's_m_y_fireman_01',
            [5] = 's_m_y_fireman_01',
            [6] = 's_m_m_paramedic_01',
            [7] = 's_m_m_highsec_01',
        },
        options = {
            { key = 'fireman', labelKey = "config.core.label.firefighter_bunker_gear.d3a170e8", label = 'Firefighter Bunker Gear', male = 's_m_y_fireman_01', female = 's_m_y_fireman_01', minGrade = 0 },
            { key = 'paramedic', labelKey = "config.core.label.paramedic_first_responder.7faaabf0", label = 'Paramedic / First Responder', male = 's_m_m_paramedic_01', female = 's_f_y_scrubs_01', minGrade = 2 },
            { key = 'chief', labelKey = "config.core.label.battalion_fire_chief.565ef13b", label = 'Battalion Fire Chief', male = 's_m_m_highsec_01', female = 's_m_m_highsec_01', minGrade = 6 },
        },
    },
    mechanic = {
        labelKey = "config.core.label.ls_customs.48d021ab", label = 'LS Customs',
        defaultMale = 's_m_y_xmech_01',
        defaultFemale = 's_f_y_airhostess_01',
        gradeMale = {
            [0] = 's_m_y_construct_01',
            [1] = 's_m_y_xmech_01',
            [2] = 's_m_y_xmech_02',
            [3] = 's_m_m_autoshop_01',
            [4] = 's_m_m_autoshop_02',
            [5] = 'ig_hao',
            [6] = 'a_m_m_og_boss_01',
            [7] = 'ig_benny',
        },
        gradeFemale = {
            [0] = 's_f_y_airhostess_01',
            [1] = 's_f_y_airhostess_01',
            [2] = 's_f_y_migrant_01',
            [3] = 's_f_y_migrant_01',
            [4] = 's_f_y_migrant_01',
            [5] = 's_f_y_migrant_01',
            [6] = 's_f_y_migrant_01',
            [7] = 's_f_y_migrant_01',
        },
        options = {
            { key = 'apprentice', labelKey = "config.core.label.apprentice_mechanic.86415eba", label = 'Apprentice Mechanic', male = 's_m_y_construct_01', female = 's_f_y_airhostess_01', minGrade = 0 },
            { key = 'mechanic', labelKey = "config.core.label.customs_tuner_overalls.17e24230", label = 'Customs Tuner Overalls', male = 's_m_y_xmech_01', female = 's_f_y_migrant_01', minGrade = 1 },
            { key = 'master', labelKey = "config.core.label.master_autoshop_specialist.0e258eac", label = 'Master Autoshop Specialist', male = 's_m_m_autoshop_01', female = 's_f_y_migrant_01', minGrade = 3 },
            { key = 'legend', labelKey = "config.core.label.legendary_street_tuner.b6213911", label = 'Legendary Street Tuner', male = 'ig_hao', female = 's_f_y_migrant_01', minGrade = 5 },
            { key = 'benny', labelKey = "config.core.label.benny_motorworks_boss.e721dc11", label = 'Benny Motorworks Boss', male = 'ig_benny', female = 's_f_y_migrant_01', minGrade = 7 },
        },
    },
    taxi = {
        labelKey = "config.core.label.downtown_cab_co.508964e9", label = 'Downtown Cab Co.',
        defaultMale = 'a_m_y_stlat_01',
        defaultFemale = 'a_f_y_business_01',
        gradeMale = {
            [0] = 'a_m_y_stlat_01',
            [1] = 'a_m_m_prolhost_01',
            [2] = 'a_m_m_salton_02',
            [3] = 's_m_m_strvend_01',
            [4] = 'a_m_y_vinewood_02',
            [5] = 'a_m_y_business_02',
            [6] = 'a_m_m_eastsa_01',
            [7] = 'a_m_m_business_01',
        },
        gradeFemale = {
            [0] = 'a_f_y_business_01',
            [1] = 'a_f_m_bevhills_01',
            [2] = 'a_f_y_tourist_01',
            [3] = 'a_f_y_business_02',
            [4] = 'a_f_y_vinewood_02',
            [5] = 'a_f_y_business_03',
            [6] = 'a_f_m_business_02',
            [7] = 'a_f_m_business_02',
        },
        options = {
            { key = 'driver', labelKey = "config.core.label.classic_city_cab_driver.e6aed36f", label = 'Classic City Cab Driver', male = 'a_m_y_stlat_01', female = 'a_f_y_business_01', minGrade = 0 },
            { key = 'tour', labelKey = "config.core.label.airport_tourist_chauffeur.0347923f", label = 'Airport / Tourist Chauffeur', male = 'a_m_m_salton_02', female = 'a_f_y_tourist_01', minGrade = 2 },
            { key = 'vip', labelKey = "config.core.label.vip_luxury_chauffeur.323cb26b", label = 'VIP Luxury Chauffeur', male = 'a_m_y_business_02', female = 'a_f_y_business_03', minGrade = 4 },
            { key = 'director', labelKey = "config.core.label.company_director_suit.834ff5bd", label = 'Company Director Suit', male = 'a_m_m_business_01', female = 'a_f_m_business_02', minGrade = 6 },
        },
    },
    lssi = {
        labelKey = "config.core.label.lssi_license_safety.76d13142", label = 'LSSI — License & Safety',
        defaultMale = 's_m_m_highsec_02',
        defaultFemale = 'a_f_y_business_02',
        gradeMale = {
            [0] = 's_m_m_bouncer_01',
            [1] = 's_m_m_security_01',
            [2] = 's_m_m_fibsec_01',
            [3] = 's_m_m_highsec_02',
            [4] = 's_m_m_fiboffice_01',
            [5] = 's_m_y_blackops_02',
            [6] = 'ig_fbisuit_01',
            [7] = 's_m_m_fiboffice_02',
        },
        gradeFemale = {
            [0] = 's_f_y_cop_01',
            [1] = 's_f_y_cop_01',
            [2] = 's_f_m_fembarber',
            [3] = 's_f_m_fembarber',
            [4] = 's_f_m_fembarber',
            [5] = 's_f_m_fembarber',
            [6] = 's_f_m_fembarber',
            [7] = 's_f_m_fembarber',
        },
        options = {
            { key = 'inspector', labelKey = "config.core.label.driving_instructor_uniform.a5c2ad35", label = 'Driving Instructor Uniform', male = 's_m_m_security_01', female = 's_f_y_cop_01', minGrade = 0 },
            { key = 'investigator', labelKey = "config.core.label.state_safety_investigator.54a0a154", label = 'State Safety Investigator', male = 's_m_m_highsec_02', female = 's_f_m_fembarber', minGrade = 2 },
            { key = 'commissioner', labelKey = "config.core.label.state_commissioner_suit.7fb9a0ae", label = 'State Commissioner Suit', male = 's_m_m_fiboffice_02', female = 's_f_m_fembarber', minGrade = 6 },
        },
    },
    sunset_cartel = {
        labelKey = "config.core.label.sunset_cartel.818b6f6a", label = 'Sunset Cartel',
        defaultMale = 'g_m_y_mexgoon_01',
        defaultFemale = 'g_f_y_vagos_01',
        gradeMale = {
            [0] = 'g_m_y_mexgang_01',
            [1] = 'g_m_y_mexgoon_01',
            [2] = 'g_m_y_mexgoon_02',
            [3] = 'g_m_y_mexgoon_03',
            [4] = 'g_m_m_mexboss_01',
            [5] = 'g_m_m_mexboss_02',
            [6] = 'g_m_y_salvaloon_01',
            [7] = 'ig_ortega',
        },
        gradeFemale = {
            [0] = 'g_f_y_vagos_01',
            [1] = 'g_f_y_vagos_01',
            [2] = 'g_f_y_vagos_01',
            [3] = 'g_f_y_vagos_01',
            [4] = 'g_f_y_vagos_01',
            [5] = 'g_f_y_vagos_01',
            [6] = 'g_f_y_vagos_01',
            [7] = 'g_f_y_vagos_01',
        },
        options = {
            { key = 'sicario', labelKey = "config.core.label.tattooed_cartel_hitman.b6d85e85", label = 'Cartel Sicario Tatuat', male = 'g_m_y_mexgang_01', female = 'g_f_y_vagos_01', minGrade = 0 },
            { key = 'enforcer', labelKey = "config.core.label.cartel_tactical_soldier.8c165245", label = 'Soldat Cartel Tactic', male = 'g_m_y_mexgoon_02', female = 'g_f_y_vagos_01', minGrade = 2 },
            { key = 'capo', labelKey = "config.core.label.cartel_capo.1b62c802", label = 'Capo Cartel', male = 'g_m_m_mexboss_01', female = 'g_f_y_vagos_01', minGrade = 4 },
            { key = 'patron', labelKey = "config.core.label.el_patron_supreme_leader.f8521420", label = 'El Patrón / Lider Suprem', male = 'ig_ortega', female = 'g_f_y_vagos_01', minGrade = 6 },
        },
    },
    night_syndicate = {
        labelKey = "config.core.label.night_syndicate.a1475a1a", label = 'Night Syndicate',
        defaultMale = 'g_m_y_korean_01',
        defaultFemale = 'g_f_y_ballas_01',
        gradeMale = {
            [0] = 'g_m_y_korean_01',
            [1] = 'g_m_y_korean_02',
            [2] = 'g_m_y_korlieut_01',
            [3] = 'g_m_y_strpunk_01',
            [4] = 'g_m_m_korboss_01',
            [5] = 'g_m_m_chigoon_01',
            [6] = 'g_m_m_chiboss_01',
            [7] = 'ig_popov',
        },
        gradeFemale = {
            [0] = 'g_f_y_ballas_01',
            [1] = 'g_f_y_ballas_01',
            [2] = 'g_f_y_ballas_01',
            [3] = 'g_f_y_ballas_01',
            [4] = 'g_f_y_ballas_01',
            [5] = 'g_f_y_ballas_01',
            [6] = 'g_f_y_ballas_01',
            [7] = 'g_f_y_ballas_01',
        },
        options = {
            { key = 'associate', labelKey = "config.core.label.syndicate_street_enforcer.a28795bd", label = 'Syndicate Street Enforcer', male = 'g_m_y_korean_01', female = 'g_f_y_ballas_01', minGrade = 0 },
            { key = 'hitman', labelKey = "config.core.label.syndicate_hitman.d692a584", label = 'Syndicate Hitman', male = 'g_m_y_korlieut_01', female = 'g_f_y_ballas_01', minGrade = 2 },
            { key = 'captain', labelKey = "config.core.label.syndicate_underboss.4694798d", label = 'Syndicate Underboss', male = 'g_m_m_chigoon_01', female = 'g_f_y_ballas_01', minGrade = 4 },
            { key = 'kingpin', labelKey = "config.core.label.syndicate_kingpin_don.c07bd4bf", label = 'Syndicate Kingpin / Don', male = 'ig_popov', female = 'g_f_y_ballas_01', minGrade = 6 },
        },
    },
}

function Sunset.ResolveFactionSkin(factionId, grade, gender)
    local def = Sunset.FactionSkins[factionId]
    if not def then return nil end
    grade = tonumber(grade) or 0
    gender = tonumber(gender) or 0
    local isFemale = gender == 1
    local gradeTable = isFemale and def.gradeFemale or def.gradeMale
    local skin = gradeTable and gradeTable[grade]
    if not skin then
        skin = isFemale and def.defaultFemale or def.defaultMale
    end
    return skin
end

function Sunset.GetFactionSkinOptions(factionId, grade, gender)
    local def = Sunset.FactionSkins[factionId]
    if not def or not def.options then return {} end
    grade = tonumber(grade) or 0
    gender = tonumber(gender) or 0
    local isFemale = gender == 1
    local list = {}
    for _, opt in ipairs(def.options) do
        local minG = opt.minGrade or 0
        if grade >= minG then
            list[#list + 1] = {
                index = #list + 1,
                key = opt.key,
                label = opt.label,
                model = isFemale and opt.female or opt.male,
                minGrade = minG,
            }
        end
    end
    return list
end
