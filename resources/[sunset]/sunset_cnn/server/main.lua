-- ═══════════════════════════════════════════════════════════════
--  SUNSETMP — SA:MP-Style CNN Advertisement Engine (server/main.lua)
--  Global authoritative queue, auto-publishing, moderation & audit
-- ═══════════════════════════════════════════════════════════════

local AdQueue = {} -- In-memory ordered queue of pending/approved ads
local PlayerCooldowns = {} -- [charId] = timestamp
local AdMutes = {} -- [license] = { expiresAt = ..., reason = ..., by = ... }
local AdMutex = {} -- [adId] = true during atomic operations

local function log(msg)
    print(('[sunset_cnn] %s'):format(msg))
end

local function getDisplayName(src)
    if not src or src == 0 then return 'CONSOLE' end
    local ok, name = pcall(function() return exports.sunset_core:GetPlayerDisplayName(src) end)
    if ok and type(name) == 'string' and name ~= '' then return name end
    local okBase, base = pcall(function() return exports.sunset_core:GetPlayerBaseName(src) end)
    if okBase and type(base) == 'string' and base ~= '' then return base end
    return ('Player %d'):format(src)
end

local function cleanText(value, maxLength)
    if type(value) ~= 'string' then return nil end
    local text = value:gsub('[%z\1-\8\11\12\14-\31\127]', '')
    text = text:match('^%s*(.-)%s*$') or ''
    if text == '' then return nil end
    return text:sub(1, maxLength or Config.CNN.maxLength or 140)
end

-- ═══════════════════════════════════════════════════════════════
--  DATABASE INITIALIZATION & STARTUP RESTORE
-- ═══════════════════════════════════════════════════════════════

