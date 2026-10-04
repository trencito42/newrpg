-- ============================================================
--  sunset_quests — Canonical Quest & Progression Service
--  RACKET RPG — Server-Authoritative Multi-Track Progression
-- ============================================================

-- In-memory active-quest cache per character: [charId] = { [questKey] = row }
local Cache = {}

local function loadCharacterQuests(charId)
    local rows = MySQL.query.await(
        'SELECT quest_key, chain_key, stage, progress, target, status FROM character_quests WHERE character_id = ?',
        { charId }) or {}
    local map = {}
    for _, r in ipairs(rows) do map[r.quest_key] = r end
    Cache[charId] = map
    return map
end

local function getQuestState(charId, questKey)
    local map = Cache[charId] or loadCharacterQuests(charId)
    return map[questKey]
end

local function chainUnlocked(charId, chain, charLevel)
    charLevel = tonumber(charLevel) or 1

    -- Level Gate
    if chain.minCharacterLevel and charLevel < chain.minCharacterLevel then
        return false
    end

    -- Required Chain Gate
    if not chain.requiresChain then return true end
    local req = Sunset.QuestChains[chain.requiresChain]
    if not req then return true end

    local map = Cache[charId] or loadCharacterQuests(charId)
    for _, q in ipairs(req.quests or {}) do
        local st = map[q.key]
        if not st or (st.status ~= 'claimed' and st.status ~= 'complete') then
            return false
        end
    end
    return true
end

