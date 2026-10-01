local function notify(source, message, kind)
    TriggerClientEvent('sunset:client:notify', source, message, kind or 'info', 5000)
end

local function passAnnounce(source, title, body, kind)
    kind = kind or 'success'
    notify(source, body, kind, 5000)
    TriggerClientEvent('sunset:chat:message', source, {
        id = 0,
        name = 'BLAZE PASS',
        passTitle = title,
        message = body,
        time = os.date('%H:%M:%S'),
        type = 'blaze_pass',
    })
end

local CharacterLocks = {}

local function withCharacterLock(characterId, operation)
    local key = tostring(characterId)
    if CharacterLocks[key] then
        return nil, { localeKey = 'pass.message.your_blaze_pass_is_already_processing_another_action_try' }
    end

    CharacterLocks[key] = true
    local result = table.pack(xpcall(operation, debug.traceback))
    CharacterLocks[key] = nil

    if not result[1] then
        print(('[sunset_pass] operation failed for character %s: %s'):format(key, tostring(result[2])))
        return nil, { localeKey = 'pass.message.blaze_pass_could_not_process_the_action_no_second' }
    end
    return table.unpack(result, 2, result.n)
end

local function getCharacter(source)
    return exports.sunset_core:GetCharacter(source)
end

local function getPlayer(source)
    return exports.sunset_core:GetPlayer(source)
end

local function setPremiumPoints(source, value)
    return exports.sunset_core:SetPersistentStat(source, 'account', 'premium_points', value)
end

local function refreshBlazePoints(source)
    if GetResourceState('sunset_core') ~= 'started' then return 0 end
    return exports.sunset_core:RefreshBlazePoints(source) or 0
end

local function isPremiumRow(row)
    if not row then return false end
    local premium = row.premium
    return premium == true or premium == 1 or tonumber(premium) == 1
end

local function refundPremiumPayment(source, payment)
    if not payment or payment.method ~= 'blaze_points' then return end
    exports.sunset_core:AddBlazePoints(source, payment.amount)
end

local function chargePremiumPayment(source)
    local bpCost = math.floor(tonumber(SunsetPass.PremiumCost) or 0)
    if bpCost <= 0 then return false, nil, 'Premium pass is not for sale yet.' end

    local balance = refreshBlazePoints(source)
    local ok, err = exports.sunset_core:SpendBlazePoints(source, bpCost)
    if ok then return true, { method = 'blaze_points', amount = bpCost }, nil end
    return false, nil, err or ('You need %d Blaze Points (you have %d).'):format(bpCost, balance)
end

local function premiumCostLabel()
    local bpCost = math.floor(tonumber(SunsetPass.PremiumCost) or 0)
    if bpCost > 0 then return ('%d BP'):format(bpCost) end
    return 'Unavailable'
end

local function maxTier()
    return #(SunsetPass.Tiers or {})
end

local function tierFromXp(xp)
    local per = SunsetPass.XpPerTier or 500
    return math.min(maxTier(), math.floor((tonumber(xp) or 0) / per) + 1)
end

local function claimKey(level, track)
    return ('%d_%s'):format(level, track)
end

local function decodeJson(raw)
    if type(raw) == 'table' then return raw end
    if type(raw) ~= 'string' or raw == '' then return {} end
    local ok, decoded = pcall(json.decode, raw)
    return ok and type(decoded) == 'table' and decoded or {}
end

local function upsertRow(characterId, xp, premium, claimed, missionProgress)
    MySQL.insert.await([[
        INSERT INTO character_pass_progress (character_id, season_id, xp, premium, claimed, mission_progress)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            xp = VALUES(xp),
            premium = VALUES(premium),
            claimed = VALUES(claimed),
            mission_progress = VALUES(mission_progress)
    ]], {
        characterId,
        SunsetPass.SeasonId,
        tonumber(xp) or 0,
        premium and 1 or 0,
        json.encode(claimed or {}),
        json.encode(missionProgress or {}),
    })
