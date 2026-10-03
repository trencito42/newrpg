exports.sunset_core:RegisterCallback('sunset:getCraftingMenu', function(source, stationId)
    local locale = exports.sunset_core:GetPlayerLocale(source)
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return nil, { localeKey = 'crafting.message.your_character_is_not_loaded_reconnect_and_select_it' } end

    local station = Sunset.CraftingStations[stationId]
    if not station then return nil, { localeKey = 'crafting.message.this_crafting_station_is_not_configured' } end
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 or #(GetEntityCoords(ped) - station.coords) > 4.0 then
        return nil, { localeKey = 'crafting.message.stand_inside_the_marker_at_value_to_craft', formatArgs = {
            Sunset.PresentationText(station, 'label', locale) or exports.sunset_core:TFor(source, 'crafting.label.station') } }
    end

    local factionId, grade = Sunset.GetCharacterFaction(char)

    if station.access == 'faction' then
        if factionId ~= station.faction then
            return nil, { localeKey = 'crafting.message.value_is_available_only_to_value_members', formatArgs = {
                Sunset.PresentationText(station, 'label', locale) or exports.sunset_core:TFor(source, 'crafting.label.station'),
                Sunset.FactionLabel(station.faction, locale) } }
        end
        if (grade or 0) < (station.minGrade or 0) then
            return nil, { localeKey = 'crafting.message.faction_rank_value_is_required_at_this_station_your_rank_is_value', formatArgs = {
                station.minGrade or 0, grade or 0 } }
        end
        if not exports.sunset_factions:IsOnDuty(source) then
            return nil, { localeKey = 'crafting.message.you_must_be_on_duty_to_use_this_station' }
        end
        if station.illegal then
            if not Sunset.HasFactionPerm(factionId, grade, 'craft_illegal') then
                return nil, { localeKey = 'crafting.message.rank_too_low_for_this_station' }
            end
        end
    end

    local owned = {}
    for _, row in ipairs(exports.sunset_inventory:GetInventory(source) or {}) do
        owned[row.item] = (owned[row.item] or 0) + (tonumber(row.count) or 0)
    end

    local recipes = {}
    for recipeId, recipe in pairs(Sunset.CraftingRecipes) do
        if recipe.station == stationId then
            local lockedReason
            if recipe.faction and factionId ~= recipe.faction then
                lockedReason = exports.sunset_core:TFor(source, 'crafting.message.wrong_faction')
            elseif recipe.minGrade and (grade or 0) < recipe.minGrade then
                lockedReason = exports.sunset_core:TFor(source, 'crafting.message.requires_rank', {
                    required = recipe.minGrade, current = grade or 0,
                })
            elseif recipe.illegal and not Sunset.HasFactionPerm(factionId, grade, 'craft_illegal') then
                lockedReason = exports.sunset_core:TFor(source, 'crafting.message.illegal_permission_missing')
            end
            local hasMaterials = true
            recipes[#recipes + 1] = {
                id = recipeId,
                labelKey = recipe.labelKey,
                label = Sunset.PresentationText(recipe, 'label', locale),
                time = recipe.time,
                inputs = recipe.inputs,
                inputList = (function()
                    local list = {}
                    for item, need in pairs(recipe.inputs) do
                        list[#list + 1] = {
                            item = item,
                            labelKey = Sunset.Items[item] and Sunset.Items[item].labelKey,
                            label = Sunset.ItemLabel(item, locale),
                            count = need,
                            owned = owned[item] or 0,
                        }
                        if (owned[item] or 0) < need then hasMaterials = false end
                    end
                    table.sort(list, function(a, b) return a.label < b.label end)
                    return list
                end)(),
                output = recipe.output,
                outputLabelKey = Sunset.Items[recipe.output.item] and Sunset.Items[recipe.output.item].labelKey,
                outputLabel = Sunset.ItemLabel(recipe.output.item, locale),
                canCraft = not lockedReason and hasMaterials,
                lockedReason = lockedReason,
            }
        end
    end

    if #recipes == 0 then
        return nil, { localeKey = 'crafting.message.no_recipes_available_here_check_rank_duty' }
    end

    return {
        stationId = stationId,
        stationLabelKey = station.labelKey,
        stationLabel = Sunset.PresentationText(station, 'label', locale),
        stationHintKey = "config.crafting.stationHint.materials_are_taken_from_your_inventory_green_counts_are_ready_r.49d3cd76", stationHint = 'Materials are taken from your inventory. Green counts are ready; red counts are missing.',
        recipes = recipes,
    }
end)