-- Start (activate) the next available quest in all unlocked, enabled chains.
local function ensureActiveQuests(charId, charLevel)
    local map = Cache[charId] or loadCharacterQuests(charId)
    local chains = {}
    for key, chain in pairs(Sunset.QuestChains) do
        if chain.enabled then chains[#chains + 1] = { key = key, chain = chain } end
    end
    table.sort(chains, function(a, b) return (a.chain.order or 99) < (b.chain.order or 99) end)

    local activatedCount = 0
    for _, entry in ipairs(chains) do
        local chain = entry.chain
        if chainUnlocked(charId, chain, charLevel) then
            for _, quest in ipairs(chain.quests or {}) do
                local st = map[quest.key]
                if not st then
                    local target = (quest.objectives and quest.objectives[1] and quest.objectives[1].target) or 1
                    MySQL.insert.await([[
                        INSERT INTO character_quests (character_id, quest_key, chain_key, stage, progress, target, status)
                        VALUES (?, ?, ?, 0, 0, ?, 'active')
                    ]], { charId, quest.key, entry.key, target })
                    map[quest.key] = { quest_key = quest.key, chain_key = entry.key, stage = 0,
                        progress = 0, target = target, status = 'active' }
                    activatedCount = activatedCount + 1
                    break -- only one active quest per chain at a time
                elseif st.status == 'active' then
                    break -- already active in this chain
                end
            end
        end
    end
    return activatedCount
end

-- ============================================================
--  Idempotent Character Progression Reconciliation
--  Prevents veteran players from being stuck behind tutorial quests.
-- ============================================================
local function reconcileExistingProgress(source, char)
    if not char or not char.id then return end
    local charId = tonumber(char.id)
    local level = tonumber(char.level) or 1
    local map = Cache[charId] or loadCharacterQuests(charId)

    local function markCompleteIfSatisfied(questKey, chainKey, isSatisfied)
        if not isSatisfied then return end
        local st = map[questKey]
        if not st then
            local def = Sunset.QuestIndex[questKey]
            local target = def and def.quest.objectives and def.quest.objectives[1] and def.quest.objectives[1].target or 1
            MySQL.insert.await([[
                INSERT INTO character_quests (character_id, quest_key, chain_key, stage, progress, target, status, completed_at, claimed_at)
                VALUES (?, ?, ?, 0, ?, ?, 'claimed', NOW(), NOW())
            ]], { charId, questKey, chainKey, target, target })
            map[questKey] = { quest_key = questKey, chain_key = chainKey, stage = 0, progress = target, target = target, status = 'claimed' }
        elseif st.status == 'active' then
            st.progress = st.target
            st.status = 'complete'
            MySQL.update.await("UPDATE character_quests SET progress = target, status = 'complete', completed_at = NOW() WHERE character_id = ? AND quest_key = ?", { charId, questKey })
        end
    end

    -- 1. Check Driver License
    local hasDriverLicense = false
    if GetResourceState('sunset_licenses') == 'started' then
        local lics = exports.sunset_licenses:GetLicenses(source)
        if type(lics) == 'table' then
            for _, l in ipairs(lics) do
                if l.valid and l.license_type == 'driver' then hasDriverLicense = true break end
            end
        end
    end
    if hasDriverLicense then
        markCompleteIfSatisfied('onb_orientation', 'onboarding', true)
        markCompleteIfSatisfied('onb_store_supplies', 'onboarding', true)
        markCompleteIfSatisfied('onb_banking_atm', 'onboarding', true)
        markCompleteIfSatisfied('onb_jobcenter', 'onboarding', true)
        markCompleteIfSatisfied('drv_license', 'driving', true)
    end

    -- 2. Check Owned Vehicles
    local hasVehicle = MySQL.scalar.await('SELECT 1 FROM vehicles WHERE character_id = ? LIMIT 1', { charId }) ~= nil
    if hasVehicle then
        markCompleteIfSatisfied('drv_first_car', 'first_car', true)
        markCompleteIfSatisfied('drv_rental_drive', 'driving', true)
    end

    -- 3. Check Character Level
    if level >= 10 then
        markCompleteIfSatisfied('life_reach_level10', 'building_life', true)
    end

    -- 4. Check Clan Membership
    local hasClan = false
    if GetResourceState('sunset_clans') == 'started' then
        local mem = exports.sunset_clans:GetPlayerClan(source)
        if mem and mem.clan_id then hasClan = true end
    end
    if hasClan then
        markCompleteIfSatisfied('cln_join', 'clan', true)
    end

    -- 5. Check Faction
    if char.metadata and char.metadata.faction and char.metadata.faction ~= '' and char.metadata.faction ~= 'none' then
        markCompleteIfSatisfied('fac_join', 'social', true)
    end
end

-- ============================================================
--  Public API
-- ============================================================

function StartQuest(source, questKey)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return false, { localeKey = 'quests.message.no_character' } end
    local def = Sunset.QuestIndex[questKey]
    if not def or not def.chain.enabled then return false, { localeKey = 'quests.message.unknown_quest' } end
    local existing = getQuestState(char.id, questKey)
    if existing then return true end
    ensureActiveQuests(char.id, char.level)
    return true
end
exports('StartQuest', StartQuest)

function AddProgress(source, eventType, amount, context)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return false end
    amount = math.max(1, math.floor(tonumber(amount) or 1))
    context = type(context) == 'table' and context or {}

    local map = Cache[char.id] or loadCharacterQuests(char.id)
    local advanced = false
    for questKey, st in pairs(map) do
        if st.status == 'active' then
            local def = Sunset.QuestIndex[questKey]
            local obj = def and def.quest.objectives and def.quest.objectives[1]
            if obj and obj.type == eventType then
                -- Check matching parameters (e.g. license type, jobId)
                local match = true
                if obj.license and obj.license ~= context.license then match = false end
                if obj.jobId and obj.jobId ~= context.jobId then match = false end

                if match then
                    -- level_reached is a high-water mark (the character's level), not an
                    -- increment. Adding the level number completed "reach level 10" at level 5.
                    local newProgress
                    if eventType == 'level_reached' then
                        local reached = math.floor(tonumber(context.level) or amount)
                        newProgress = math.min(st.target, math.max(st.progress or 0, reached))
                    else
                        newProgress = math.min(st.target, (st.progress or 0) + amount)
                    end
                    if newProgress ~= st.progress then
                        st.progress = newProgress
                        advanced = true
                        if newProgress >= st.target then
                            st.status = 'complete'
                            MySQL.update.await(
                                "UPDATE character_quests SET progress = ?, status = 'complete', completed_at = NOW() WHERE character_id = ? AND quest_key = ?",
                                { newProgress, char.id, questKey })
                            TriggerClientEvent('sunset:quests:objectiveComplete', source, questKey)
                            local label = exports.sunset_core:TFor(source, def.quest.labelKey)
                            TriggerClientEvent('sunset:client:notify', source,
                                exports.sunset_core:TFor(source, 'quests.message.completed_claim', { label = label }), 'success', 7000)
                        else
                            MySQL.update.await(
                                'UPDATE character_quests SET progress = ? WHERE character_id = ? AND quest_key = ?',
                                { newProgress, char.id, questKey })
                            TriggerClientEvent('sunset:quests:progress', source, questKey, newProgress, st.target)
                        end
                    end
                end
            end
        end
    end

    if not advanced then
        ensureActiveQuests(char.id, char.level)
    end
    return advanced
end
exports('AddProgress', AddProgress)

function CompleteObjective(source, questKey)
    return AddProgress(source, questKey, 1)
end
exports('CompleteObjective', CompleteObjective)

function IsQuestComplete(source, questKey)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return false end
    local st = getQuestState(char.id, questKey)
    return st ~= nil and (st.status == 'complete' or st.status == 'claimed')
end
exports('IsQuestComplete', IsQuestComplete)

function GetProgress(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return {} end
    local map = Cache[char.id] or loadCharacterQuests(char.id)
    ensureActiveQuests(char.id, char.level)
    map = Cache[char.id] or {}
    local out = {}

    for questKey, st in pairs(map) do
        local def = Sunset.QuestIndex[questKey]
        out[#out + 1] = {
            questKey = questKey,
            chainKey = st.chain_key,
            category = def and def.category or 'main',
            chainLabel = def and exports.sunset_core:TFor(source, def.chain.labelKey) or st.chain_key,
            label = def and exports.sunset_core:TFor(source, def.quest.labelKey) or questKey,
            description = def and exports.sunset_core:TFor(source, def.quest.descriptionKey) or '',
            progress = st.progress or 0,
            target = st.target or 1,
            status = st.status,
            objectiveLabel = def and def.quest.objectives and def.quest.objectives[1]
                and exports.sunset_core:TFor(source, def.quest.objectives[1].labelKey) or '',
            reward = def and def.quest.reward or nil,
        }
    end

    table.sort(out, function(a, b)
        if a.status == b.status then return a.questKey < b.questKey end
        local rank = { active = 1, complete = 2, claimed = 3 }
        return (rank[a.status] or 9) < (rank[b.status] or 9)
    end)
    return out
end
exports('GetProgress', GetProgress)

function ClaimReward(source, questKey)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return false, { localeKey = 'quests.message.no_character' } end
    local st = getQuestState(char.id, questKey)
    if not st then return false, { localeKey = 'quests.message.quest_not_started' } end
    if st.status == 'claimed' then return false, { localeKey = 'quests.message.reward_already_claimed' } end
    if st.status ~= 'complete' then return false, { localeKey = 'quests.message.quest_not_complete_yet' } end

    local def = Sunset.QuestIndex[questKey]
    local reward = def and def.quest.reward or {}

    -- Guard against concurrent claims
    local changed = MySQL.update.await(
        "UPDATE character_quests SET status = 'claimed', claimed_at = NOW() WHERE character_id = ? AND quest_key = ? AND status = 'complete'",
        { char.id, questKey })
    if not changed or changed < 1 then
        return false, { localeKey = 'quests.message.reward_already_claimed' }
    end
    st.status = 'claimed'

    if reward.money and reward.money > 0 then
        if not exports.sunset_core:AddMoney(source, 'bank', reward.money, reward.reason or ('quest_' .. questKey)) then
            MySQL.update.await("UPDATE character_quests SET status = 'complete', claimed_at = NULL WHERE character_id = ? AND quest_key = ? AND status = 'claimed'", { char.id, questKey })
            st.status = 'complete'
            return false, { localeKey = 'quests.message.claim_failed' }
        end
    end
    if reward.xp and reward.xp > 0 then
        pcall(function() exports.sunset_core:AddXP(source, reward.xp) end)
    end
    if reward.rp and reward.rp > 0 then
        pcall(function() exports.sunset_core:GrantRespect(source, reward.rp) end)
    end

    ensureActiveQuests(char.id, char.level)
    if def and def.quest.unlocksChain then
        local unlocked = Sunset.QuestChains[def.quest.unlocksChain]
        local label = unlocked and exports.sunset_core:TFor(source, unlocked.labelKey) or def.quest.unlocksChain
        TriggerClientEvent('sunset:client:notify', source,
            exports.sunset_core:TFor(source, 'quests.message.chain_unlocked', { label = label }), 'success', 8000)
    end
    TriggerClientEvent('sunset:quests:claimed', source, questKey, reward)
    return true, reward
end
exports('ClaimReward', ClaimReward)

-- Callbacks ----------------------------------------------------
exports.sunset_core:RegisterCallback('sunset:quests:list', function(source)
    return GetProgress(source)
end)

exports.sunset_core:RegisterCallback('sunset:quests:claim', function(source, questKey)
    local ok, res = ClaimReward(source, tostring(questKey or ''))
    if ok then return true end
    return nil, type(res) == 'table' and res.localeKey
        and exports.sunset_core:TFor(source, res.localeKey, res.params)
        or exports.sunset_core:TFor(source, 'quests.message.claim_failed')
end)

-- Lifecycle ----------------------------------------------------
AddEventHandler('sunset:server:characterSelected', function(source, characterId)
    local char = exports.sunset_core:GetCharacter(source)
    local charId = char and tonumber(char.id) or tonumber(characterId)
    if not charId then return end
    Cache[charId] = nil
    loadCharacterQuests(charId)
    reconcileExistingProgress(source, char)
    ensureActiveQuests(charId, char and char.level or 1)
end)

AddEventHandler('playerDropped', function()
    local ok, char = pcall(function() return exports.sunset_core:GetCharacter(source) end)
    if ok and char and char.id then Cache[char.id] = nil end
end)

-- ============================================================
--  Event Wiring Bridge
-- ============================================================
local function progressSource(src, eventType, amount, ctx)
    if not src or src == 0 then return end
    pcall(AddProgress, src, eventType, amount or 1, ctx)
end

AddEventHandler('sunset:quest:progress', function(charId, eventType, amount, ctx)
    charId = tonumber(charId)
    if not charId then return end
    for _, pid in ipairs(GetPlayers()) do
        local s = tonumber(pid)
        local c = exports.sunset_core:GetCharacter(s)
        if c and tonumber(c.id) == charId then
            progressSource(s, eventType, amount, ctx)
            return
        end
    end
end)

print('^2[sunset_quests]^7 Racket RPG Canonical Progression Service Online')
