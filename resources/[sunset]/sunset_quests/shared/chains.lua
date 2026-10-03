Sunset = Sunset or {}

-- ============================================================
--  RACKET RPG — Canonical Quest & Progression Chains
-- ============================================================

Sunset.QuestCategories = {
    main = { id = 'main', labelKey = 'quests.category.main', order = 1 },
    careers = { id = 'careers', labelKey = 'quests.category.careers', order = 2 },
    criminal = { id = 'criminal', labelKey = 'quests.category.criminal', order = 3 },
    social = { id = 'social', labelKey = 'quests.category.social', order = 4 },
    clans = { id = 'clans', labelKey = 'quests.category.clans', order = 5 },
}

Sunset.QuestChains = {
    -- ══════════════════════════════════════════════════════════════════════
    --  MAIN STORY — CHAPTER 1: WELCOME TO RACKET
    -- ══════════════════════════════════════════════════════════════════════
    onboarding = {
        category = 'main',
        labelKey = 'quests.chain.onboarding',
        order = 1,
        enabled = true,
        quests = {
            {
                key = 'onb_orientation',
                labelKey = 'quests.entry.onb_orientation.label',
                descriptionKey = 'quests.entry.onb_orientation.description',
                objectives = {
                    { type = 'help_opened', target = 1, labelKey = 'quests.entry.onb_orientation.objective' },
                },
                reward = { money = 150, xp = 25, rp = 1, reason = 'quest_onboarding_guide' },
            },
            {
                key = 'onb_store_supplies',
                labelKey = 'quests.entry.onb_store_supplies.label',
                descriptionKey = 'quests.entry.onb_store_supplies.description',
                objectives = {
                    { type = 'item_purchased', target = 1, labelKey = 'quests.entry.onb_store_supplies.objective' },
                },
                reward = { money = 200, xp = 30, rp = 1, reason = 'quest_onboarding_store' },
            },
            {
                key = 'onb_banking_atm',
                labelKey = 'quests.entry.onb_banking_atm.label',
                descriptionKey = 'quests.entry.onb_banking_atm.description',
                objectives = {
                    { type = 'atm_used', target = 1, labelKey = 'quests.entry.onb_banking_atm.objective' },
                },
                reward = { money = 250, xp = 35, rp = 1, reason = 'quest_onboarding_atm' },
            },
            {
                key = 'onb_jobcenter',
                labelKey = 'quests.entry.onb_jobcenter.label',
                descriptionKey = 'quests.entry.onb_jobcenter.description',
                objectives = {
                    { type = 'job_hired', target = 1, labelKey = 'quests.entry.onb_jobcenter.objective' },
                },
                reward = { money = 300, xp = 40, rp = 2, reason = 'quest_jobcenter' },
                unlocksChain = 'driving',
            },
        },
    },

    -- ══════════════════════════════════════════════════════════════════════
    --  MAIN STORY — CHAPTER 2: GETTING ON THE ROAD (Driving School First!)
    -- ══════════════════════════════════════════════════════════════════════
    driving = {
        category = 'main',
        labelKey = 'quests.chain.driving',
        order = 2,
        enabled = true,
        requiresChain = 'onboarding',
        quests = {
            {
                key = 'drv_license',
                labelKey = 'quests.entry.drv_license.label',
                descriptionKey = 'quests.entry.drv_license.description',
                objectives = {
                    { type = 'license_obtained', target = 1, license = 'driver', labelKey = 'quests.entry.drv_license.objective' },
                },
                reward = { money = 500, xp = 60, rp = 2, reason = 'quest_license_driver' },
            },
            {
                key = 'drv_rental_drive',
                labelKey = 'quests.entry.drv_rental_drive.label',
                descriptionKey = 'quests.entry.drv_rental_drive.description',
                objectives = {
                    { type = 'vehicle_rented', target = 1, labelKey = 'quests.entry.drv_rental_drive.objective' },
                },
                reward = { money = 350, xp = 40, rp = 2, reason = 'quest_rental_drive' },
                unlocksChain = 'first_job',
            },
        },
    },

    -- ══════════════════════════════════════════════════════════════════════
    --  MAIN STORY — CHAPTER 3: FIRST PAYCHECK (Licensed Civilian Jobs)
    -- ══════════════════════════════════════════════════════════════════════
    first_job = {
        category = 'main',
        labelKey = 'quests.chain.first_job',
        order = 3,
        enabled = true,
        requiresChain = 'driving',
        quests = {
            {
                key = 'fj_first_shift',
                labelKey = 'quests.entry.fj_first_shift.label',
                descriptionKey = 'quests.entry.fj_first_shift.description',
                objectives = {
                    { type = 'job_shift_completed', target = 1, labelKey = 'quests.entry.fj_first_shift.objective' },
                },
                reward = { money = 600, xp = 70, rp = 3, reason = 'quest_first_shift' },
            },
            {
                key = 'fj_dedication',
                labelKey = 'quests.entry.fj_dedication.label',
                descriptionKey = 'quests.entry.fj_dedication.description',
                objectives = {
                    { type = 'job_shift_completed', target = 3, labelKey = 'quests.entry.fj_dedication.objective' },
                },
                reward = { money = 1000, xp = 100, rp = 4, reason = 'quest_dedication' },
                unlocksChain = 'first_car',
            },
        },
    },

    -- ══════════════════════════════════════════════════════════════════════
    --  MAIN STORY — CHAPTER 4: YOUR FIRST CAR (Dealership & Parking)
    -- ══════════════════════════════════════════════════════════════════════
    first_car = {
        category = 'main',
        labelKey = 'quests.chain.first_car',
        order = 4,
        enabled = true,
        requiresChain = 'first_job',
        quests = {
            {
                key = 'drv_first_car',
                labelKey = 'quests.entry.drv_first_car.label',
                descriptionKey = 'quests.entry.drv_first_car.description',
                objectives = {
                    { type = 'vehicle_purchased', target = 1, labelKey = 'quests.entry.drv_first_car.objective' },
                },
                reward = { money = 1200, xp = 120, rp = 5, reason = 'quest_first_car' },
            },
            {
                key = 'car_garage_park',
                labelKey = 'quests.entry.car_garage_park.label',
                descriptionKey = 'quests.entry.car_garage_park.description',
                objectives = {
                    { type = 'vehicle_stored', target = 1, labelKey = 'quests.entry.car_garage_park.objective' },
                },
                reward = { money = 500, xp = 50, rp = 2, reason = 'quest_garage_park' },
                unlocksChain = 'building_life',
            },
        },
    },

    -- ══════════════════════════════════════════════════════════════════════
    --  MAIN STORY — CHAPTER 5: BUILDING A LIFE (Properties, Style & Level 10)
    -- ══════════════════════════════════════════════════════════════════════
    building_life = {
        category = 'main',
        labelKey = 'quests.chain.building_life',
        order = 5,
        enabled = true,
        requiresChain = 'first_car',
        quests = {
            {
                key = 'life_clothing',
                labelKey = 'quests.entry.life_clothing.label',
                descriptionKey = 'quests.entry.life_clothing.description',
                objectives = {
                    { type = 'clothing_customized', target = 1, labelKey = 'quests.entry.life_clothing.objective' },
                },
                reward = { money = 400, xp = 40, rp = 2, reason = 'quest_clothing' },
            },
            {
                key = 'hou_rent',
                labelKey = 'quests.entry.hou_rent.label',
                descriptionKey = 'quests.entry.hou_rent.description',
                objectives = {
                    { type = 'property_rented', target = 1, labelKey = 'quests.entry.hou_rent.objective' },
                },
                reward = { money = 800, xp = 80, rp = 3, reason = 'quest_rental' },
            },
            {
                key = 'life_reach_level10',
                labelKey = 'quests.entry.life_reach_level10.label',
                descriptionKey = 'quests.entry.life_reach_level10.description',
                objectives = {
                    { type = 'level_reached', target = 10, labelKey = 'quests.entry.life_reach_level10.objective' },
                },
                reward = { money = 2500, xp = 250, rp = 8, reason = 'quest_reach_level10' },
            },
        },
    },

    -- ══════════════════════════════════════════════════════════════════════
    --  CAREERS TRACK — SPECIALIZED CIVILIAN JOBS
    -- ══════════════════════════════════════════════════════════════════════
    careers = {
        category = 'careers',
        labelKey = 'quests.chain.careers',
        order = 6,
        enabled = true,
        requiresChain = 'first_job',
        quests = {
            {
                key = 'car_trucker_shifts',
                labelKey = 'quests.entry.car_trucker_shifts.label',
                descriptionKey = 'quests.entry.car_trucker_shifts.description',
                objectives = {
                    { type = 'job_shift_completed', target = 5, jobId = 'trucker', labelKey = 'quests.entry.car_trucker_shifts.objective' },
                },
                reward = { money = 1500, xp = 120, rp = 5, reason = 'quest_trucker_shifts' },
            },
            {
                key = 'car_mechanic_repairs',
                labelKey = 'quests.entry.car_mechanic_repairs.label',
                descriptionKey = 'quests.entry.car_mechanic_repairs.description',
                objectives = {
                    { type = 'job_shift_completed', target = 5, jobId = 'mechanic', labelKey = 'quests.entry.car_mechanic_repairs.objective' },
                },
                reward = { money = 1500, xp = 120, rp = 5, reason = 'quest_mechanic_repairs' },
            },
            {
                key = 'adv_level3',
                labelKey = 'quests.entry.adv_level3.label',
                descriptionKey = 'quests.entry.adv_level3.description',
                objectives = {
                    { type = 'job_level_up', target = 3, labelKey = 'quests.entry.adv_level3.objective' },
                },
                reward = { money = 2500, xp = 180, rp = 6, reason = 'quest_skill_tier' },
            },
        },
    },

    -- ══════════════════════════════════════════════════════════════════════
    --  HUNTING TRACK — RANGE CHALLENGE & BLADE COUNTY CONTRACTS (Level 10+)
    -- ══════════════════════════════════════════════════════════════════════
    hunting = {
        category = 'careers',
        labelKey = 'quests.chain.hunting',
        order = 7,
        enabled = true,
        minCharacterLevel = 10,
        requiresChain = 'building_life',
        quests = {
            {
                key = 'hunt_range_challenge',
                labelKey = 'quests.entry.hunt_range_challenge.label',
                descriptionKey = 'quests.entry.hunt_range_challenge.description',
                objectives = {
                    { type = 'hunting_range_passed', target = 1, labelKey = 'quests.entry.hunt_range_challenge.objective' },
                },
                reward = { money = 1000, xp = 100, rp = 4, reason = 'quest_hunt_range' },
            },
            {
                key = 'hunt_contracts',
                labelKey = 'quests.entry.hunt_contracts.label',
                descriptionKey = 'quests.entry.hunt_contracts.description',
                objectives = {
                    { type = 'hunting_harvested', target = 3, labelKey = 'quests.entry.hunt_contracts.objective' },
                },
                reward = { money = 2500, xp = 180, rp = 6, reason = 'quest_hunt_contracts' },
            },
        },
    },

    -- ══════════════════════════════════════════════════════════════════════
    --  CRIMINAL UNDERWORLD — LOCKPICKING, CARJACK & ROBBERIES (Level 10+)
    -- ══════════════════════════════════════════════════════════════════════
    criminal = {
        category = 'criminal',
        labelKey = 'quests.chain.criminal',
        order = 8,
        enabled = true,
        minCharacterLevel = 10,
        requiresChain = 'building_life',
        quests = {
            {
                key = 'crim_practice_lock',
                labelKey = 'quests.entry.crim_practice_lock.label',
                descriptionKey = 'quests.entry.crim_practice_lock.description',
                objectives = {
                    { type = 'lockpick_practiced', target = 1, labelKey = 'quests.entry.crim_practice_lock.objective' },
                },
                reward = { money = 800, xp = 80, rp = 3, reason = 'quest_lockpick_practice' },
            },
            {
                key = 'crim_chop',
                labelKey = 'quests.entry.crim_chop.label',
                descriptionKey = 'quests.entry.crim_chop.description',
                objectives = {
                    { type = 'carjack_sold', target = 1, labelKey = 'quests.entry.crim_chop.objective' },
                },
                reward = { money = 1500, xp = 120, rp = 5, reason = 'quest_chop' },
            },
            {
                key = 'crim_robbery',
                labelKey = 'quests.entry.crim_robbery.label',
                descriptionKey = 'quests.entry.crim_robbery.description',
                objectives = {
                    { type = 'robbery_completed', target = 1, labelKey = 'quests.entry.crim_robbery.objective' },
                },
                reward = { money = 3000, xp = 200, rp = 8, reason = 'quest_robbery' },
            },
        },
    },

    -- ══════════════════════════════════════════════════════════════════════
    --  SOCIAL & FACTIONS — COMMUNITY & OFFICIAL CAREERS (Level 10+)
    -- ══════════════════════════════════════════════════════════════════════
    social = {
        category = 'social',
        labelKey = 'quests.chain.social',
        order = 9,
        enabled = true,
        quests = {
            {
                key = 'soc_contact',
                labelKey = 'quests.entry.soc_contact.label',
                descriptionKey = 'quests.entry.soc_contact.description',
                objectives = {
                    { type = 'contact_added', target = 1, labelKey = 'quests.entry.soc_contact.objective' },
                },
                reward = { money = 150, xp = 25, rp = 1, reason = 'quest_contact' },
            },
            {
                key = 'soc_trade',
                labelKey = 'quests.entry.soc_trade.label',
                descriptionKey = 'quests.entry.soc_trade.description',
                objectives = {
                    { type = 'first_trade', target = 1, labelKey = 'quests.entry.soc_trade.objective' },
                },
                reward = { money = 250, xp = 35, rp = 2, reason = 'quest_trade' },
            },
            {
                key = 'fac_join',
                labelKey = 'quests.entry.fac_join.label',
                descriptionKey = 'quests.entry.fac_join.description',
                objectives = {
                    { type = 'faction_joined', target = 1, labelKey = 'quests.entry.fac_join.objective' },
                },
                reward = { money = 2000, xp = 150, rp = 6, reason = 'quest_faction' },
            },
        },
    },

    -- ══════════════════════════════════════════════════════════════════════
    --  CLANS & TERRITORIES — ENDGAME SYNDICATES (Level 15+)
    -- ══════════════════════════════════════════════════════════════════════
    clan = {
        category = 'clans',
        labelKey = 'quests.chain.clan',
        order = 10,
        enabled = true,
        minCharacterLevel = 15,
        quests = {
            {
                key = 'cln_join',
                labelKey = 'quests.entry.cln_join.label',
                descriptionKey = 'quests.entry.cln_join.description',
                objectives = {
                    { type = 'clan_joined', target = 1, labelKey = 'quests.entry.cln_join.objective' },
                },
                reward = { money = 2000, xp = 150, rp = 6, reason = 'quest_clan_join' },
            },
            {
                key = 'cln_store_upgrade',
                labelKey = 'quests.entry.cln_store_upgrade.label',
                descriptionKey = 'quests.entry.cln_store_upgrade.description',
                objectives = {
                    { type = 'clan_store_bought', target = 1, labelKey = 'quests.entry.cln_store_upgrade.objective' },
                },
                reward = { money = 2500, xp = 180, rp = 6, reason = 'quest_clan_store' },
            },
            {
                key = 'cln_war',
                labelKey = 'quests.entry.cln_war.label',
                descriptionKey = 'quests.entry.cln_war.description',
                objectives = {
                    { type = 'turf_war_fought', target = 1, labelKey = 'quests.entry.cln_war.objective' },
                },
                reward = { money = 4000, xp = 250, rp = 10, reason = 'quest_clan_war' },
            },
        },
    },
}

-- Flatten quest lookup: questKey -> {chain, quest, chainKey, category}
Sunset.QuestIndex = {}
for chainKey, chain in pairs(Sunset.QuestChains) do
    for i, quest in ipairs(chain.quests or {}) do
        Sunset.QuestIndex[quest.key] = {
            chainKey = chainKey,
            chain = chain,
            quest = quest,
            order = i,
            category = chain.category or 'main',
        }
    end
end
