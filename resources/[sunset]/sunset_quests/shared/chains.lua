Sunset = Sunset or {}

-- ============================================================
--  Quest chains — docs/product/RPG_PROGRESSION.md §2
--  Data-driven: a chain is an ordered list of quests; each quest
--  has objectives driven by server events (Sunset.QuestEvents).
--  `enabled=false` chains are DESIGNED but not shipped yet
--  (Phase 7 decision: onboarding + first_job + driving only).
-- ============================================================

-- Event types emitted by gameplay systems (see server/events wiring):
--   job_hired, job_shift_completed, license_obtained, vehicle_purchased,
--   property_rented, first_trade, sms_sent, contact_added, faction_joined,
--   help_opened, spawned_in_city
Sunset.QuestChains = {
    onboarding = {
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
                reward = { money = 100, xp = 20, rp = 1, reason = 'quest_onboarding' },
            },
            {
                key = 'onb_jobcenter',
                labelKey = 'quests.entry.onb_jobcenter.label',
                descriptionKey = 'quests.entry.onb_jobcenter.description',
                objectives = {
                    { type = 'job_hired', target = 1, labelKey = 'quests.entry.onb_jobcenter.objective' },
                },
                reward = { money = 150, xp = 30, rp = 1, reason = 'quest_jobcenter' },
                unlocksChain = 'first_job',
            },
        },
    },

    first_job = {
        labelKey = 'quests.chain.first_job',
        order = 2,
        enabled = true,
        requiresChain = 'onboarding',
        quests = {
            {
                key = 'fj_first_shift',
                labelKey = 'quests.entry.fj_first_shift.label',
                descriptionKey = 'quests.entry.fj_first_shift.description',
                objectives = {
                    { type = 'job_shift_completed', target = 1, labelKey = 'quests.entry.fj_first_shift.objective' },
                },
                reward = { money = 250, xp = 40, rp = 2, reason = 'quest_first_shift' },
            },
            {
                key = 'fj_dedication',
                labelKey = 'quests.entry.fj_dedication.label',
                descriptionKey = 'quests.entry.fj_dedication.description',
                objectives = {
                    { type = 'job_shift_completed', target = 5, labelKey = 'quests.entry.fj_dedication.objective' },
                },
                reward = { money = 500, xp = 60, rp = 3, reason = 'quest_dedication' },
                unlocksChain = 'driving',
            },
        },
    },

    driving = {
        labelKey = 'quests.chain.driving',
        order = 3,
        enabled = true,
        requiresChain = 'first_job',
        quests = {
            {
                key = 'drv_license',
                labelKey = 'quests.entry.drv_license.label',
                descriptionKey = 'quests.entry.drv_license.description',
                objectives = {
                    { type = 'license_obtained', target = 1, license = 'driving', labelKey = 'quests.entry.drv_license.objective' },
                },
                reward = { money = 300, xp = 50, rp = 2, reason = 'quest_license' },
            },
            {
                key = 'drv_first_car',
                labelKey = 'quests.entry.drv_first_car.label',
                descriptionKey = 'quests.entry.drv_first_car.description',
                objectives = {
                    { type = 'vehicle_purchased', target = 1, labelKey = 'quests.entry.drv_first_car.objective' },
                },
                reward = { money = 750, xp = 80, rp = 3, reason = 'quest_first_car' },
            },
        },
    },

    -- ── DESIGNED, NOT YET ENABLED (future phases) ────────────────
    -- ── ENABLED (emitters wired: contact_added, first_trade, property_rented,
    --    faction_joined) ──────────────────────────────────────────────────
    social = {
        labelKey = 'quests.chain.social', order = 4, enabled = true, requiresChain = 'driving',
        quests = {
            { key = 'soc_contact', labelKey = 'quests.entry.soc_contact.label', descriptionKey = 'quests.entry.soc_contact.description',
              objectives = { { type = 'contact_added', target = 1, labelKey = 'quests.entry.soc_contact.objective' } },
              reward = { money = 100, xp = 20, rp = 1, reason = 'quest_contact' } },
            { key = 'soc_trade', labelKey = 'quests.entry.soc_trade.label', descriptionKey = 'quests.entry.soc_trade.description',
              objectives = { { type = 'first_trade', target = 1, labelKey = 'quests.entry.soc_trade.objective' } },
              reward = { money = 200, xp = 30, rp = 2, reason = 'quest_trade' }, unlocksChain = 'housing' },
        },
    },
    housing = {
        labelKey = 'quests.chain.housing', order = 5, enabled = true, requiresChain = 'social',
        quests = {
            { key = 'hou_rent', labelKey = 'quests.entry.hou_rent.label', descriptionKey = 'quests.entry.hou_rent.description',
              objectives = { { type = 'property_rented', target = 1, labelKey = 'quests.entry.hou_rent.objective' } },
              reward = { money = 400, xp = 50, rp = 2, reason = 'quest_rental' }, unlocksChain = 'faction' },
        },
    },
    faction = {
        labelKey = 'quests.chain.faction', order = 6, enabled = true, requiresChain = 'housing',
        quests = {
            { key = 'fac_join', labelKey = 'quests.entry.fac_join.label', descriptionKey = 'quests.entry.fac_join.description',
              objectives = { { type = 'faction_joined', target = 1, labelKey = 'quests.entry.fac_join.objective' } },
              reward = { money = 300, xp = 60, rp = 3, reason = 'quest_faction' } },
        },
    },
    -- advanced/criminal/clan (orders 7-9): [QUESTS 7-9] shipped using the
    -- EXISTING gameplay systems as emitters (job_progress level-ups, carjack
    -- chop-shop sales, robbery sessions, clan join/create, turf wars). No new
    -- NPCs required; the black-market NPC from the design brief can replace
    -- the carjack objective later without touching the quest engine.
    advanced = {
        labelKey = 'quests.chain.advanced', order = 7, enabled = true, requiresChain = 'faction',
        quests = {
            { key = 'adv_level3', labelKey = 'quests.entry.adv_level3.label', descriptionKey = 'quests.entry.adv_level3.description',
              objectives = { { type = 'job_level_up', target = 3, labelKey = 'quests.entry.adv_level3.objective' } },
              reward = { money = 800, xp = 100, rp = 4, reason = 'quest_skill_tier' } },
            { key = 'adv_shifts20', labelKey = 'quests.entry.adv_shifts20.label', descriptionKey = 'quests.entry.adv_shifts20.description',
              objectives = { { type = 'job_shift_completed', target = 20, labelKey = 'quests.entry.adv_shifts20.objective' } },
              reward = { money = 1500, xp = 150, rp = 5, reason = 'quest_workhorse' }, unlocksChain = 'criminal' },
        },
    },
    criminal = {
        labelKey = 'quests.chain.criminal', order = 8, enabled = true, requiresChain = 'advanced',
        quests = {
            { key = 'crim_chop', labelKey = 'quests.entry.crim_chop.label', descriptionKey = 'quests.entry.crim_chop.description',
              objectives = { { type = 'carjack_sold', target = 1, labelKey = 'quests.entry.crim_chop.objective' } },
              reward = { money = 1000, xp = 120, rp = 5, reason = 'quest_chop' } },
            { key = 'crim_robbery', labelKey = 'quests.entry.crim_robbery.label', descriptionKey = 'quests.entry.crim_robbery.description',
              objectives = { { type = 'robbery_completed', target = 1, labelKey = 'quests.entry.crim_robbery.objective' } },
              reward = { money = 2500, xp = 200, rp = 6, reason = 'quest_robbery' } },
            { key = 'crim_three', labelKey = 'quests.entry.crim_three.label', descriptionKey = 'quests.entry.crim_three.description',
              objectives = { { type = 'robbery_completed', target = 3, labelKey = 'quests.entry.crim_three.objective' } },
              reward = { money = 5000, xp = 300, rp = 8, reason = 'quest_career_criminal' }, unlocksChain = 'clan' },
        },
    },
    clan = {
        labelKey = 'quests.chain.clan', order = 9, enabled = true, requiresChain = 'criminal',
        quests = {
            { key = 'cln_join', labelKey = 'quests.entry.cln_join.label', descriptionKey = 'quests.entry.cln_join.description',
              objectives = { { type = 'clan_joined', target = 1, labelKey = 'quests.entry.cln_join.objective' } },
              reward = { money = 1000, xp = 150, rp = 5, reason = 'quest_clan_join' } },
            { key = 'cln_war', labelKey = 'quests.entry.cln_war.label', descriptionKey = 'quests.entry.cln_war.description',
              objectives = { { type = 'turf_war_fought', target = 1, labelKey = 'quests.entry.cln_war.objective' } },
              reward = { money = 3000, xp = 250, rp = 8, reason = 'quest_clan_war' } },
        },
    },
}

-- Flatten quest lookup: questKey -> {chain, quest, chainKey}
Sunset.QuestIndex = {}
for chainKey, chain in pairs(Sunset.QuestChains) do
    for i, quest in ipairs(chain.quests or {}) do
        Sunset.QuestIndex[quest.key] = { chainKey = chainKey, chain = chain, quest = quest, order = i }
    end
end