end

local function saveRow(characterId, xp, premium, claimed, missionProgress)
    upsertRow(characterId, xp, premium, claimed, missionProgress)
end

local function loadRow(characterId)
    local row = MySQL.single.await([[
        SELECT xp, premium, claimed, mission_progress
        FROM character_pass_progress
        WHERE character_id = ? AND season_id = ?
        LIMIT 1
    ]], { characterId, SunsetPass.SeasonId })
    if row then return row end

    upsertRow(characterId, 0, false, {}, {})
    return MySQL.single.await([[
        SELECT xp, premium, claimed, mission_progress
        FROM character_pass_progress
        WHERE character_id = ? AND season_id = ?
        LIMIT 1
    ]], { characterId, SunsetPass.SeasonId }) or {
        xp = 0,
        premium = 0,
        claimed = '{}',
        mission_progress = '{}',
    }
end

local function missionById(id)
    for _, mission in ipairs(SunsetPass.Missions or {}) do
        if mission.id == id then return mission end
    end
    return nil
end

local function tierReward(level, track)
    for _, tier in ipairs(SunsetPass.Tiers or {}) do
        if tier.level == level then
            return track == 'premium' and tier.premium or tier.free
        end
    end
    return nil
end

local function grantReward(source, reward)
    if not reward or not reward.type then return false, { localeKey = 'pass.message.invalid_reward' } end

    if reward.type == 'cash' or reward.type == 'bank' then
        local ok = exports.sunset_core:AddMoney(source, reward.type, reward.amount or 0, 'sunset_pass')
        if not ok then return false, { localeKey = 'pass.message.could_not_add_money' } end
        return true
    end

    if reward.type == 'premium_points' then
        local player = getPlayer(source)
        if not player then return false, { localeKey = 'pass.message.account_data_unavailable' } end
        local amount = math.floor(tonumber(reward.amount) or 0)
        if amount <= 0 then return false, { localeKey = 'pass.message.invalid_coin_amount' } end
        local nextValue = (tonumber(player.premium_points) or 0) + amount
        local ok, err = setPremiumPoints(source, nextValue)
        if not ok then return false, err or exports.sunset_core:TFor(source, 'core.message.could_not_add_blaze_points') end
        return true
    end

    if reward.type == 'item' then
        if GetResourceState('sunset_inventory') ~= 'started' then
            return false, { localeKey = 'pass.message.inventory_is_unavailable' }
        end
        local added = exports.sunset_inventory:AddItem(source, reward.item, reward.count or 1)
        if not added then return false, { localeKey = 'pass.message.inventory_full_or_item_invalid' } end
        return true
    end

    return false, { localeKey = 'pass.message.unsupported_reward_type' }
end

function AddMissionProgress(source, missionId, amount)
    local char = getCharacter(source)
    missionId = tostring(missionId or '')
    amount = math.floor(tonumber(amount) or 0)
    if not char or missionId == '' or amount <= 0 then return false end

    local mission = missionById(missionId)
    if not mission then return false end

    return withCharacterLock(char.id, function()
        local row = loadRow(char.id)
        local missionProgress = decodeJson(row.mission_progress)
        local entry = missionProgress[missionId] or { progress = 0, completed = false }
        if entry.completed then return false end

        entry.progress = math.min(mission.goal, (tonumber(entry.progress) or 0) + amount)
        local xp = tonumber(row.xp) or 0
        local oldTier = tierFromXp(xp)
        local justCompleted = false
        if entry.progress >= mission.goal and not entry.completed then
            entry.completed = true
            xp = xp + (mission.xp or 0)
            justCompleted = true
        end
        missionProgress[missionId] = entry

        saveRow(char.id, xp, isPremiumRow(row), decodeJson(row.claimed), missionProgress)
        TriggerClientEvent('sunset:pass:refresh', source)

        if justCompleted then
            passAnnounce(source, exports.sunset_core:TFor(source, 'pass.announce.mission_complete'),
                exports.sunset_core:TFor(source, 'pass.announce.mission_complete_body', { title = mission.titleKey and exports.sunset_core:TFor(source, mission.titleKey) or mission.title or mission.id, xp = mission.xp or 0 }), 'success')
            local newTier = tierFromXp(xp)
            if newTier > oldTier then
                passAnnounce(source, exports.sunset_core:TFor(source, 'pass.announce.level_up'),
                    exports.sunset_core:TFor(source, 'pass.announce.level_up_body', { level = newTier }), 'success')
            end
        end

        return true
    end)
