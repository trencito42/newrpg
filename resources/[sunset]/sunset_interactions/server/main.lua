local INTERACTION_RANGE = 3.5
local MAX_CASH_TRANSFER = 500000
local RequestRate = {}

local function notify(source, message, kind, duration)
    TriggerClientEvent('sunset:client:notify', source, message, kind or 'info', duration)
end

local function nearbyPlayers(source, targetId, range)
    targetId = tonumber(targetId)
    if not targetId or targetId <= 0 or not GetPlayerName(targetId) then
        return nil, { localeKey = 'interactions.message.that_player_is_no_longer_online_close_the_menu' }
    end
    if targetId == source then return nil, { localeKey = 'interactions.message.you_cannot_interact_with_yourself_from_this_menu' } end
    if GetPlayerRoutingBucket(source) ~= GetPlayerRoutingBucket(targetId) then
        return nil, { localeKey = 'interactions.message.that_player_is_no_longer_in_your_session' }
    end

    local sourcePed = GetPlayerPed(source)
    local targetPed = GetPlayerPed(targetId)
    if not sourcePed or sourcePed == 0 or not targetPed or targetPed == 0 then
        return nil, { localeKey = 'interactions.message.one_of_the_characters_is_not_available_yet_try' }
    end

    local sourceCoords = GetEntityCoords(sourcePed)
    local targetCoords = GetEntityCoords(targetPed)
    if #(sourceCoords - targetCoords) > (range or INTERACTION_RANGE) then
        return nil, { localeKey = 'interactions.message.move_closer_to_player_value_you_must_remain_within', formatArgs = { targetId, range or INTERACTION_RANGE } }
    end

    local sourceChar = exports.sunset_core:GetCharacter(source)
    local targetChar = exports.sunset_core:GetCharacter(targetId)
    if not sourceChar or not targetChar then
        return nil, { localeKey = 'interactions.message.both_players_must_have_a_loaded_character' }
    end
    return { sourceChar = sourceChar, targetChar = targetChar, targetId = targetId }
end

local function permitted(source, permission)
    if GetResourceState('sunset_factions') ~= 'started' then return false end
    local ok, result = pcall(function()
        return exports.sunset_factions:HasFactionPerm(source, permission)
    end)
    return ok and result == true
end