local function initDatabase()
    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `cnn_ads` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `character_id` INT NOT NULL,
            `player_name` VARCHAR(64) NOT NULL,
            `phone_number` VARCHAR(32) DEFAULT NULL,
            `text` VARCHAR(255) NOT NULL,
            `status` ENUM('pending', 'approved', 'rejected', 'published', 'cancelled') NOT NULL DEFAULT 'pending',
            `price_paid` INT UNSIGNED NOT NULL DEFAULT 500,
            `submitted_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `scheduled_at` TIMESTAMP NULL DEFAULT NULL,
            `published_at` TIMESTAMP NULL DEFAULT NULL,
            `reviewed_by` VARCHAR(64) DEFAULT NULL,
            `reviewed_at` TIMESTAMP NULL DEFAULT NULL,
            `reject_reason` VARCHAR(255) DEFAULT NULL,
            INDEX `idx_status` (`status`),
            INDEX `idx_character` (`character_id`),
            INDEX `idx_scheduled` (`scheduled_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])

    MySQL.query.await([[
        CREATE TABLE IF NOT EXISTS `cnn_ad_mutes` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `license` VARCHAR(64) NOT NULL,
            `character_id` INT DEFAULT NULL,
            `reason` VARCHAR(255) NOT NULL,
            `banned_by` VARCHAR(64) NOT NULL,
            `expires_at` TIMESTAMP NOT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX `idx_license` (`license`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ]])

    -- Load active ad mutes from database
    local mutes = MySQL.query.await([[
        SELECT * FROM cnn_ad_mutes WHERE expires_at > NOW()
    ]]) or {}
    for _, m in ipairs(mutes) do
        local expUnix = os.time() + math.max(0, math.floor(tonumber(m.expires_diff or 0)))
        AdMutes[m.license] = {
            expiresAt = expUnix,
            reason = m.reason,
            by = m.banned_by,
        }
    end

    -- Restore valid pending / approved ads on restart
    local pending = MySQL.query.await([[
        SELECT * FROM cnn_ads WHERE status IN ('pending', 'approved') ORDER BY id ASC
    ]]) or {}

    AdQueue = {}
    local now = os.time()
    local nextSchedule = now + (Config.CNN.minDelay or 60)

    for _, row in ipairs(pending) do
        local ad = {
            id = tonumber(row.id),
            characterId = tonumber(row.character_id),
            playerName = row.player_name,
            phoneNumber = row.phone_number,
            text = row.text,
            status = row.status,
            pricePaid = tonumber(row.price_paid),
            submittedAt = now,
            scheduledAt = nextSchedule,
            reviewedBy = row.reviewed_by,
            reviewedAt = row.reviewed_at,
            rejectReason = row.reject_reason,
            src = nil,
        }
        AdQueue[#AdQueue + 1] = ad
        nextSchedule = nextSchedule + (Config.CNN.publishInterval or 45)
    end

    log(('Initialized CNN system. Restored %d pending ads and %d active ad mutes.'):format(#AdQueue, #mutes))
end

-- ═══════════════════════════════════════════════════════════════
--  AD MUTE SYSTEM
-- ═══════════════════════════════════════════════════════════════

function IsAdMuted(source)
    local license = Sunset.GetIdentifier(source, 'license')
    if not license or not AdMutes[license] then return false end
    local row = AdMutes[license]
    local now = os.time()
    if now >= row.expiresAt then
        AdMutes[license] = nil
        return false
    end
    local remMin = math.ceil((row.expiresAt - now) / 60)
    return true, remMin, row.reason
end
exports('IsAdMuted', IsAdMuted)

function AdMutePlayer(targetSrc, minutes, reason, adminSrc)
    targetSrc = tonumber(targetSrc)
    minutes = math.max(1, tonumber(minutes) or 15)
    reason = cleanText(reason, 200) or 'Abuz anunturi CNN'
    local adminName = getDisplayName(adminSrc)
    local license = Sunset.GetIdentifier(targetSrc, 'license')
    if not license then return false, 'Player not found or invalid identifier.' end

    local char = exports.sunset_core:GetCharacter(targetSrc)
    local charId = char and char.id or nil
    local expUnix = os.time() + (minutes * 60)

    AdMutes[license] = {
        expiresAt = expUnix,
        reason = reason,
        by = adminName,
    }

    MySQL.query.await([[
        INSERT INTO cnn_ad_mutes (license, character_id, reason, banned_by, expires_at)
        VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))
    ]], { license, charId, reason, adminName, minutes })

    local targetName = getDisplayName(targetSrc)
    TriggerClientEvent('sunset:chat:system', targetSrc,
        ('You have been ad-muted for %d minute(s) by %s. Reason: %s'):format(minutes, adminName, reason), 'error')

    -- Staff broadcast
    local staffMsg = ('[CNN MUTE] %s l-a sanctionat pe %s cu AD-MUTE (%d min). Motiv: %s'):format(
        adminName, targetName, minutes, reason
    )
    for _, id in ipairs(GetPlayers()) do
        local pid = tonumber(id)
        if pid and exports.sunset_admin:IsStaff(pid) then
            TriggerClientEvent('sunset:chat:system', pid, staffMsg, 'warning')
        end
    end

    -- Cancel any pending ads from this character
    if charId then
        for i = #AdQueue, 1, -1 do
            local ad = AdQueue[i]
            if ad.characterId == charId and (ad.status == 'pending' or ad.status == 'approved') then
                ad.status = 'rejected'
                ad.rejectReason = 'Ad Muted: ' .. reason
                ad.reviewedBy = adminName
                MySQL.update.await([[
                    UPDATE cnn_ads SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?
                ]], { ad.rejectReason, adminName, ad.id })
                table.remove(AdQueue, i)
            end
        end
        recalculateQueue()
    end

    return true
end
exports('AdMutePlayer', AdMutePlayer)

-- ═══════════════════════════════════════════════════════════════
--  QUEUE MANAGEMENT & TIMING
-- ═══════════════════════════════════════════════════════════════

function recalculateQueue()
    local now = os.time()
    local minDelay = Config.CNN.minDelay or 60
    local interval = Config.CNN.publishInterval or 45
    local maxCap = Config.CNN.maxQueueDelay or 300
    local nextTime = now + minDelay

    for idx, ad in ipairs(AdQueue) do
        ad.scheduledAt = math.min(nextTime, now + maxCap)
        ad.queuePosition = idx
        nextTime = ad.scheduledAt + interval
        -- Async update in DB
        MySQL.update([[
            UPDATE cnn_ads SET scheduled_at = FROM_UNIXTIME(?) WHERE id = ?
        ]], { ad.scheduledAt, ad.id })
    end
end

local function sendStaffPreview(ad)
    local etaSec = math.max(0, ad.scheduledAt - os.time())
    local etaMin = math.floor(etaSec / 60)
    local etaRemSec = etaSec % 60
    local etaStr = ('%02d:%02d'):format(etaMin, etaRemSec)

    local previewMsg = ('[CNN Preview #%d] %s (%s): "%s" | Publishing in: %s'):format(
        ad.id, ad.playerName, tostring(ad.src or '?'), ad.text, etaStr
    )

    for _, id in ipairs(GetPlayers()) do
        local pid = tonumber(id)
        if pid and exports.sunset_admin:IsStaff(pid) then
            TriggerClientEvent('sunset:chat:message', pid, {
                id = 0,
                name = 'CNN',
                message = previewMsg,
                time = os.date('%H:%M:%S'),
                type = 'staff_chat',
                staffRole = 'CNN PREVIEW',
            })
        end
    end
end

local function publishAd(ad)
    ad.status = 'published'
    local publishedAt = os.date('%Y-%m-%d %H:%M:%S')

    MySQL.update.await([[
        UPDATE cnn_ads SET status = 'published', published_at = NOW() WHERE id = ?
    ]], { ad.id })

    -- Format broadcast message
    local phoneSuffix = ad.phoneNumber and (' (Tel: %s)'):format(ad.phoneNumber) or ''
    local broadcastText = ('%s%s'):format(ad.text, phoneSuffix)

    -- Global Chat Advertisement Broadcast (rendered in green by our chat system)
    for _, id in ipairs(GetPlayers()) do
        local pid = tonumber(id)
        if pid then
            TriggerClientEvent('sunset:chat:message', pid, {
                id = ad.src or 0,
                name = ad.playerName,
                message = broadcastText,
                time = os.date('%H:%M:%S'),
                type = 'ad',
            })
        end
    end

    -- If author is online, notify them
    if ad.src and GetPlayerPing(ad.src) > 0 then
        TriggerClientEvent('sunset:chat:system', ad.src,
            ('Your announcement (#%d) has been published on the server.'):format(ad.id), 'success')
    end

    log(('Published CNN ad #%d by %s: "%s"'):format(ad.id, ad.playerName, ad.text))
end

-- ═══════════════════════════════════════════════════════════════
--  AD MODERATION (ATOMIC)
-- ═══════════════════════════════════════════════════════════════

function ApproveAd(adId, staffSrc)
    adId = tonumber(adId)
    if not adId then return false, 'Invalid Ad ID.' end
    if AdMutex[adId] then return false, 'Action in progress.' end
    AdMutex[adId] = true

    local staffName = getDisplayName(staffSrc)
    local found = nil
    for _, ad in ipairs(AdQueue) do
        if ad.id == adId then
            found = ad
            break
        end
    end

    if not found then
        AdMutex[adId] = nil
        return false, 'This announcement is no longer in the queue.'
    end

    if found.status == 'approved' then
        AdMutex[adId] = nil
        return false, 'This advertisement has already been approved.'
    end

    if found.status == 'rejected' or found.status == 'published' then
        AdMutex[adId] = nil
        return false, 'This advertisement has already been handled.'
    end

    found.status = 'approved'
    found.reviewedBy = staffName
    found.reviewedAt = os.date('%Y-%m-%d %H:%M:%S')

    MySQL.update.await([[
        UPDATE cnn_ads SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?
    ]], { staffName, adId })

    AdMutex[adId] = nil

    if staffSrc and staffSrc ~= 0 then
        TriggerClientEvent('sunset:chat:system', staffSrc,
            ('You approved CNN announcement #%d (%s).'):format(adId, found.playerName), 'success')
    end

    log(('Staff %s approved CNN ad #%d'):format(staffName, adId))
    return true
end
exports('ApproveAd', ApproveAd)

function RejectAd(adId, staffSrc, reason)
    adId = tonumber(adId)
    if not adId then return false, 'Invalid Ad ID.' end
    if AdMutex[adId] then return false, 'Action in progress.' end
    AdMutex[adId] = true

    local staffName = getDisplayName(staffSrc)
    reason = cleanText(reason, 200) or 'Continut neadecvat / Nerespectare regulament'

    local foundIndex = nil
    local found = nil
    for idx, ad in ipairs(AdQueue) do
        if ad.id == adId then
            foundIndex = idx
            found = ad
            break
        end
    end

    if not found then
        AdMutex[adId] = nil
        return false, 'This announcement is no longer in the queue.'
    end

    if found.status == 'rejected' or found.status == 'published' then
        AdMutex[adId] = nil
        return false, 'This advertisement has already been handled.'
    end

    found.status = 'rejected'
    found.rejectReason = reason
    found.reviewedBy = staffName
    found.reviewedAt = os.date('%Y-%m-%d %H:%M:%S')

    table.remove(AdQueue, foundIndex)

    MySQL.update.await([[
        UPDATE cnn_ads SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?
    ]], { reason, staffName, adId })

    AdMutex[adId] = nil

    -- Notify author if online
    if found.src and GetPlayerPing(found.src) > 0 then
        TriggerClientEvent('sunset:chat:system', found.src,
            ('Anunțul tău CNN (#%d) a fost RESPINS de %s. Motiv: %s'):format(adId, staffName, reason), 'error')
    end

    if staffSrc and staffSrc ~= 0 then
        TriggerClientEvent('sunset:chat:system', staffSrc,
            ('You rejected CNN announcement #%d (%s). Reason: %s'):format(adId, found.playerName, reason), 'success')
    end

    recalculateQueue()
    log(('Staff %s rejected CNN ad #%d. Reason: %s'):format(staffName, adId, reason))
    return true
end
exports('RejectAd', RejectAd)

-- ═══════════════════════════════════════════════════════════════
--  TICKER (AUTO-PUBLISH)
-- ═══════════════════════════════════════════════════════════════

CreateThread(function()
    initDatabase()

    while true do
        Wait(1000)
        local now = os.time()
        if #AdQueue > 0 then
            local nextAd = AdQueue[1]
            if nextAd and now >= nextAd.scheduledAt then
                table.remove(AdQueue, 1)
                publishAd(nextAd)
                recalculateQueue()
            end
        end
    end
end)

-- ═══════════════════════════════════════════════════════════════
--  PLAYER AD SUBMISSION
-- ═══════════════════════════════════════════════════════════════

local function isPlayerAtCnn(source)
    local ped = GetPlayerPed(source)
    if not ped or ped == 0 then return false end
    local pCoords = GetEntityCoords(ped)
    for _, loc in ipairs(Config.CNN.locations) do
        local dist = #(pCoords - loc.coords)
        if dist <= (loc.radius or 6.0) then
            return true, loc.name
        end
    end
    return false
end

function SubmitAd(source, text)
    local src = source
    if src == 0 then return false, 'Must be used in-game.' end

    local char = exports.sunset_core:GetCharacter(src)
    if not char then return false, 'Character not loaded.' end

    -- Location check
    local atCnn, locName = isPlayerAtCnn(src)
    if not atCnn then
        return false, 'You must be at a CNN / Weazel News station to place an announcement.'
    end

    -- Mute checks
    local okAdmin, isMuted, mMin, mReason = pcall(function() return exports.sunset_admin:IsMuted(src) end)
    if okAdmin and isMuted then
        return false, ('You are currently muted (%d min). Reason: %s'):format(mMin or 1, mReason or 'Sanctiune')
    end

    local isAdMuted, admMin, admReason = IsAdMuted(src)
    if isAdMuted then
        return false, ('You are currently ad-muted (%d min). Reason: %s'):format(admMin or 1, admReason or 'CNN Sanction')
    end

    -- Queue limit check
    if #AdQueue >= (Config.CNN.maxPendingQueue or 50) then
        return false, 'The CNN announcement queue is currently full. Please try again later.'
    end

    -- Cooldown check
    local now = os.time()
    local lastAd = PlayerCooldowns[char.id] or 0
    local cd = Config.CNN.playerCooldown or 120
    if (now - lastAd) < cd then
        local remCd = cd - (now - lastAd)
        return false, ('You must wait %d more seconds before placing a new announcement.'):format(remCd)
    end

    -- Clean & length check
    local clean = cleanText(text, Config.CNN.maxLength or 140)
    if not clean or #clean < (Config.CNN.minLength or 5) then
        return false, ('Ad text must be between %d and %d characters.'):format(
            Config.CNN.minLength or 5, Config.CNN.maxLength or 140
        )
    end

    -- Price & Money check
    local price = Config.CNN.price or 500
    local cash = tonumber(char.cash) or 0
    local bank = tonumber(char.bank) or 0
    if cash < price and bank < price then
        return false, ('You do not have enough money to pay for the announcement ($%d).'):format(price)
    end

    if cash >= price then
        exports.sunset_core:RemoveMoney(src, 'cash', price, 'CNN Ad Submission')
    else
        exports.sunset_core:RemoveMoney(src, 'bank', price, 'CNN Ad Submission')
    end

    PlayerCooldowns[char.id] = now

    local pName = getDisplayName(src)
    local phone = char.phone_number or char.phone or nil

    -- Compute scheduledAt
    local minDelay = Config.CNN.minDelay or 60
    local interval = Config.CNN.publishInterval or 45
    local maxCap = Config.CNN.maxQueueDelay or 300
    local scheduledAt = now + minDelay

    if #AdQueue > 0 then
        local lastScheduled = AdQueue[#AdQueue].scheduledAt
        scheduledAt = math.max(now + minDelay, lastScheduled + interval)
    end
    scheduledAt = math.min(scheduledAt, now + maxCap)

    -- Insert into DB
    local insertId = MySQL.insert.await([[
        INSERT INTO cnn_ads (character_id, player_name, phone_number, text, status, price_paid, submitted_at, scheduled_at)
        VALUES (?, ?, ?, ?, 'pending', ?, NOW(), FROM_UNIXTIME(?))
    ]], { char.id, pName, phone, clean, price, scheduledAt })

    local adObj = {
        id = tonumber(insertId),
        characterId = char.id,
        playerName = pName,
        phoneNumber = phone,
        text = clean,
        status = 'pending',
        pricePaid = price,
        submittedAt = now,
        scheduledAt = scheduledAt,
        src = src,
        queuePosition = #AdQueue + 1,
    }

    AdQueue[#AdQueue + 1] = adObj
    recalculateQueue()

    local waitSec = math.max(1, adObj.scheduledAt - now)
    TriggerClientEvent('sunset:chat:system', src,
        ('[Info]: You paid $%d. Your announcement (#%d) has been submitted and will be published in approximately %d seconds.'):format(
            price, adObj.id, waitSec
        ), 'info')

    -- Send private staff preview
    sendStaffPreview(adObj)

    log(('Player %s (#%d) submitted CNN ad #%d: "%s" (scheduled in %ds)'):format(
        pName, src, adObj.id, clean, waitSec
    ))

    return true, adObj
end

-- ═══════════════════════════════════════════════════════════════
--  EXPORTS & DATA GETTERS
-- ═══════════════════════════════════════════════════════════════

function GetAdQueue()
    local now = os.time()
    local list = {}
    for idx, ad in ipairs(AdQueue) do
        list[#list + 1] = {
            id = ad.id,
            characterId = ad.characterId,
            playerName = ad.playerName,
            phoneNumber = ad.phoneNumber,
            text = ad.text,
            status = ad.status,
            pricePaid = ad.pricePaid,
            queuePosition = idx,
            remainingSec = math.max(0, ad.scheduledAt - now),
            reviewedBy = ad.reviewedBy,
            rejectReason = ad.rejectReason,
            src = ad.src,
        }
    end
    return list
end
exports('GetAdQueue', GetAdQueue)

function GetPendingAds()
    return GetAdQueue()
end
exports('GetPendingAds', GetPendingAds)

exports.sunset_core:RegisterCallback('sunset:cnn:getQueue', function(source)
    return GetAdQueue()
end)

exports.sunset_core:RegisterCallback('sunset:cnn:getHelpdeskAds', function(source)
    if exports.sunset_admin:GetAdminLevel(source) < 1 and exports.sunset_admin:GetHelperLevel(source) < 1 then
        return nil, 'Staff only.'
    end

    local pending = GetAdQueue()
    local recentPublished = MySQL.query.await([[
        SELECT * FROM cnn_ads WHERE status = 'published' ORDER BY id DESC LIMIT 20
    ]]) or {}
    local recentRejected = MySQL.query.await([[
        SELECT * FROM cnn_ads WHERE status = 'rejected' ORDER BY id DESC LIMIT 20
    ]]) or {}

    return {
        pending = pending,
        published = recentPublished,
        rejected = recentRejected,
    }
end)

exports.sunset_core:RegisterCallback('sunset:cnn:action', function(source, action, adId, extra)
    local isStaff = exports.sunset_admin:IsStaff(source)
    if not isStaff then return false, 'Staff only.' end

    action = tostring(action or '')
    adId = tonumber(adId)

    if action == 'approve' then
        return ApproveAd(adId, source)
    elseif action == 'reject' then
        local reason = extra and extra.reason or 'Continut neadecvat'
        return RejectAd(adId, source, reason)
    elseif action == 'admute' then
        local targetSrc = extra and extra.targetSrc or nil
        local minutes = extra and extra.minutes or 15
        local reason = extra and extra.reason or 'Abuz anunturi CNN'
        return AdMutePlayer(targetSrc, minutes, reason, source)
    end

    return false, 'Unknown CNN action.'
end)

-- ═══════════════════════════════════════════════════════════════
--  COMMANDS
-- ═══════════════════════════════════════════════════════════════

-- /ad [text] — Player submit ad at CNN
RegisterCommand('ad', function(source, args)
    if source == 0 then return end
    local text = table.concat(args, ' ')
    if text == '' then
        TriggerClientEvent('sunset:chat:system', source, 'Usage: /ad [textul anuntului]', 'warning')
        return
    end
    local ok, err = SubmitAd(source, text)
    if not ok then
        TriggerClientEvent('sunset:chat:system', source, err or 'Eroare la trimiterea anuntului.', 'error')
    end
end, false)

-- /myad — Player check their active queued ad
RegisterCommand('myad', function(source, args)
    if source == 0 then return end
    local char = exports.sunset_core:GetCharacter(source)
    if not char then return end

    local now = os.time()
    local found = nil
    for idx, ad in ipairs(AdQueue) do
        if ad.characterId == char.id and (ad.status == 'pending' or ad.status == 'approved') then
            found = { ad = ad, pos = idx }
            break
        end
    end

    if not found then
        TriggerClientEvent('sunset:chat:system', source, 'You have no active announcement in the CNN queue.', 'info')
        return
    end

    local remSec = math.max(0, found.ad.scheduledAt - now)
    local min = math.floor(remSec / 60)
    local sec = remSec % 60
    TriggerClientEvent('sunset:chat:system', source,
        ('[CNN] Anunțul tău (#%d): Status: %s | Poziție în coadă: %d | Timp estimat: %02d:%02d'):format(
            found.ad.id, string.upper(found.ad.status), found.pos, min, sec
        ), 'info')
end, false)

-- /ads /adlist — Staff view pending ads
local function listAdsCommand(source)
    if source ~= 0 and not exports.sunset_admin:IsStaff(source) then
        TriggerClientEvent('sunset:chat:system', source, 'This command is available only for staff.', 'error')
        return
    end

    if #AdQueue == 0 then
        if source == 0 then print('[CNN] No pending ads.') else TriggerClientEvent('sunset:chat:system', source, '[CNN] No announcements waiting.', 'info') end
        return
    end

    local now = os.time()
    if source == 0 then
        print(('[CNN] %d ads in queue:'):format(#AdQueue))
        for idx, ad in ipairs(AdQueue) do
            local rem = math.max(0, ad.scheduledAt - now)
            print(('  #%d | ID %d | %s: "%s" | [%s] in %ds'):format(idx, ad.id, ad.playerName, ad.text, ad.status, rem))
        end
    else
        TriggerClientEvent('sunset:chat:system', source, ('[CNN Queue] %d pending announcement(s):'):format(#AdQueue), 'info')
        for idx, ad in ipairs(AdQueue) do
            local rem = math.max(0, ad.scheduledAt - now)
            local min = math.floor(rem / 60)
            local sec = rem % 60
            TriggerClientEvent('sunset:chat:system', source,
                ('  [#%d] ID: %d | %s (#%s) [%s]: "%s" (Publishing in %02d:%02d)'):format(
                    idx, ad.id, ad.playerName, tostring(ad.src or '?'), string.upper(ad.status), ad.text, min, sec
                ), 'info')
        end
    end
end

RegisterCommand('ads', function(source, args) listAdsCommand(source) end, false)
RegisterCommand('adlist', function(source, args) listAdsCommand(source) end, false)

-- /acceptad [id] / /aad [id]
local function acceptAdCommand(source, args)
    if source ~= 0 and not exports.sunset_admin:IsStaff(source) then
        TriggerClientEvent('sunset:chat:system', source, 'This command is available only for staff.', 'error')
        return
    end
    local adId = tonumber(args[1])
    if not adId then
        if source == 0 then print('Usage: /acceptad [adId]') else TriggerClientEvent('sunset:chat:system', source, 'Usage: /acceptad [adId] (sau /aad [adId])', 'warning') end
        return
    end
    local ok, err = ApproveAd(adId, source)
    if not ok then
        if source == 0 then print(err) else TriggerClientEvent('sunset:chat:system', source, err, 'error') end
    end
end

RegisterCommand('acceptad', function(source, args) acceptAdCommand(source, args) end, false)
RegisterCommand('aad', function(source, args) acceptAdCommand(source, args) end, false)

-- /deletead [id] / /dad [id] / /rejectad [id] [reason]
local function deleteAdCommand(source, args)
    if source ~= 0 and not exports.sunset_admin:IsStaff(source) then
        TriggerClientEvent('sunset:chat:system', source, 'This command is available only for staff.', 'error')
        return
    end
    local adId = tonumber(args[1])
    if not adId then
        if source == 0 then print('Usage: /deletead [adId] [reason]') else TriggerClientEvent('sunset:chat:system', source, 'Usage: /deletead [adId] [motiv] (sau /dad, /rejectad)', 'warning') end
        return
    end
    local reason = table.concat(args, ' ', 2)
    if reason == '' then reason = 'Continut neadecvat' end
    local ok, err = RejectAd(adId, source, reason)
    if not ok then
        if source == 0 then print(err) else TriggerClientEvent('sunset:chat:system', source, err, 'error') end
    end
end

RegisterCommand('deletead', function(source, args) deleteAdCommand(source, args) end, false)
RegisterCommand('dad', function(source, args) deleteAdCommand(source, args) end, false)
RegisterCommand('rejectad', function(source, args) deleteAdCommand(source, args) end, false)

-- /admute [id] [minutes] [reason]
RegisterCommand('admute', function(source, args)
    if source ~= 0 and not exports.sunset_admin:IsStaff(source) then
        TriggerClientEvent('sunset:chat:system', source, 'This command is available only for staff.', 'error')
        return
    end
    local targetId = tonumber(args[1])
    local minutes = tonumber(args[2]) or 15
    local reason = table.concat(args, ' ', 3)
    if not targetId or reason == '' then
        if source == 0 then
            print('Usage: /admute [playerId] [minutes] [reason]')
        else
            TriggerClientEvent('sunset:chat:system', source, 'Usage: /admute [player ID] [minute] [motiv]', 'warning')
        end
        return
    end
    local ok, err = AdMutePlayer(targetId, minutes, reason, source)
    if not ok then
        if source == 0 then print(err) else TriggerClientEvent('sunset:chat:system', source, err, 'error') end
    end
end, false)

function RunChatCommand(source, name, args)
    if source == 0 then return false end
    name = string.lower(tostring(name or ''))
    args = args or {}
    if name == 'ad' then
        local text = table.concat(args, ' ')
        if text == '' then
            TriggerClientEvent('sunset:chat:system', source, 'Usage: /ad [textul anuntului]', 'warning')
            return true
        end
        local ok, err = SubmitAd(source, text)
        if not ok then
            TriggerClientEvent('sunset:chat:system', source, err or 'Eroare la trimiterea anuntului.', 'error')
        end
        return true
    end
    if name == 'myad' then
        ExecuteCommand('myad')
        return true
    end
    if name == 'ads' or name == 'adlist' then
        listAdsCommand(source)
        return true
    end
    if name == 'acceptad' or name == 'aad' then
        acceptAdCommand(source, args)
        return true
    end
    if name == 'deletead' or name == 'dad' or name == 'rejectad' then
        deleteAdCommand(source, args)
        return true
    end
    if name == 'admute' then
        local targetId = tonumber(args[1])
        local minutes = tonumber(args[2]) or 15
        local reason = table.concat(args, ' ', 3)
        if not targetId or reason == '' then
            TriggerClientEvent('sunset:chat:system', source, 'Usage: /admute [player ID] [minute] [motiv]', 'warning')
            return true
        end
        local ok, err = AdMutePlayer(targetId, minutes, reason, source)
        if not ok then
            TriggerClientEvent('sunset:chat:system', source, err, 'error')
        end
        return true
    end
    return false
end
exports('RunChatCommand', RunChatCommand)
