-- Phone gallery and message media. Bytes stay on the media host.
-- A gallery delete hides the owner's copy. Messages keep the same row.

local PAGE = 30

local function charOf(source)
    return exports.sunset_core:GetCharacter(source)
end

local function cleanLabel(value, limit)
    value = tostring(value or ''):gsub('[%c]', ''):gsub('[<>]', '')
    return value:sub(1, limit or 80)
end

local function allowedMediaUrl(url)
    url = tostring(url or '')
    if #url < 12 or #url > 512 then return nil end
    if url:find('[%c%s]') or url:find('%.%.') then return nil end
    local lower = url:lower()
    if lower:find('javascript:', 1, true) or lower:find('data:', 1, true) then return nil end
    local base = (Config and Config.MediaBaseUrl) or 'https://racket.cat/media/'
    if lower:sub(1, #base) ~= base:lower() and not lower:find('^https://racket%.cat/api/media/', 1) then
        if not lower:find('^https://racket%.cat/media/', 1) then return nil end
    end
    if not lower:find('^https://racket%.cat/', 1) then return nil end
    return url
end

local function photoLimit()
    local cfg = Config and Config.PhoneMedia
    return (cfg and tonumber(cfg.MaxPhotosPerCharacter)) or 250
end

local function galleryCount(characterId)
    return tonumber(MySQL.scalar.await([[
        SELECT COUNT(*) FROM phone_gallery
        WHERE character_id = ? AND deleted_at IS NULL
    ]], { characterId })) or 0
end

local function canReadMedia(characterId, mediaId)
    local row = MySQL.single.await([[
        SELECT id, character_id, media_type, url, thumbnail_url, deleted_at
        FROM phone_media WHERE id = ? LIMIT 1
    ]], { mediaId })
    if not row or row.media_type ~= 'phone_photo' then return nil end
    if tonumber(row.character_id) == characterId then return row end
    local shared = MySQL.scalar.await([[
        SELECT 1 FROM phone_gallery
        WHERE character_id = ? AND media_id = ? AND deleted_at IS NULL
        LIMIT 1
    ]], { characterId, mediaId })
    if shared then return row end
    local mailed = MySQL.scalar.await([[
        SELECT 1 FROM phone_messages
        WHERE attachment_type = 'photo' AND attachment_id = ?
          AND (sender_character_id = ? OR receiver_character_id = ?)
        LIMIT 1
    ]], { mediaId, characterId, characterId })
    if mailed then return row end
    return nil
end

local function publicPhoto(row)
    local url = allowedMediaUrl(row.url)
    if not url then return nil end
    local thumb = allowedMediaUrl(row.thumbnail_url) or url
    return {
        type = 'photo',
        id = tonumber(row.id),
        url = url,
        thumbnailUrl = thumb,
        createdAt = row.created_at,
    }
end

exports.sunset_core:RegisterCallback('sunset:phoneMediaToken', function(source)
    local char = charOf(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    if GetResourceState('sunset_profile_media') ~= 'started' then
        return nil, { localeKey = 'phone.message.photo_upload_failed' }
    end
    if not exports.sunset_core:RateLimit(source, 'phoneMediaToken', 1200) then
        return nil, { localeKey = 'error.too_many_requests' }
    end
    if galleryCount(tonumber(char.id)) >= photoLimit() then
        return nil, { localeKey = 'phone.message.gallery_full' }
    end
    local issued, err = exports.sunset_profile_media:IssueUploadToken(source, 'phone_photo')
    if not issued then
        if err == 'cooldown' then return nil, { localeKey = 'error.too_many_requests' } end
        return nil, { localeKey = 'phone.message.photo_upload_failed' }
    end
    return issued
end)

exports.sunset_core:RegisterCallback('sunset:phoneMediaCommit', function(source, token, url, mime, fileSize)
    local char = charOf(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    if GetResourceState('sunset_profile_media') ~= 'started' then
        return nil, { localeKey = 'phone.message.photo_upload_failed' }
    end
    local consumed = exports.sunset_profile_media:ConsumeUploadToken(source, token, 'phone_photo')
    if not consumed then return nil, { localeKey = 'phone.message.photo_upload_failed' } end
    url = allowedMediaUrl(url)
    if not url then return nil, { localeKey = 'phone.message.photo_upload_failed' } end
    mime = tostring(mime or 'image/jpeg'):sub(1, 64)
    if mime ~= 'image/jpeg' and mime ~= 'image/webp' and mime ~= 'image/png' then
        return nil, { localeKey = 'phone.message.photo_upload_failed' }
    end
    fileSize = tonumber(fileSize)
    local maxBytes = (Config.PhoneMedia and Config.PhoneMedia.MaxUploadBytes) or 1800000
    if fileSize and (fileSize < 1 or fileSize > maxBytes) then
        return nil, { localeKey = 'phone.message.photo_upload_failed' }
    end
    local characterId = tonumber(char.id)
    if galleryCount(characterId) >= photoLimit() then
        return nil, { localeKey = 'phone.message.gallery_full' }
    end
    local mediaId = MySQL.insert.await([[
        INSERT INTO phone_media (character_id, media_type, url, thumbnail_url, mime_type, file_size)
        VALUES (?, 'phone_photo', ?, ?, ?, ?)
    ]], { characterId, url, url, mime, fileSize })
    MySQL.insert.await([[
        INSERT INTO phone_gallery (character_id, media_id) VALUES (?, ?)
    ]], { characterId, mediaId })
    return { ok = true, media = publicPhoto({ id = mediaId, url = url, thumbnail_url = url, created_at = os.date('!%Y-%m-%dT%H:%M:%SZ') }) }
end)

exports.sunset_core:RegisterCallback('sunset:phoneGallery', function(source, cursor)
    local char = charOf(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    cursor = tonumber(cursor) or 0
    local rows = MySQL.query.await([[
        SELECT g.id AS gallery_id, m.id, m.url, m.thumbnail_url, m.created_at
        FROM phone_gallery g
        JOIN phone_media m ON m.id = g.media_id
        WHERE g.character_id = ? AND g.deleted_at IS NULL
          AND (? = 0 OR g.id < ?)
        ORDER BY g.id DESC
        LIMIT ?
    ]], { tonumber(char.id), cursor, cursor, PAGE }) or {}
    local photos = {}
    for _, row in ipairs(rows) do
        local photo = publicPhoto(row)
        if photo then
            photo.galleryId = tonumber(row.gallery_id)
            photos[#photos + 1] = photo
        end
    end
    local nextCursor = nil
    if #rows >= PAGE then nextCursor = tonumber(rows[#rows].gallery_id) end
    return { photos = photos, nextCursor = nextCursor }
end)

exports.sunset_core:RegisterCallback('sunset:phoneGalleryDelete', function(source, mediaId)
    local char = charOf(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    mediaId = tonumber(mediaId)
    if not mediaId then return nil, { localeKey = 'phone.message.photo_upload_failed' } end
    local changed = MySQL.update.await([[
        UPDATE phone_gallery SET deleted_at = CURRENT_TIMESTAMP
        WHERE character_id = ? AND media_id = ? AND deleted_at IS NULL
    ]], { tonumber(char.id), mediaId })
    if (tonumber(changed) or 0) < 1 then return nil, { localeKey = 'phone.message.photo_upload_failed' } end
    return { ok = true }
end)

exports.sunset_core:RegisterCallback('sunset:phoneGallerySave', function(source, mediaId)
    local char = charOf(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end
    if not exports.sunset_core:RateLimit(source, 'phoneGallerySave', 600) then
        return nil, { localeKey = 'error.too_many_requests' }
    end
    mediaId = tonumber(mediaId)
    local characterId = tonumber(char.id)
    local row = canReadMedia(characterId, mediaId or -1)
    if not row then return nil, { localeKey = 'phone.message.photo_upload_failed' } end
    if galleryCount(characterId) >= photoLimit() then
        return nil, { localeKey = 'phone.message.gallery_full' }
    end
    MySQL.update.await([[
        INSERT INTO phone_gallery (character_id, media_id) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE deleted_at = NULL
    ]], { characterId, mediaId })
    return { ok = true, media = publicPhoto(row) }
end)

local function resolvePhotoAttachment(source, characterId, attachment)
    local mediaId = tonumber(attachment.mediaId)
    if not mediaId then return nil, { localeKey = 'phone.message.photo_upload_failed' } end
    if not exports.sunset_core:RateLimit(source, 'phonePhotoSend', 700) then
        return nil, { localeKey = 'error.too_many_requests' }
    end
    local row = canReadMedia(characterId, mediaId)
    if not row or not allowedMediaUrl(row.url) then
        return nil, { localeKey = 'phone.message.photo_upload_failed' }
    end
    return {
        type = 'photo',
        id = mediaId,
        snapshot = nil,
        public = publicPhoto(row),
    }
end

local function finiteCoord(value)
    local n = tonumber(value)
    if not n or n ~= n or n == math.huge or n == -math.huge then return nil end
    if n < -8000 or n > 8000 then return nil end
    return n + 0.0
end

local function resolveLocationAttachment(source, attachment)
    local mode = attachment.mode == 'waypoint' and 'waypoint' or 'current'
    local x, y
    if mode == 'current' then
        local ped = GetPlayerPed(source)
        if not ped or ped == 0 then return nil, { localeKey = 'phone.message.location_unavailable' } end
        local coords = GetEntityCoords(ped)
        x = finiteCoord(coords.x or coords[1])
        y = finiteCoord(coords.y or coords[2])
    else
        x = finiteCoord(attachment.x)
        y = finiteCoord(attachment.y)
    end
    if not x or not y then return nil, { localeKey = 'phone.message.location_unavailable' } end
    local snap = {
        mode = mode,
        label = cleanLabel(attachment.street or attachment.label, 80),
        area = cleanLabel(attachment.zone or attachment.area, 80),
        x = x,
        y = y,
    }
    if snap.label == '' then snap.label = snap.area ~= '' and snap.area or 'Location' end
    snap.type = 'location'
    return { type = 'location', id = nil, snapshot = json.encode(snap), public = snap }
end

function PhoneResolveAttachment(source, characterId, attachment)
    if type(attachment) ~= 'table' then return nil end
    if attachment.type == 'photo' then return resolvePhotoAttachment(source, characterId, attachment) end
    if attachment.type == 'location' then return resolveLocationAttachment(source, attachment) end
    return nil, { localeKey = 'phone.message.photo_upload_failed' }
end

function PhonePublicAttachment(row)
    if type(row) ~= 'table' or not row.attachment_type then return nil end
    if row.attachment_type == 'photo' then
        return publicPhoto({
            id = row.attachment_id,
            url = row.media_url,
            thumbnail_url = row.media_thumb,
            created_at = row.created_at,
        })
    end
    if row.attachment_type == 'location' then
        local snap = row.attachment_snapshot
        if type(snap) == 'string' and snap ~= '' then
            local ok, decoded = pcall(json.decode, snap)
            snap = ok and decoded or nil
        end
        if type(snap) ~= 'table' then return nil end
        local x, y = finiteCoord(snap.x), finiteCoord(snap.y)
        if not x or not y then return nil end
        return {
            type = 'location',
            label = cleanLabel(snap.label, 80),
            area = cleanLabel(snap.area, 80),
            x = x,
            y = y,
        }
    end
    return nil
end
