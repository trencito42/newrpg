Sunset = Sunset or {}
Sunset.ProgressionGates = {
    -- Civilian Starter Jobs
    ['job.fisherman'] = {
        label = 'Fisherman Job', -- i18n-ignore: pre-existing
        minLevel = 1,
        description = 'Available immediately to all citizens with basic fishing equipment.', -- i18n-ignore: pre-existing
    },
    ['job.courier'] = {
        label = 'Courier Job', -- i18n-ignore: pre-existing
        minLevel = 1,
        licenses = { 'driver' },
        description = 'Requires a valid Driver License to operate company delivery vehicles.', -- i18n-ignore: pre-existing
    },
    ['job.garbage'] = {
        label = 'Garbage Collector Job', -- i18n-ignore: pre-existing
        minLevel = 1,
        licenses = { 'driver' },
        description = 'Requires a valid Driver License to drive the municipal waste truck.', -- i18n-ignore: pre-existing
    },
    ['job.mechanic'] = {
        label = 'Roadside Mechanic Job', -- i18n-ignore: pre-existing
        minLevel = 3,
        licenses = { 'driver' },
        description = 'Requires Character Level 3 and a valid Driver License to respond to roadside repair calls.', -- i18n-ignore: pre-existing
    },
    ['job.busdriver'] = {
        label = 'Transit Bus Driver Job', -- i18n-ignore: pre-existing
        minLevel = 4,
        licenses = { 'driver' },
        description = 'Requires Character Level 4 and a valid Driver License.', -- i18n-ignore: pre-existing
    },
    ['job.trucker'] = {
        label = 'Commercial Trucker Job', -- i18n-ignore: pre-existing
        minLevel = 1,
        licenses = { 'driver' },
        description = 'Character Level 1 with a Driver License. Longer routes unlock through Trucker job level, not character level.', -- i18n-ignore: pre-existing
    },
    ['job.diver'] = {
        label = 'Salvage Diver Job', -- i18n-ignore: pre-existing
        minLevel = 6,
        description = 'Requires Character Level 6 for deep sea salvage contracts.', -- i18n-ignore: pre-existing
    },
    ['job.hunter'] = {
        label = 'Licensed Wildlife Hunter Job', -- i18n-ignore: pre-existing
        minLevel = 10,
        licenses = { 'weapon', 'hunting' },
        completedQuests = { 'hunt_range_challenge' },
        description = 'Requires Character Level 10, Firearm & Hunting Licenses, and completion of the Hunting Range qualification.', -- i18n-ignore: pre-existing
    },

    -- Criminal Branch (Level 10+)
    ['criminal.lockpicking'] = {
        label = 'Criminal Lockpicking & Contact', -- i18n-ignore: pre-existing
        minLevel = 10,
        completedQuests = { 'car_garage_park' },
        description = 'Unlocked at Character Level 10 after establishing city independence.', -- i18n-ignore: pre-existing
    },
    ['criminal.carjack'] = {
        label = 'Vehicle Theft & Chop Shop', -- i18n-ignore: pre-existing
        minLevel = 10,
        completedQuests = { 'crim_practice_lock' },
        description = 'Requires completing lockpicking practice with your criminal contact.', -- i18n-ignore: pre-existing
    },
    ['criminal.robbery'] = {
        label = 'Commercial & Vault Robberies', -- i18n-ignore: pre-existing
        minLevel = 12,
        completedQuests = { 'crim_chop' },
        description = 'Requires Character Level 12 and a completed vehicle chop contract.', -- i18n-ignore: pre-existing
    },

    -- Dealership & Vehicles
    ['dealership.purchase'] = {
        label = 'Vehicle Ownership & Purchase', -- i18n-ignore: pre-existing
        minLevel = 1,
        licenses = { 'driver' },
        description = 'A valid Driver License is legally required to register and purchase a vehicle.', -- i18n-ignore: pre-existing
    },

    -- Properties
    ['property.rent'] = {
        label = 'Apartment / House Rental', -- i18n-ignore: pre-existing
        minLevel = 3,
        description = 'Requires Character Level 3 to sign lease agreements.', -- i18n-ignore: pre-existing
    },
    ['property.buy'] = {
        label = 'Property Ownership Purchase', -- i18n-ignore: pre-existing
        minLevel = 8,
        description = 'Requires Character Level 8 to register real estate ownership deeds.', -- i18n-ignore: pre-existing
    },

    -- Factions
    ['faction.apply'] = {
        label = 'Official Faction Application', -- i18n-ignore: pre-existing
        minLevel = 10,
        completedQuests = { 'life_reach_level10' },
        description = 'Requires Character Level 10 and completion of the Main City Orientation.', -- i18n-ignore: pre-existing
    },

    -- Clans & Turfs
    ['clan.create'] = {
        label = 'Clan Creation', -- i18n-ignore: pre-existing
        minLevel = 15,
        description = 'Requires Character Level 15 and creation fee.', -- i18n-ignore: pre-existing
    },
    ['clan.join'] = {
        label = 'Clan Membership', -- i18n-ignore: pre-existing
        minLevel = 10,
        description = 'Requires Character Level 10 to join an existing registered clan.', -- i18n-ignore: pre-existing
    },
    ['turf.participate'] = {
        label = 'Turf Warfare Participation', -- i18n-ignore: pre-existing
        minLevel = 15,
        requireActiveClan = true,
        description = 'Requires Character Level 15 and membership in an active, non-expired clan.', -- i18n-ignore: pre-existing
    },
}

-- Evaluation Helper Function (shared between server and client)
function Sunset.EvaluateGate(gateId, charData, licensesMap, completedQuestsMap, clanData)
    local gate = Sunset.ProgressionGates[gateId]
    if not gate then
        return { allowed = true }
    end

    charData = charData or {}
    licensesMap = licensesMap or {}
    completedQuestsMap = completedQuestsMap or {}

    local level = tonumber(charData.level) or 1
    local missing = {}

    -- 1. Level Check
    if gate.minLevel and level < gate.minLevel then
        table.insert(missing, {
            type = 'level',
            required = gate.minLevel,
            current = level,
            message = ('Requires Character Level %d (Current: %d)'):format(gate.minLevel, level)
        })
    end

    -- 2. License Checks
    if gate.licenses then
        for _, lic in ipairs(gate.licenses) do
            if not licensesMap[lic] then
                local licLabel = lic:gsub('^%l', string.upper)
                if lic == 'driver' then licLabel = 'Driver License'
                elseif lic == 'hunting' then licLabel = 'Hunting License'
                elseif lic == 'weapon' then licLabel = 'Firearm License'
                end
                table.insert(missing, {
                    type = 'license',
                    license = lic,
                    message = ('Requires %s'):format(licLabel)
                })
            end
        end
    end

    -- 3. Completed Quests Checks
    if gate.completedQuests then
        for _, qKey in ipairs(gate.completedQuests) do
            if not completedQuestsMap[qKey] then
                table.insert(missing, {
                    type = 'quest',
                    questKey = qKey,
                    message = ('Requires completing quest "%s"'):format(qKey)
                })
            end
        end
    end

    -- 4. Clan Checks
    if gate.requireActiveClan then
        if not clanData or not clanData.clan_id or clanData.isExpired then
            table.insert(missing, {
                type = 'clan',
                message = 'Requires active membership in an unexpired clan.' -- i18n-ignore: pre-existing
            })
        end
    end

    if #missing > 0 then
        local primaryReason = missing[1].message
        return {
            allowed = false,
            gate = gate,
            reason = primaryReason,
            missing = missing
        }
    end

    return { allowed = true, gate = gate }
end