local CraftLocks = {}
local PendingCrafts = {}

AddEventHandler('playerDropped', function()
    CraftLocks[source] = nil
    PendingCrafts[source] = nil
end)

exports.sunset_core:RegisterCallback('sunset:craftBegin', function(source, stationId, recipeId)
    if PendingCrafts[source] then
        return nil, { localeKey = 'crafting.message.your_previous_craft_is_still_being_processed_wait_a' }
    end
    local char = exports.sunset_core:GetCharacter(source)
    local station = Sunset.CraftingStations[stationId]
    local recipe = Sunset.CraftingRecipes[recipeId]
    if not char then return nil, { localeKey = 'crafting.message.your_character_is_not_loaded_reconnect_and_select_it' } end
    if not station or not recipe or recipe.station ~= stationId then
        return nil, { localeKey = 'crafting.msg.that_recipe_does_not_belong_to' }
    end
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 or #(GetEntityCoords(ped) - station.coords) > 4.0 then
        return nil, { localeKey = 'crafting.msg.you_moved_too_far_away_from', params = {
            label = station.label or exports.sunset_core:TFor(source, 'crafting.word.the_crafting_station') } }
    end
    local duration = math.max(1000, math.floor(tonumber(recipe.time) or 5000))
    local now = GetGameTimer()
    local token = ('%d:%d:%d'):format(source, now, math.random(100000, 999999))
    PendingCrafts[source] = {
        token = token, characterId = tonumber(char.id), stationId = stationId, recipeId = recipeId,
        readyAt = now + duration, expiresAt = now + duration + 30000,
    }
    return { token = token, duration = duration }
end)

exports.sunset_core:RegisterCallback('sunset:craftCancel', function(source, token)
    local pending = PendingCrafts[source]
    if pending and pending.token == tostring(token or '') then PendingCrafts[source] = nil end
    return true
end)

