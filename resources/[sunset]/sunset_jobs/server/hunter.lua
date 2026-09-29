-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — server/hunter.lua
--  Server-authoritative Hunter job: contracts, animal registry,
--  kill-quality calculation, harvest validation, sell.
-- ═══════════════════════════════════════════════════════════════

local DEBUG = GetConvar('sv_sunset_hunting_debug', '0') == '1'
local function dlog(fmt, ...)
    if DEBUG then print(('^3[hunter]^7 ' .. fmt):format(...)) end
end

-- [SECTION 14] Canonical weapon hash → name reverse-lookup.
-- Built from joaat() of approved and common weapon names. weaponDamageEvent sends the
-- integer hash; GetHashKey(tostring(hash)) DOES NOT reverse-lookup — it re-hashes the
-- digit string, giving a completely wrong weapon name. Use this table instead.
-- Normalized to signed 32-bit integers (weaponDamageEvent may send unsigned).
local function normalizeHash(h)
    h = tonumber(h) or 0
    if h > 2147483647 then h = h - 4294967296 end
    return h
end
local _weaponNames = {
    'WEAPON_PISTOL', 'WEAPON_PISTOL_MK2', 'WEAPON_COMBATPISTOL', 'WEAPON_APPISTOL',
    'WEAPON_STUNGUN', 'WEAPON_MICROSMG', 'WEAPON_SMG', 'WEAPON_SMG_MK2',
    'WEAPON_ASSAULTSMG', 'WEAPON_ASSAULTRIFLE', 'WEAPON_ASSAULTRIFLE_MK2',
    'WEAPON_CARBINERIFLE', 'WEAPON_CARBINERIFLE_MK2', 'WEAPON_ADVANCEDRIFLE',
    'WEAPON_SPECIALCARBINE', 'WEAPON_SPECIALCARBINE_MK2', 'WEAPON_BULLPUPRIFLE',
    'WEAPON_BULLPUPRIFLE_MK2', 'WEAPON_COMPACTRIFLE',
    'WEAPON_MG', 'WEAPON_COMBATMG', 'WEAPON_COMBATMG_MK2',
    'WEAPON_PUMPSHOTGUN', 'WEAPON_PUMPSHOTGUN_MK2', 'WEAPON_SAWNOFFSHOTGUN',
    'WEAPON_ASSAULTSHOTGUN', 'WEAPON_BULLPUPSHOTGUN', 'WEAPON_MUSKET',
    'WEAPON_HEAVYSHOTGUN', 'WEAPON_DBSHOTGUN', 'WEAPON_AUTOSHOTGUN',
    'WEAPON_SNIPERRIFLE', 'WEAPON_HEAVYSNIPER', 'WEAPON_HEAVYSNIPER_MK2',
    'WEAPON_MARKSMANRIFLE', 'WEAPON_MARKSMANRIFLE_MK2',
    'WEAPON_RPGROCKET', 'WEAPON_GRENADELAUNCHER', 'WEAPON_MINIGUN',
    'WEAPON_GRENADE', 'WEAPON_STICKYBOMB', 'WEAPON_PROXMINE',
    'WEAPON_KNIFE', 'WEAPON_NIGHTSTICK', 'WEAPON_HAMMER',
    'WEAPON_BAT', 'WEAPON_CROWBAR', 'WEAPON_BOTTLE',
    'WEAPON_UNARMED',
}
SunsetHunterWeaponNames = {}
for _, name in ipairs(_weaponNames) do
    local h = normalizeHash(GetHashKey(name))
    SunsetHunterWeaponNames[h] = name
    -- also map the unsigned form so both representations resolve
    if h < 0 then SunsetHunterWeaponNames[h + 4294967296] = name end
end

-- ── Rate Limits ──────────────────────────────────────────────
local RateLimit = {}
local RATE_LIMIT_SEC = 2

local function checkRate(source, action)
    local key = ('%d:%s'):format(source, action)
    local now = os.time()
    if RateLimit[key] and now - RateLimit[key] < RATE_LIMIT_SEC then
        return false
    end
    RateLimit[key] = now
    return true
end

-- ── Managed Animal Registry ──────────────────────────────────
-- Animals[netId] = { species, zoneId, spawnedAt, weight, alive, harvested,
--                    shooters={[charId]={shots,damage}}, fatalShooterId,
--                    killWeapon, killMethod, shots, lastPos }
local Animals = {}

-- Active zone population: Zones[zoneId] = { count, lastActiveAt }
local ZoneActivity = {}

-- Active hunter sessions with their contract state (mirrors SunsetJobs_GetSession)
-- HunterContracts[source] = { contractId, zoneId, species, required, harvested=0 }
local HunterContracts = {}

-- Harvest ownership: HarvestOwner[animalNetId] = { charId, claimedAt }
local HarvestOwner = {}

-- ── Helpers ──────────────────────────────────────────────────
local function getChar(source)
    return exports.sunset_core:GetCharacter(source)
end

local function charId(source)
    local char = getChar(source)
    return char and tonumber(char.id)
end

local function hunterLevel(source)
    return SunsetJobs_GetJobLevel(source, 'hunter')