end

exports('AddMissionProgress', AddMissionProgress)

AddEventHandler('sunset:pass:addMission', function(source, missionId, amount)
    AddMissionProgress(source, missionId, amount)
end)

local function buildPayload(source, row)
    local char = getCharacter(source)
    local player = getPlayer(source)
    if not char then return nil end

    local xp = tonumber(row.xp) or 0
    local premium = isPremiumRow(row)
    local claimed = decodeJson(row.claimed)
    local missionProgress = decodeJson(row.mission_progress)
    local currentTier = tierFromXp(xp)
    local per = SunsetPass.XpPerTier or 500
    local tierXp = xp % per
    local tiers = {}

    for _, tier in ipairs(SunsetPass.Tiers or {}) do
        local level = tier.level
        local unlocked = level <= currentTier
        local freeKey = claimKey(level, 'free')
        local premiumKey = claimKey(level, 'premium')

        local function mapReward(reward, track)
            if not reward then return nil end
            return {
                level = level,
                track = track,
                type = reward.type,
                label = reward.label,
                icon = reward.icon,
                amount = reward.amount,
                item = reward.item,
                count = reward.count,
                claimed = claimed[track == 'premium' and premiumKey or freeKey] == true,
                locked = track == 'premium' and not premium,
                canClaim = unlocked
                    and not (claimed[track == 'premium' and premiumKey or freeKey] == true)
                    and (track ~= 'premium' or premium)
                    and reward ~= nil,
            }
        end

        tiers[#tiers + 1] = {
            level = level,
            unlocked = unlocked,
            current = level == currentTier,
            free = mapReward(tier.free, 'free'),
            premium = mapReward(tier.premium, 'premium'),
        }
    end

    local missions = {}
    for _, mission in ipairs(SunsetPass.Missions or {}) do
        local entry = missionProgress[mission.id] or { progress = 0, completed = false }
        local progress = tonumber(entry.progress) or 0
        missions[#missions + 1] = {
            id = mission.id,
            title = mission.titleKey and exports.sunset_core:TFor(source, mission.titleKey) or mission.title,
            description = mission.descriptionKey and exports.sunset_core:TFor(source, mission.descriptionKey) or mission.description,
            goal = mission.goal,
            xp = mission.xp,
            icon = mission.icon,
            progress = progress,
            completed = entry.completed == true,
        }
    end

    return {
        seasonId = SunsetPass.SeasonId,
        seasonLabel = SunsetPass.SeasonLabel,
        xp = xp,
        tier = currentTier,
        maxTier = maxTier(),
        tierXp = tierXp,
        tierGoal = per,
        premium = premium,
        premiumCost = SunsetPass.PremiumCost or 250,
        premiumCostLabel = premiumCostLabel(),
        accountCoins = refreshBlazePoints(source),
        tiers = tiers,
        missions = missions,
    }
end

exports.sunset_core:RegisterCallback('sunset:pass:getData', function(source)
    local char = getCharacter(source)
    if not char then return nil, { localeKey = 'pass.message.character_not_loaded' } end
    local row = loadRow(char.id)
    return buildPayload(source, row)
end)