local function addAction(actions, id, group, label, description, options)
    local row = options or {}
    row.id = id
    row.group = group
    row.label = label
    row.description = description
    actions[#actions + 1] = row
end

local function getDetentionState(targetId)
    local ok, state = pcall(function()
        return exports.sunset_factions:GetDetentionState(targetId)
    end)
    return ok and state or 'FREE'
end

exports.sunset_core:RegisterCallback('sunset:interactionContext', function(source, targetId)
    local pair, err = nearbyPlayers(source, targetId)
    if not pair then return nil, err end

    local actions = {}
    local state = getDetentionState(pair.targetId)
    addAction(actions, 'give_cash', 'CIVILIAN', 'Give cash', 'Hand money directly to this player.', {
        input = { type = 'number', label = exports.sunset_core:TFor(source, 'interactions.ui.amount'), min = 1, max = MAX_CASH_TRANSFER, placeholder = exports.sunset_core:TFor(source, 'interactions.ui.amount_2') },
    })
    addAction(actions, 'trade', 'CIVILIAN', 'Trade items', 'Propose a secure item trade with this player.')
    -- [FIX] Show "Already in Contacts" if the contact exists, otherwise "Add to Contacts"
    local alreadyContact = false
    pcall(function()
        local row = MySQL.scalar.await(
            'SELECT 1 FROM phone_contacts WHERE character_id = ? AND contact_character_id = ? LIMIT 1',
            { tonumber(pair.sourceChar.id), tonumber(pair.targetChar.id) })
        alreadyContact = row ~= nil
    end)
    addAction(actions, 'add_contact', 'CIVILIAN',
        alreadyContact and 'Already in Contacts' or 'Add to Contacts',
        alreadyContact and 'This player is already saved in your phone contacts.' or 'Save the player to your phone contacts.',
        alreadyContact and { disabled = true } or nil)

    local isLeader = false
    local leaderOk, leaderResult = pcall(function()
        return exports.sunset_factions:IsFactionLeader(source)
    end)
    isLeader = leaderOk and leaderResult == true
    if isLeader then
        addAction(actions, 'faction_invite', 'FACTION', 'Invite to faction', 'Invite an accepted applicant to your faction.')
    end

    if permitted(source, 'cuff') and state ~= 'CUFFED' and state ~= 'ESCORTED' and state ~= 'IN_VEHICLE' then
        addAction(actions, 'cuff', 'POLICE', 'Cuff suspect', 'Apply restraints to the nearby player.', { danger = true })
    end
    if permitted(source, 'uncuff') and (state == 'CUFFED' or state == 'ESCORTED' or state == 'IN_VEHICLE') then
        addAction(actions, 'uncuff', 'POLICE', 'Remove cuffs', 'Release the player from restraints.')
    end
    if permitted(source, 'escort') and (state == 'CUFFED' or state == 'ESCORTED') then
        addAction(actions, 'escort', 'POLICE', state == 'ESCORTED' and 'Stop escorting' or 'Escort suspect', 'Attach or release the restrained player.')
    end
    if permitted(source, 'vehicle_detain') and (state == 'CUFFED' or state == 'ESCORTED') then
        addAction(actions, 'put_vehicle', 'POLICE', 'Place in vehicle', 'Put the restrained player into a nearby vehicle.')
    end
    if permitted(source, 'vehicle_detain') and state == 'IN_VEHICLE' then
        addAction(actions, 'take_vehicle', 'POLICE', 'Remove from vehicle', 'Take the restrained player out of the vehicle.')
    end
    if permitted(source, 'frisk') then
        addAction(actions, 'frisk', 'POLICE', 'Search player', 'Inspect carried items and contraband.')
    end
    if permitted(source, 'confiscate') then
        addAction(actions, 'confiscate', 'POLICE', 'Confiscate contraband', 'Remove confiscatable illegal items.', { danger = true })
    end
    if permitted(source, 'ticket') or permitted(source, 'fine') then
        addAction(actions, 'ticket', 'POLICE', 'Issue citation', 'Open the official violation selector.')
    end
    if permitted(source, 'wanted') or permitted(source, 'wanted_limited') then
        local reasons = {}
        for code, reason in pairs((Sunset.Police and Sunset.Police.reasons) or {}) do
            reasons[#reasons + 1] = {
                value = code,
                label = exports.sunset_core:TFor(source, 'interactions.ui.star', { label = tostring(reason.label), stars = math.floor(tonumber(reason.stars) or 0), value = tostring(reason.stars == 1 and '' or 's'), value_2 = reason.surrenderable == false and exports.sunset_core:TFor(source, 'interactions.ui.no_surrender') or '' }),
            }
        end
        table.sort(reasons, function(a, b) return a.label < b.label end)
        addAction(actions, 'set_wanted', 'POLICE', 'Add wanted charge', 'Select the offence committed by this player.', {
            danger = true,
            input = { type = 'select', label = exports.sunset_core:TFor(source, 'interactions.ui.offence'), options = reasons },
        })
    end
    if permitted(source, 'megaphone') then
        addAction(actions, 'summon', 'POLICE', 'Issue stop order', 'Send a visible and audible police warning.')
    end
    if permitted(source, 'arrest') then
        addAction(actions, 'arrest', 'POLICE', 'Book into jail', 'Requires cuffs, active wanted and a booking location.', { danger = true })
    end

    if permitted(source, 'stabilize') then
        addAction(actions, 'stabilize', 'MEDICAL', 'Stabilize patient', 'Stop a downed patient from deteriorating.')
    end
    if permitted(source, 'heal') then
        addAction(actions, 'heal', 'MEDICAL', 'Treat injuries', 'Restore the nearby patient’s health.')
    end
    if permitted(source, 'revive') then
        addAction(actions, 'revive', 'MEDICAL', 'Revive patient', 'Revive a stabilized downed patient.')
    end
    if permitted(source, 'repair') then
        addAction(actions, 'repair_vehicle', 'SERVICE', 'Repair vehicle', 'Repair the vehicle occupied by this player.')
    end
    if permitted(source, 'fare') then
        addAction(actions, 'taxi_fare', 'SERVICE', 'Offer taxi fare', 'Send a fare that the passenger must accept.', {
            input = { type = 'number', label = exports.sunset_core:TFor(source, 'interactions.ui.fare'), min = 1, max = 1000, placeholder = exports.sunset_core:TFor(source, 'interactions.ui.fare_2') },
        })
    end
    if permitted(source, 'issue_license') then
        addAction(actions, 'license_exam', 'INSTRUCTOR', 'Authorize license exam', 'Start a supervised LSSI exam for this candidate.', {
            input = { type = 'select', label = exports.sunset_core:TFor(source, 'licenses.hint.default_facility'), options = {
                { value = 'pilot', label = exports.sunset_core:TFor(source, 'interactions.ui.flying_license') },
                { value = 'boat', label = exports.sunset_core:TFor(source, 'interactions.ui.boat_license') },
                { value = 'weapon', label = exports.sunset_core:TFor(source, 'interactions.ui.gun_license') },
            } },
        })
    end

    local targetFaction = Sunset.GetCharacterFaction(pair.targetChar)
    local wanted = nil
    local wantedOk, wantedState = pcall(function()
        return exports.sunset_factions:GetWantedState(pair.targetId)
    end)
    -- [SEC3] wanted level/surrender flag is law-enforcement information, not shown to civilians
    local canSeeWanted = permitted(source, 'mdc') or permitted(source, 'wanted') or permitted(source, 'wanted_limited') or permitted(source, 'arrest')
    if canSeeWanted and wantedOk and type(wantedState) == 'table' and (tonumber(wantedState.level) or 0) > 0 then
        wanted = { level = tonumber(wantedState.level) or 0, surrenderable = wantedState.surrenderable ~= false }
    end

    return {
        target = {
            id = pair.targetId,
            name = exports.sunset_core:GetPlayerDisplayName(pair.targetId),
            level = tonumber(pair.targetChar.level) or 1,
            -- [SEC3] never reveal illegal-faction membership to a random nearby player
            faction = targetFaction and Sunset.Factions[targetFaction] and Sunset.Factions[targetFaction].type ~= 'illegal'
                and Sunset.Factions[targetFaction].label or nil,
            detention = state,
            wanted = wanted,
        },
        actions = actions,
    }
end)

exports.sunset_core:RegisterCallback('sunset:interactionGiveCash', function(source, targetId, rawAmount)
    local pair, err = nearbyPlayers(source, targetId)
    if not pair then return nil, err end

    -- [AUDIT P6-05] Downed/jailed players cannot hand over cash (robbery-at-gunpoint
    -- of a bleeding player must go through the robbery system, not free transfer).
    if exports.sunset_core:IsIncapacitated(source) or exports.sunset_core:IsIncapacitated(targetId) then
        return nil, { localeKey = 'interactions.message.cash_cannot_be_exchanged_right_now' }
    end

    local amount = math.floor(tonumber(rawAmount) or 0)
    if amount < 1 or amount > MAX_CASH_TRANSFER then
        return nil, { localeKey = 'interactions.message.enter_an_amount_between_1_and_value', formatArgs = { MAX_CASH_TRANSFER } }
    end

    local now = GetGameTimer()
    if now - (RequestRate[source] or 0) < 1500 then return nil, { localeKey = 'interactions.message.wait_a_moment_before_transferring_money_again' } end
    RequestRate[source] = now

    local giverName = exports.sunset_core:GetPlayerDisplayName(source)
    local targetName = exports.sunset_core:GetPlayerDisplayName(pair.targetId)
    local outReason = ('Transfer -> %s'):format(tostring(targetName)):sub(1, 64)
    local inReason = ('Transfer <- %s'):format(tostring(giverName)):sub(1, 64)

    if not exports.sunset_core:RemoveMoney(source, 'cash', amount, outReason) then
        return nil, { localeKey = 'interactions.message.you_need_value_cash_in_hand_for_this_transfer', formatArgs = { amount } }
    end
    if not exports.sunset_core:AddMoney(pair.targetId, 'cash', amount, inReason) then
        exports.sunset_core:AddMoney(source, 'cash', amount, 'player_transfer_rollback')
        return nil, { localeKey = 'interactions.message.the_recipient_could_not_receive_the_money_your_cash' }
    end

    notify(pair.targetId, exports.sunset_core:TFor(pair.targetId, 'interactions.msg.gave_you_cash', { giver_name = tostring(giverName), amount = tostring(amount) }), 'success', 6000)
    return { amount = amount, target = targetName }
end)

exports.sunset_core:RegisterCallback('sunset:interactionAddFriend', function(source, targetId)
    local pair, err = nearbyPlayers(source, targetId)
    if not pair then return nil, err end

    local phone = tostring(pair.targetChar.phone_number or '')
    if phone == '' then
        phone = ('555-%04d'):format(tonumber(pair.targetChar.id) or 0)
        pair.targetChar.phone_number = phone
        MySQL.update.await('UPDATE characters SET phone_number = ? WHERE id = ?', { phone, pair.targetChar.id })
    end

    local name = ('%s %s'):format(pair.targetChar.firstname or '', pair.targetChar.lastname or ''):gsub('^%s*(.-)%s*$', '%1')
    if name == '' then name = GetPlayerName(pair.targetId) or ('Player ' .. pair.targetId) end
    if #name > 48 then name = name:sub(1, 48) end

    local ok, dbErr = pcall(function()
        return MySQL.insert.await([[
            INSERT INTO phone_contacts (character_id, contact_name, phone_number, contact_character_id)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                contact_name = VALUES(contact_name),
                contact_character_id = VALUES(contact_character_id)
        ]], { tonumber(pair.sourceChar.id), name, phone, tonumber(pair.targetChar.id) })
    end)

    if not ok then
        print(('[sunset_interactions] add contact failed: %s'):format(tostring(dbErr)))
        return nil, { localeKey = 'interactions.message.the_contact_could_not_be_saved_try_again' }
    end

    notify(pair.targetId, exports.sunset_core:TFor(pair.targetId, 'interactions.msg.added_you_to_their_contacts', { player_display_name = tostring(exports.sunset_core:GetPlayerDisplayName(source)) }), 'info', 5000)
    return { name = name, phone = phone }
end)

AddEventHandler('playerDropped', function()
    RequestRate[source] = nil
end)