end

local function playerPos(source)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return nil end
    return GetEntityCoords(ped)
end

local function distV3(a, b)
    if not a or not b then return 9999 end
    local dx = a.x - b.x
    local dy = a.y - b.y
    local dz = a.z - b.z
    return math.sqrt(dx*dx + dy*dy + dz*dz)
end

-- Point-in-polygon (ray-cast, XY plane)
local function pointInPolygon(px, py, polygon)
    if not polygon or #polygon < 3 then return false end
    local inside = false
    local n = #polygon
    local j = n
    for i = 1, n do
        local xi, yi = polygon[i].x, polygon[i].y
        local xj, yj = polygon[j].x, polygon[j].y
        local intersect = ((yi > py) ~= (yj > py))
            and (px < (xj - xi) * (py - yi) / (yj - yi) + xi)
        if intersect then inside = not inside end
        j = i
    end
    return inside
end

local function inHuntingZone(source, zone)
    local pos = playerPos(source)
    if not pos then return false end
    if pos.z < zone.minZ or pos.z > zone.maxZ then return false end
    return pointInPolygon(pos.x, pos.y, zone.polygon)
end

-- Resolve zone object from config+route store by id
local function getZone(zoneId)
    local zones = SunsetJobRoutes.GetRoutes('hunting')
    for _, z in ipairs(zones) do
        if z.id == zoneId then return z end
    end
    return nil
end

-- ── Kill Quality Calculation ──────────────────────────────────
local function calcKillQuality(animal, weaponName, method)
    if not animal then return 0 end
    local cfg = Sunset.JobsConfig.hunter

    -- Vehicle/fire/explosive kills produce zero quality (no legal harvest credit)
    if method == 'vehicle' or method == 'explosive' or method == 'fire' then
        return 0
    end

    local base = cfg.qualityBaseScore or 100

    -- Extra shots beyond the first each reduce quality
    local shots = animal.shots or 1
    local extraShot = math.max(0, shots - 1)
    local shotPenalty = extraShot * (cfg.qualityPenaltyExtraShot or 15)

    -- Approved weapon bonus/penalty
    local wName = tostring(weaponName or ''):upper()
    local weaponEntry = cfg.approvedWeapons and cfg.approvedWeapons[wName]
    local weaponPenalty = 0
    if not weaponEntry then
        weaponPenalty = cfg.qualityPenaltyBadWeapon or 25
    elseif weaponEntry.qualityBonus then
        weaponPenalty = -weaponEntry.qualityBonus  -- negative = bonus
    end

    local quality = math.max(0, math.min(100,
        base - shotPenalty - weaponPenalty
    ))
    dlog('quality calc: shots=%d weaponPenalty=%d result=%d', shots, weaponPenalty, quality)
    return quality
end

local function qualityToGrade(quality)
    if quality >= 85 then return 'pristine'
    elseif quality >= 65 then return 'good'
    elseif quality >= 40 then return 'fair'
    else return 'poor'
    end
end

-- ── Harvest Yield Calculation ─────────────────────────────────
local function calcHarvestYield(animal, quality)
    local cfg = Sunset.JobsConfig.hunter
    local speciesCfg = cfg.species[animal.species]
    if not speciesCfg then return {} end

    local qFrac = quality / 100.0
    local yields = {}

    -- Meat yield
    if speciesCfg.meatItem then
        local minY = speciesCfg.meatYieldMin or 0
        local maxY = speciesCfg.meatYieldMax or 0
        local yieldKg = minY + (maxY - minY) * qFrac
        yieldKg = math.floor(yieldKg * 10 + 0.5) / 10
        if yieldKg > 0 then
            yields[#yields + 1] = {
                item = speciesCfg.meatItem,
                count = 1,
                metadata = {
                    species  = animal.species,
                    weight   = yieldKg,
                    quality  = quality,
                    grade    = qualityToGrade(quality),
                    animalId = animal.netId,
                    harvestedAt = os.time(),
                },
            }
        end
    end

    -- Hide
    if speciesCfg.hideItem then
        yields[#yields + 1] = {
            item = speciesCfg.hideItem,
            count = 1,
            metadata = {
                species = animal.species,
                quality = quality,
                grade   = qualityToGrade(quality),
                animalId = animal.netId,
                harvestedAt = os.time(),
            },
        }
    end

    -- Trophy (only if quality meets threshold)
    if speciesCfg.trophyItem and quality >= (speciesCfg.trophyMinQuality or 70) then
        yields[#yields + 1] = {
            item = speciesCfg.trophyItem,
            count = 1,
            metadata = {
                species = animal.species,
                quality = quality,
                grade   = qualityToGrade(quality),
                animalId = animal.netId,
                harvestedAt = os.time(),
            },
        }
    end

    return yields
end

local function calcHarvestValue(animal, quality)
    local cfg = Sunset.JobsConfig.hunter
    local speciesCfg = cfg.species[animal.species]
    if not speciesCfg then return 0 end
    local gradeMultiplier = (cfg.gradeMultiplier or {})[qualityToGrade(quality)] or 0.5
    local base = (speciesCfg.baseValue or 10) * (animal.weight or 50)
    return math.floor(base * gradeMultiplier)