exports.sunset_core:RegisterCallback('sunset:pass:claim', function(source, data)
    local char = getCharacter(source)
    if not char then return nil, { localeKey = 'pass.message.character_not_loaded' } end

    local level = tonumber(data and data.level)
    local track = data and data.track
    if not level or level ~= math.floor(level) or level < 1 or level > maxTier()
        or (track ~= 'free' and track ~= 'premium') then
        return nil, { localeKey = 'pass.message.invalid_claim_request' }
    end

    return withCharacterLock(char.id, function()
        local row = loadRow(char.id)
        local xp = tonumber(row.xp) or 0
        local premium = isPremiumRow(row)
        local claimed = decodeJson(row.claimed)
        local key = claimKey(level, track)

        if claimed[key] then return nil, { localeKey = 'pass.message.reward_already_claimed' } end
        if level > tierFromXp(xp) then return nil, { localeKey = 'pass.message.tier_not_unlocked_yet' } end
        if track == 'premium' and not premium then return nil, { localeKey = 'pass.message.premium_pass_required' } end

        local reward = tierReward(level, track)
        if not reward then return nil, { localeKey = 'pass.message.no_reward_on_this_tier' } end

        claimed[key] = true
        saveRow(char.id, xp, premium, claimed, decodeJson(row.mission_progress))
        local saved = loadRow(char.id)
        if not decodeJson(saved.claimed)[key] then
            claimed[key] = false
            return nil, { localeKey = 'pass.message.could_not_save_your_claim_please_try_again' }
        end

        local ok, err = grantReward(source, reward)
        if not ok then
            claimed[key] = false
            saveRow(char.id, xp, premium, claimed, decodeJson(row.mission_progress))
            return nil, err or exports.sunset_core:TFor(source, 'pass.err.could_not_grant_reward')
        end

        passAnnounce(source, exports.sunset_core:TFor(source, 'pass.announce.reward_claimed'), exports.sunset_core:TFor(source, 'pass.announce.reward_claimed_body', { level = level, reward = reward.label or exports.sunset_core:TFor(source, 'pass.announce.reward_default') }), 'success')
        return buildPayload(source, loadRow(char.id))
    end)
end)

exports.sunset_core:RegisterCallback('sunset:pass:buyPremium', function(source)
    local char = getCharacter(source)
    if not char then return nil, { localeKey = 'pass.message.character_not_loaded' } end

    return withCharacterLock(char.id, function()
        local row = loadRow(char.id)
        if isPremiumRow(row) then return nil, { localeKey = 'pass.message.premium_pass_already_unlocked' } end

        local paid, payment, payErr = chargePremiumPayment(source)
        if not paid then return nil, payErr or exports.sunset_core:TFor(source, 'pass.err.premium_pass_payment_failed') end

        upsertRow(char.id, tonumber(row.xp) or 0, true, decodeJson(row.claimed), decodeJson(row.mission_progress))
        local saved = loadRow(char.id)
        if not isPremiumRow(saved) then
            refundPremiumPayment(source, payment)
            return nil, { localeKey = 'pass.message.premium_pass_payment_succeeded_but_progress_could_not_be' }
        end

        local payload = buildPayload(source, saved)
        if not payload then
            return nil, { localeKey = 'pass.message.premium_pass_unlocked_but_the_menu_could_not_refresh' }
        end

        passAnnounce(source, exports.sunset_core:TFor(source, 'pass.announce.premium_unlocked'), exports.sunset_core:TFor(source, 'pass.announce.premium_unlocked_body'), 'success')
        return payload
    end)
end)

CreateThread(function()
    Wait(1500)
    local ok = MySQL.scalar.await([[
        SELECT 1 FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'character_pass_progress'
        LIMIT 1
    ]])
    if not ok then
        print('^1[sunset_pass]^7 Missing table character_pass_progress — run sql/17-sunset-pass.sql on the database.')
    end
end)

-- Payday mission hook (safe, isolated from robbery edits).
-- Progress is applied from sunset_economy after each payday.