exports.sunset_core:RegisterCallback('sunset:craftItem', function(source, stationId, recipeId, token)
    if CraftLocks[source] then return nil, { localeKey = 'crafting.message.your_previous_craft_is_still_being_processed_wait_a' } end
    local pending = PendingCrafts[source]
    PendingCrafts[source] = nil -- one shot: retries must perform the work again
    local now = GetGameTimer()
    if not pending or pending.token ~= tostring(token or '') or pending.stationId ~= stationId
        or pending.recipeId ~= recipeId or now < pending.readyAt or now > pending.expiresAt then
        return nil, { localeKey = 'crafting.message.crafting_session_invalid' }
    end
    CraftLocks[source] = true
    local function done(result, err)
        CraftLocks[source] = nil
        return result, err
    end
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return done(nil, exports.sunset_core:TFor(source, 'clans.message.your_character_is_not_loaded_reconnect_and_try_again')) end
    if tonumber(char.id) ~= pending.characterId then
        return done(nil, exports.sunset_core:TFor(source, 'crafting.message.crafting_session_invalid'))
    end

    local station = Sunset.CraftingStations[stationId]
    local recipe = Sunset.CraftingRecipes[recipeId]
    if not station or not recipe or recipe.station ~= stationId then
        return done(nil, exports.sunset_core:TFor(source, 'crafting.msg.that_recipe_does_not_belong_to'))
    end
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 or #(GetEntityCoords(ped) - station.coords) > 4.0 then
        return done(nil, exports.sunset_core:TFor(source, 'crafting.msg.you_moved_too_far_away_from', { label = station.label or exports.sunset_core:TFor(source, 'crafting.word.the_crafting_station') }))
    end

    local factionId, grade = Sunset.GetCharacterFaction(char)

    if station.access == 'faction' then
        if factionId ~= station.faction then return done(nil, exports.sunset_core:TFor(source, 'crafting.msg.this_crafting_station_belongs_to_another')) end
        if (grade or 0) < (station.minGrade or 0) then return done(nil, exports.sunset_core:TFor(source, 'crafting.msg.your_faction_rank_is_too_low')) end
        if not exports.sunset_factions:IsOnDuty(source) then return done(nil, exports.sunset_core:TFor(source, 'crafting.msg.go_on_duty_before_using_this')) end
    end
    if recipe.faction and factionId ~= recipe.faction then return done(nil, exports.sunset_core:TFor(source, 'crafting.msg.this_recipe_belongs_to_another_faction')) end
    if recipe.minGrade and (grade or 0) < recipe.minGrade then return done(nil, exports.sunset_core:TFor(source, 'crafting.msg.your_faction_rank_is_too_low_2')) end
    if recipe.illegal then
        if not exports.sunset_factions:IsOnDuty(source) then return done(nil, exports.sunset_core:TFor(source, 'crafting.msg.go_on_duty_before_crafting_this')) end
        if not Sunset.HasFactionPerm(factionId, grade, 'craft_illegal') then
            return done(nil, exports.sunset_core:TFor(source, 'crafting.msg.your_rank_does_not_permit_illegal'))
        end
    end

    local out = recipe.output
    local outDef = Sunset.Items[out.item]
    if not outDef then return done(nil, exports.sunset_core:TFor(source, 'crafting.msg.this_recipe_output_is_not_configured')) end
    if outDef.weapon and GetResourceState('sunset_licenses') == 'started'
        and not exports.sunset_licenses:HasLicense(source, 'weapon') then
        return done(nil, exports.sunset_core:TFor(source, 'crafting.msg.a_valid_weapon_license_is_required'))
    end

    local failure
    local crafted = MySQL.startTransaction(function(query)
        local rows = query.await(
            'SELECT id, item, count, slot, metadata FROM character_inventory WHERE character_id = ? ORDER BY id FOR UPDATE',
            { char.id }) or {}
        local totals, used, currentWeight = {}, {}, 0
        for _, row in ipairs(rows) do
            totals[row.item] = (totals[row.item] or 0) + (tonumber(row.count) or 0)
            used[tonumber(row.slot)] = true
            local def = Sunset.Items[row.item]
            currentWeight = currentWeight + ((def and tonumber(def.weight) or 0) * (tonumber(row.count) or 0))
        end
        local consumedWeight = 0
        for item, need in pairs(recipe.inputs) do
            need = math.floor(tonumber(need) or 0)
            if need < 1 or (totals[item] or 0) < need then
                failure = exports.sunset_core:TFor(source, 'crafting.message.missing_material', {
                    item = Sunset.ItemLabel(item, exports.sunset_core:GetPlayerLocale(source)),
                    have = totals[item] or 0, need = need,
                })
                error('missing_materials')
            end
            consumedWeight = consumedWeight + ((Sunset.Items[item] and tonumber(Sunset.Items[item].weight) or 0) * need)
        end
        local outCount = math.max(1, math.floor(tonumber(out.count) or 1))
        local finalWeight = currentWeight - consumedWeight + ((tonumber(outDef.weight) or 0) * outCount)
        if finalWeight > (tonumber(Sunset.Config.MaxWeight) or 30) then
            failure = exports.sunset_core:TFor(source, 'crafting.message.output_too_heavy')
            error('overweight')
        end

        for item, need in pairs(recipe.inputs) do
            local remaining = math.floor(tonumber(need) or 0)
            for _, row in ipairs(rows) do
                if remaining > 0 and row.item == item then
                    local take = math.min(remaining, tonumber(row.count) or 0)
                    if take > 0 then
                        if take == tonumber(row.count) then
                            if query.await('DELETE FROM character_inventory WHERE id = ? AND character_id = ?', { row.id, char.id }) ~= 1 then error('consume_failed') end
                            used[tonumber(row.slot)] = nil
                        else
                            if query.await('UPDATE character_inventory SET count = count - ? WHERE id = ? AND character_id = ? AND count >= ?', { take, row.id, char.id, take }) ~= 1 then error('consume_failed') end
                        end
                        remaining = remaining - take
                    end
                end
            end
            if remaining > 0 then error('consume_failed') end
        end

        local stack
        for _, row in ipairs(rows) do
            if row.item == out.item and (row.metadata == nil or row.metadata == '') then stack = row break end
        end
        if stack then
            if query.await('UPDATE character_inventory SET count = count + ? WHERE id = ? AND character_id = ?', { outCount, stack.id, char.id }) ~= 1 then error('output_failed') end
        else
            local freeSlot
            for slot = 1, tonumber(Sunset.Config.MaxSlots) or 30 do
                if not used[slot] then freeSlot = slot break end
            end
            if not freeSlot then
                failure = exports.sunset_core:TFor(source, 'crafting.message.no_output_slot')
                error('no_slot')
            end
            if not query.insert.await('INSERT INTO character_inventory (character_id, item, count, slot) VALUES (?, ?, ?, ?)', { char.id, out.item, outCount, freeSlot }) then error('output_failed') end
        end
    end)
    if not crafted then
        return done(nil, failure or exports.sunset_core:TFor(source, 'crafting.msg.crafting_could_not_be_committed_nothing'))
    end
    exports.sunset_inventory:ReloadInventory(source)

    return done(true)
end)