end

-- ── Sell Harvest ──────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:hunter:sellHarvest', function(source)
    if not checkRate(source, 'sell') then return nil, 'Too many requests' end
    local session = SunsetJobs_RequireSession(source, 'hunter', nil)
    if not session then return nil, 'No active Hunter shift' end

    local char = getChar(source)
    if not char then return nil, 'Character not loaded' end

    -- [SECTION 23] Atomic sell: snapshot → validate → remove → verify → pay.
    -- If payment fails, restore the exact item + metadata snapshot so the player
    -- does not lose items without receiving money. GetInventory is the only server
    -- API that exposes per-slot metadata needed to restore items faithfully.
    local harvestItems = { 'venison', 'boar_meat', 'animal_hide', 'coyote_pelt', 'antlers' }
    local totalValue = 0
    local sold = {}       -- items to remove
    local snapshots = {}  -- full slot snapshot for restore-on-failure

    local inv = exports.sunset_inventory:GetInventory(source)
    if not inv then return nil, 'Could not load inventory' end

    local harvestSet = {}
    for _, hi in ipairs(harvestItems) do harvestSet[hi] = true end

    for _, slot in ipairs(inv) do
        if harvestSet[slot.item] then
            -- Server determines value from metadata — never trust client
            local meta = type(slot.metadata) == 'table' and slot.metadata or {}
            local quality = tonumber(meta.quality) or 50
            local weight  = tonumber(meta.weight) or 1.0
            local grade   = qualityToGrade(quality)
            local cfg     = Sunset.JobsConfig.hunter
            local gradeM  = (cfg.gradeMultiplier or {})[grade] or 0.5
            local speciesKey = tostring(meta.species or '')
            local speciesCfg = cfg.species[speciesKey]
            local baseVal = speciesCfg and speciesCfg.baseValue or 8
            local itemVal = math.floor(baseVal * weight * gradeM)
            totalValue = totalValue + itemVal
            sold[#sold + 1] = { item = slot.item, slot = slot.slot, value = itemVal }
            -- Full snapshot for potential restore (preserves all metadata)
            snapshots[#snapshots + 1] = {
                item     = slot.item,
                count    = slot.count or 1,
                metadata = meta,
            }
        end
    end

    if #sold == 0 then
        return nil, 'No harvest items to sell. Go hunt first.'
    end

    -- Remove items FIRST (before payment). Items are locked; payment failure
    -- triggers an item restore so the player loses nothing.
    for _, s in ipairs(sold) do
        exports.sunset_inventory:RemoveItem(source, s.item, 1)
    end

    -- Pay after items are removed.
    local paid = exports.sunset_core:AddMoney(source, 'cash', totalValue, 'hunter_sell')
    if not paid then
        -- Payment failed — restore exact items with all metadata.
        for _, snap in ipairs(snapshots) do
            exports.sunset_inventory:AddItem(source, snap.item, snap.count, nil, snap.metadata)
        end
        exports.sunset_inventory:ReloadInventory(source)
        return nil, 'Payment failed — your items have been returned. Please try again.'
    end

    SunsetJobs_AddJobProgress(source, 'hunter', math.max(5, math.floor(totalValue / 10)), 0, totalValue)
    exports.sunset_inventory:ReloadInventory(source)
    exports.sunset_core:RefreshMoney(source)

    dlog('char %d sold %d harvest items for $%d', char.id, #sold, totalValue)
    return { total = totalValue, count = #sold }
end)

-- ── Start Shift ───────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:hunter:start', function(source)
    local char = getChar(source)
    if not char then return nil, 'Character not loaded' end

    -- Check licenses server-side (fail-closed: if resource down, block)
    if GetResourceState('sunset_licenses') ~= 'started' then
        return nil, 'Licensing service unavailable. Try again in a moment.'
    end
    local hasWeapon = exports.sunset_licenses:HasLicense(source, 'weapon')
    if hasWeapon ~= true then
        return nil, 'Requires a valid Firearm License. Visit the LSSI Weapon Range.'
    end
    local hasHunting = exports.sunset_licenses:HasLicense(source, 'hunting')
    if hasHunting ~= true then
        return nil, 'Requires a valid Hunting License. Visit the LSSI Hunting Range.'
    end

    local existing = SunsetJobs_GetSession(source)
    if existing and existing.jobId == 'hunter' then
        return existing.data
    end

    local level = hunterLevel(source)
    local session, err = SunsetJobs_StartSession(source, 'hunter', {
        level = level,
        contractId = nil,
        zoneId = nil,
        harvested = 0,
        stage = 'idle',
    })
    if not session then return nil, err end
    return session.data
end)

-- ── Get Contracts ─────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:hunter:getContracts', function(source)
    local session = SunsetJobs_RequireSession(source, 'hunter', nil)
    if not session then return nil, 'Start your shift first' end

    local level = session.data.level or 1
    local cfg = Sunset.JobsConfig.hunter
    local available = {}
    for _, contract in ipairs(cfg.contracts or {}) do
        if contract.minRank <= level then
            available[#available + 1] = {
                id              = contract.id,
                label           = contract.label,
                description     = contract.description,
                species         = contract.species,
                requiredHarvests = contract.requiredHarvests,
                minRank         = contract.minRank,
                zoneId          = contract.zoneId,
                pay             = contract.pay,
                xp              = contract.xp,
                trophyRequired  = contract.trophyRequired or false,
            }
        end
    end
    return available
end)

-- ── Start Contract ────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:hunter:startContract', function(source, contractId)
    if not checkRate(source, 'startContract') then return nil, 'Too many requests' end
    local session = SunsetJobs_RequireSession(source, 'hunter', nil)
    if not session then return nil, 'Start your shift first' end

    if session.data.contractId then
        return nil, ('You already have an active contract: %s'):format(session.data.contractId)
    end

    contractId = tostring(contractId or '')
    local cfg = Sunset.JobsConfig.hunter
    local contract = nil
    for _, c in ipairs(cfg.contracts or {}) do
        if c.id == contractId then contract = c break end
    end
    if not contract then return nil, 'Unknown contract' end

    local level = session.data.level or 1
    if contract.minRank > level then
        return nil, ('Contract requires Hunter Rank %d (you are Rank %d)'):format(contract.minRank, level)
    end

    -- Validate zone exists in route store
    local zone = getZone(contract.zoneId)
    if not zone then
        return nil, 'Hunting zone not configured. Contact an administrator.'
    end

    session.data.contractId   = contractId
    session.data.zoneId       = contract.zoneId
    session.data.species      = contract.species
    session.data.requiredHarvests = contract.requiredHarvests
    session.data.harvested    = 0
    session.data.stage        = 'hunting'
    session.data.contractPay  = contract.pay
    session.data.contractXp   = contract.xp
    session.data.trophyRequired = contract.trophyRequired or false
    HunterContracts[source] = {
        contractId = contractId,
        zoneId     = contract.zoneId,
        species    = contract.species,
        required   = contract.requiredHarvests,
        harvested  = 0,
        contractPay = contract.pay,
        contractXp  = contract.xp,
    }

    SunsetJobs_SetState(source, 'ACTIVE')
    TriggerClientEvent('sunset:jobs:stateChanged', source, 'ACTIVE', session.data)

    -- Ensure animal population for this zone
    ZoneActivity[contract.zoneId] = { count = 0, lastActiveAt = os.time() }
    TriggerEvent('sunset:hunting:ensureZonePopulation', contract.zoneId)

    dlog('char %s started contract %s zone %s', charId(source), contractId, contract.zoneId)
    return {
        contractId = contractId,
        zone = zone,
        species = contract.species,
        requiredHarvests = contract.requiredHarvests,
        pay = contract.pay,
    }
end)

-- ── Animal Damage (weaponDamageEvent hook for managed animals) ──
-- This handler runs in addition to the license gate handler.
-- It is PURE attribution and quality tracking — does NOT cancel damage.
AddEventHandler('weaponDamageEvent', function(sender, data)
    if type(data) ~= 'table' then return end
    local netId = tonumber(data.hitGlobalId)
    if not netId or netId == 0 then return end
    local animal = Animals[netId]
    if not animal or not animal.alive or animal.harvested then return end

    local char = getChar(sender)
    if not char then return end

    -- Only attribute damage from active Hunters
    local session = SunsetJobs_GetSession(sender)
    if not session or session.jobId ~= 'hunter' then return end
    if session.data.zoneId ~= animal.zoneId then return end

    local weaponHash = tonumber(data.weaponType) or 0
    -- [SECTION 14] GetHashKey(tostring(number)) is wrong — it hashes the string "12345" not the
    -- weapon. Use a reverse-lookup table built from joaat() of known weapon names.
    -- Normalize to signed 32-bit int first (weaponDamageEvent may send unsigned).
    if weaponHash > 2147483647 then weaponHash = weaponHash - 4294967296 end
    local weaponName = SunsetHunterWeaponNames and SunsetHunterWeaponNames[weaponHash]
        or ('0x%X'):format(weaponHash < 0 and weaponHash + 4294967296 or weaponHash)

    -- Detect damage method
    local method = 'firearm'
    if data.impactType == 3 then method = 'vehicle'
    elseif data.impactType == 4 then method = 'explosive'
    elseif data.impactType == 5 then method = 'fire'
    end

    -- Track per-shooter damage and last weapon used
    local cid = char.id
    animal.shooters = animal.shooters or {}
    animal.shooters[cid] = animal.shooters[cid] or { shots = 0, damage = 0 }
    animal.shooters[cid].shots          = animal.shooters[cid].shots + 1
    animal.shooters[cid].damage         = animal.shooters[cid].damage + (tonumber(data.weaponDamage) or 10)
    animal.shooters[cid].lastWeaponName = weaponName
    animal.shots = (animal.shots or 0) + 1
    animal.lastMethod = method

    dlog('animal %d hit by char %d weapon=%s shots=%d method=%s', netId, cid, weaponName, animal.shots, method)

    -- Notify the owner-client to update animal AI (flee behavior)
    local entity = NetworkGetEntityFromNetworkId(netId)
    if entity and entity ~= 0 and DoesEntityExist(entity) then
        local owner = NetworkGetEntityOwner(entity)
        if owner and owner > 0 then
            TriggerClientEvent('sunset:hunting:animalHit', owner, netId, sender)
        end
    end
end)

-- ── Animal Death (client-reported, server-validated) ─────────
-- Client reports when entity health reaches 0. Server validates and processes exactly once.
RegisterNetEvent('sunset:hunting:reportAnimalDead', function(netId)
    local src = source
    netId = tonumber(netId)
    if not netId then return end
    local animal = Animals[netId]
    if not animal or not animal.alive then return end  -- idempotency: only process once

    local char = getChar(src)
    if not char then return end

    -- Validate: reporter has an active hunter session
    local session = SunsetJobs_GetSession(src)
    if not session or session.jobId ~= 'hunter' then return end

    -- Validate: animal is in reporter's contracted zone
    if session.data.zoneId and animal.zoneId ~= tostring(session.data.zoneId) then return end

    -- Server-side entity death confirmation (optional if entity still accessible)
    local method = animal.lastMethod or 'firearm'

    -- Mark dead before any async work (idempotency guard)
    animal.alive = false
    animal.killedAt = os.time()
    animal.killMethod = method

    -- Determine kill owner (highest-damage contributing hunter)
    local bestCharId, bestDamage = nil, 0
    for cid, info in pairs(animal.shooters or {}) do
        if info.damage > bestDamage then
            bestDamage = info.damage
            bestCharId = cid
        end
    end
    animal.fatalShooterId = bestCharId

    -- Record kill weapon from the fatal shooter's last tracked damage event.
    -- [SECTION 15] Do NOT default to WEAPON_SNIPERRIFLE — that would silently give
    -- quality bonuses for unknown weapons. Use 'UNKNOWN' so calcKillQuality applies
    -- the qualityPenaltyBadWeapon penalty (conservative/correct).
    if bestCharId and animal.shooters[bestCharId] then
        local rawName = animal.shooters[bestCharId].lastWeaponName or ''
        animal.killWeapon = rawName ~= '' and string.upper(rawName) or 'UNKNOWN'
    else
        animal.killWeapon = 'UNKNOWN'
    end

    -- Determine owner and grant exclusive harvest window
    local ownerSrc = nil
    -- Find the source that matches fatalShooterId
    if bestCharId then
        for _, playerSrc in ipairs(GetPlayers()) do
            local ps = tonumber(playerSrc)
            if ps then
                local pc = getChar(ps)
                if pc and tonumber(pc.id) == bestCharId then
                    ownerSrc = ps
                    break
                end
            end
        end
    end
    if not ownerSrc then ownerSrc = src end

    HarvestOwner[netId] = { charId = bestCharId or charId(src), claimedAt = os.time() }

    dlog('animal %d died method=%s owner_char=%s', netId, animal.killMethod, tostring(animal.fatalShooterId))

    -- Notify all hunters in zone about the carcass
    local zone = getZone(animal.zoneId)
    if zone then
        for _, playerSrc in ipairs(GetPlayers()) do
            local ps = tonumber(playerSrc)
            if ps then
                local psess = SunsetJobs_GetSession(ps)
                if psess and psess.jobId == 'hunter' and psess.data.zoneId == animal.zoneId then
                    TriggerClientEvent('sunset:hunting:animalDown', ps, netId,
                        { x = animal.lastPos.x, y = animal.lastPos.y, z = animal.lastPos.z },
                        ownerSrc == ps)
                end
            end
        end
    end

    -- Update zone population count
    if ZoneActivity[animal.zoneId] then
        ZoneActivity[animal.zoneId].count = math.max(0, (ZoneActivity[animal.zoneId].count or 0) - 1)
    end

    -- Illegal kill hook (no active hunter, wrong zone, protected species)
    local speciesCfg = Sunset.JobsConfig.hunter.species[animal.species or '']
    if speciesCfg and speciesCfg.protected then
        TriggerEvent('sunset:hunting:illegalKill', {
            characterId = bestCharId,
            species = animal.species,
            zoneId = animal.zoneId,
            reason = 'protected_species',
        })
    end
end)

-- reportKillWeapon is removed: weapon is now tracked server-side via weaponDamageEvent.

-- ── Inspect Carcass ───────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:hunter:inspectCarcass', function(source, netId)
    if not checkRate(source, 'inspect') then return nil, 'Too many requests' end
    netId = tonumber(netId)
    if not netId then return nil, 'Invalid animal' end
    local animal = Animals[netId]
    if not animal then return nil, 'No animal found. It may have already been cleaned up.' end
    if animal.alive then return nil, 'The animal is still alive.' end
    if animal.harvested then return nil, 'This carcass has already been harvested.' end

    local cfg = Sunset.JobsConfig.hunter
    local speciesCfg = cfg.species[animal.species or '']
    if not speciesCfg then return nil, 'Unknown species' end

    local quality = calcKillQuality(animal, animal.killWeapon, animal.killMethod)
    local grade   = qualityToGrade(quality)

    return {
        netId   = netId,
        species = animal.species,
        label   = speciesCfg.label,
        weight  = animal.weight,
        quality = quality,
        grade   = grade,
        shots   = animal.shots or 1,
        method  = animal.killMethod or 'unknown',
        weapon  = animal.killWeapon,
        canHarvest = true,
    }
end)

-- ── Harvest Carcass ───────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:hunter:harvest', function(source, netId)
    if not checkRate(source, 'harvest') then return nil, 'Too many requests' end
    netId = tonumber(netId)
    if not netId then return nil, 'Invalid animal' end

    local animal = Animals[netId]
    if not animal then return nil, 'Animal not found or already cleaned up.' end
    if animal.alive then return nil, 'The animal is still alive.' end
    if animal.harvested then return nil, 'This carcass has already been harvested.' end

    -- Session check
    local session = SunsetJobs_RequireSession(source, 'hunter', nil)
    if not session then return nil, 'No active Hunter shift' end

    -- License check (server-side, fail-closed)
    if GetResourceState('sunset_licenses') ~= 'started' then
        return nil, 'Licensing service unavailable. Try again.'
    end
    if exports.sunset_licenses:HasLicense(source, 'weapon') ~= true then
        return nil, 'Requires a valid Firearm License to harvest.'
    end
    if exports.sunset_licenses:HasLicense(source, 'hunting') ~= true then
        return nil, 'Requires a valid Hunting License to harvest.'
    end

    -- Hunting knife check (required to field dress the carcass)
    if not exports.sunset_inventory:HasItem(source, 'hunting_knife', 1) then
        return nil, 'Requires a Hunting Knife to harvest. Available at Ammu-Nation.'
    end

    -- Zone check
    if session.data.zoneId ~= animal.zoneId then
        return nil, 'This animal is not in your contracted zone.'
    end

    -- Proximity check
    if not SunsetJobs_ValidateCoords(source,
        vector3(animal.lastPos.x, animal.lastPos.y, animal.lastPos.z),
        Sunset.JobsConfig.hunter.harvestRadius or 4.0) then
        return nil, 'Move closer to the carcass to harvest it.'
    end

    -- Harvest ownership check
    local owner = HarvestOwner[netId]
    local cfg = Sunset.JobsConfig.hunter
    if owner then
        local cid = charId(source)
        local windowSec = cfg.harvestOwnerWindowSec or 60
        if owner.charId ~= cid and os.time() - owner.claimedAt < windowSec then
            return nil, ('This carcass belongs to another hunter for another %d seconds.'):format(
                windowSec - (os.time() - owner.claimedAt))
        end
    end

    -- Species match
    local requiredSpecies = session.data.species
    if requiredSpecies and requiredSpecies ~= '' and animal.species ~= requiredSpecies then
        return nil, ('Your contract requires %s. This is a %s.'):format(requiredSpecies, animal.species)
    end

    -- Mark as harvested BEFORE inventory (idempotency guard)
    animal.harvested = true
    HarvestOwner[netId] = nil

    -- Calculate quality and yield
    local quality = calcKillQuality(animal, animal.killWeapon, animal.killMethod)
    local yields  = calcHarvestYield(animal, quality)

    -- Try to add all items; rollback harvested flag if inventory is full
    local addedItems = {}
    for _, y in ipairs(yields) do
        local ok = exports.sunset_inventory:AddItem(source, y.item, y.count, nil, y.metadata)
        if not ok then
            -- Rollback items already added and release harvest
            for _, added in ipairs(addedItems) do
                exports.sunset_inventory:RemoveItem(source, added.item, added.count)
            end
            animal.harvested = false
            HarvestOwner[netId] = { charId = charId(source), claimedAt = os.time() }
            return nil, 'Your inventory is full. Make room and try again.'
        end
        addedItems[#addedItems + 1] = y
    end

    exports.sunset_inventory:ReloadInventory(source)

    -- Contract progress
    -- [SECTION 16] trophyRequired contracts only count harvests that include a trophy item
    -- (i.e. quality >= trophyMinQuality). If the quality was too low the player harvested
    -- the carcass but did NOT make progress — notify them and let them keep trying.
    local contract = HunterContracts[source]
    local countsForProgress = true
    if contract and session.data.trophyRequired then
        local speciesCfg = cfg.species[animal.species or '']
        local minQ = speciesCfg and speciesCfg.trophyMinQuality or 70
        if quality < minQ then
            countsForProgress = false
            TriggerClientEvent('sunset:client:notify', source,
                ('Trophy contract: quality %d is below minimum %d. Take a cleaner shot next time.'):format(
                    quality, minQ), 'warning', 7000)
        end
    end

    if contract and contract.zoneId == animal.zoneId and countsForProgress then
        contract.harvested = (contract.harvested or 0) + 1
        session.data.harvested = contract.harvested
        TriggerClientEvent('sunset:jobs:stateChanged', source, session.state, session.data)

        -- Contract complete?
        if contract.harvested >= contract.required then
            local bonus = contract.contractPay or 0
            local xpBonus = contract.contractXp or 0
            local paid = exports.sunset_core:AddMoney(source, 'cash', bonus, 'hunter_contract_complete')
            if paid then
                SunsetJobs_AddJobProgress(source, 'hunter', xpBonus, 1, bonus)
                exports.sunset_core:RefreshMoney(source)
            end
            -- Clear contract
            session.data.contractId = nil
            session.data.harvested  = 0
            session.data.stage      = 'idle'
            HunterContracts[source] = nil
            TriggerClientEvent('sunset:hunting:contractComplete', source, {
                contractId = contract.contractId,
                bonus = bonus,
                xp = xpBonus,
            })
        end
    end

    -- XP per harvest
    SunsetJobs_AddJobXP(source, 'hunter', cfg.xpPerHarvest or 30)

    -- Remove entity (cleanup)
    SetTimeout(5000, function()
        Animals[netId] = nil
        HarvestOwner[netId] = nil
    end)

    dlog('char %d harvested animal %d quality=%d items=%d', charId(source), netId, quality, #yields)
    return {
        items   = addedItems,
        quality = quality,
        grade   = qualityToGrade(quality),
        contractProgress = session.data.harvested or 0,
        contractRequired = (contract or {}).required or 0,
    }
end)

-- ── End Shift ─────────────────────────────────────────────────
exports.sunset_core:RegisterCallback('sunset:jobs:hunter:endShift', function(source)
    HunterContracts[source] = nil
    SunsetJobs_ClearSession(source, 'COMPLETED', 'Shift ended by player')
    return true
end)

-- ── Tracking Clue ─────────────────────────────────────────────
-- Client polls this when on contract to get a directional tracking clue.
exports.sunset_core:RegisterCallback('sunset:jobs:hunter:track', function(source)
    if not checkRate(source, 'track') then return nil, 'Too many requests' end
    local session = SunsetJobs_RequireSession(source, 'hunter', nil)
    if not session or session.data.stage ~= 'hunting' then return nil, 'No active hunt' end

    local pos = playerPos(source)
    if not pos then return nil, 'Position unavailable' end

    local contract = HunterContracts[source]
    if not contract then return nil, 'No active contract' end

    -- Find nearest alive unregistered animal in zone
    local nearest, nearestDist = nil, 9999
    for netId, animal in pairs(Animals) do
        if animal.zoneId == contract.zoneId and animal.alive and not animal.harvested then
            local d = distV3(pos, animal.lastPos)
            if d < nearestDist then
                nearestDist = d
                nearest = animal
                nearest.netId = netId
            end
        end
    end

    if not nearest or nearestDist > (Sunset.JobsConfig.hunter.trackingClueRadius or 80.0) then
        return { type = 'no_tracks', message = 'No fresh tracks in this area. Move deeper into the zone.' }
    end

    -- Direction from player to animal
    local dx = nearest.lastPos.x - pos.x
    local dy = nearest.lastPos.y - pos.y
    local angleDeg = math.deg(math.atan(dy, dx))
    local dirs = { 'E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE' }
    local idx = math.floor(((angleDeg + 180 + 22.5) / 45) % 8) + 1
    local dirLabel = dirs[idx] or 'N'

    -- Fuzzy distance (don't give exact position)
    local fuzzyDist = math.floor(nearestDist / 10) * 10

    local clueTypes = { 'fresh_tracks', 'broken_branch', 'recent_tracks', 'disturbed_ground' }
    local clue = clueTypes[math.random(#clueTypes)]

    return {
        type      = clue,
        direction = dirLabel,
        distance  = fuzzyDist,
        message   = ('Fresh sign found. Direction: ~b~%s~s~  ~y~≈%dm'):format(dirLabel, fuzzyDist),
    }
end)

-- ── Animal Spawn Registration ─────────────────────────────────
-- Client registers a newly spawned managed animal with the server.
RegisterNetEvent('sunset:hunting:registerAnimal', function(netId, species, zoneId, weight)
    local src = source
    netId = tonumber(netId)
    if not netId or netId == 0 then return end

    -- Verify the caller has an active hunter session in this zone
    local session = SunsetJobs_GetSession(src)
    if not session or session.jobId ~= 'hunter' then return end
    if tostring(zoneId) ~= tostring(session.data.zoneId) then return end

    -- Validate species
    local speciesCfg = Sunset.JobsConfig.hunter.species[tostring(species or '')]
    if not speciesCfg then return end

    local entity = NetworkGetEntityFromNetworkId(netId)
    if not entity or entity == 0 or not DoesEntityExist(entity) then return end
    if GetEntityType(entity) ~= 1 then return end

    local pos = GetEntityCoords(entity)
    Animals[netId] = {
        netId     = netId,
        species   = tostring(species),
        zoneId    = tostring(zoneId),
        spawnedAt = os.time(),
        weight    = tonumber(weight) or (speciesCfg.weightMin + math.random() * (speciesCfg.weightMax - speciesCfg.weightMin)),
        alive     = true,
        harvested = false,
        shots     = 0,
        shooters  = {},
        lastPos   = { x = pos.x, y = pos.y, z = pos.z },
    }
    if ZoneActivity[zoneId] then
        ZoneActivity[zoneId].count = (ZoneActivity[zoneId].count or 0) + 1
    end
    dlog('registered animal netId=%d species=%s zone=%s', netId, species, zoneId)
end)

-- Position update rate limiting
local PosUpdateRate = {}  -- [source:netId] = last_update_time

-- Update last known position of an animal (from owning client)
RegisterNetEvent('sunset:hunting:updateAnimalPos', function(netId, x, y, z)
    local src = source
    netId = tonumber(netId)
    if not netId then return end
    local animal = Animals[netId]
    if not animal or not animal.alive then return end

    -- Validate: sender has an active hunter session in the animal's zone
    local session = SunsetJobs_GetSession(src)
    if not session or session.jobId ~= 'hunter' then return end
    if tostring(session.data.zoneId) ~= tostring(animal.zoneId) then return end

    -- Rate limit: 1 update per second per animal
    local rateKey = ('%d:%d'):format(src, netId)
    local now = os.time()
    if PosUpdateRate[rateKey] and now - PosUpdateRate[rateKey] < 1 then return end
    PosUpdateRate[rateKey] = now

    -- Anti-teleport: reject if position moved > 50m from last known
    x = tonumber(x) or animal.lastPos.x
    y = tonumber(y) or animal.lastPos.y
    z = tonumber(z) or animal.lastPos.z
    local dx = x - animal.lastPos.x
    local dy = y - animal.lastPos.y
    local dz = z - animal.lastPos.z
    if math.sqrt(dx*dx + dy*dy + dz*dz) > 50.0 then return end

    animal.lastPos = { x = x, y = y, z = z }
end)

-- ── Zone Population Management ────────────────────────────────
-- Triggered when a hunter starts a contract; tells the hunter-client (zone owner)
-- to spawn animals up to cap.
AddEventHandler('sunset:hunting:ensureZonePopulation', function(zoneId)
    local zone = getZone(zoneId)
    if not zone then return end
    local cfg = Sunset.JobsConfig.hunter
    local maxAlive = zone.maxAlive or cfg.animalPopCap or 6

    -- Count alive animals in this zone
    local alive = 0
    for _, a in pairs(Animals) do
        if a.zoneId == zoneId and a.alive then alive = alive + 1 end
    end
    if alive >= maxAlive then return end

    local needed = maxAlive - alive

    -- Find a hunter in this zone to be the spawner (prefer zone contract holder)
    local spawnerSrc = nil
    for _, playerSrc in ipairs(GetPlayers()) do
        local ps = tonumber(playerSrc)
        if ps then
            local sess = SunsetJobs_GetSession(ps)
            if sess and sess.jobId == 'hunter' and sess.data.zoneId == zoneId then
                spawnerSrc = ps
                break
            end
        end
    end
    if not spawnerSrc then return end

    dlog('requesting %d animals in zone %s from client %d', needed, zoneId, spawnerSrc)
    TriggerClientEvent('sunset:hunting:spawnAnimals', spawnerSrc, zoneId, zone, needed, cfg.species)
end)

-- ── Cleanup: session end ──────────────────────────────────────
AddEventHandler('sunset:jobs:sessionEnded', function(src, jobId, state, reason)
    src = tonumber(src) or source
    if jobId ~= 'hunter' then return end
    HunterContracts[src] = nil
end)

-- ── Cleanup: player drop ──────────────────────────────────────
AddEventHandler('playerDropped', function()
    local src = source
    HunterContracts[src] = nil
    RateLimit[src] = nil
end)

-- ── Cleanup: resource stop ────────────────────────────────────
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    -- Delete all managed animal entities
    for netId, animal in pairs(Animals) do
        local ent = NetworkGetEntityFromNetworkId(netId)
        if ent and ent ~= 0 and DoesEntityExist(ent) then
            DeleteEntity(ent)
        end
    end
    Animals = {}
    HunterContracts = {}
    ZoneActivity = {}
    HarvestOwner = {}
end)

-- ── Periodic cleanup of stale animals (no hunters nearby) ────
CreateThread(function()
    while true do
        Wait(60000)
        local now = os.time()
        -- Check which zones have active hunters
        local activeZones = {}
        for _, playerSrc in ipairs(GetPlayers()) do
            local ps = tonumber(playerSrc)
            if ps then
                local sess = SunsetJobs_GetSession(ps)
                if sess and sess.jobId == 'hunter' and sess.data.zoneId then
                    activeZones[sess.data.zoneId] = now
                end
            end
        end
        -- Clean up harvested/dead animals older than 2 minutes
        for netId, animal in pairs(Animals) do
            if (not animal.alive or animal.harvested) and (now - (animal.killedAt or now)) > 120 then
                local ent = NetworkGetEntityFromNetworkId(netId)
                if ent and ent ~= 0 and DoesEntityExist(ent) then
                    DeleteEntity(ent)
                end
                Animals[netId] = nil
                HarvestOwner[netId] = nil
            end
        end
        -- Trigger respawn for active zones with missing population
        for zoneId, _ in pairs(activeZones) do
            TriggerEvent('sunset:hunting:ensureZonePopulation', zoneId)
        end
    end
end)
