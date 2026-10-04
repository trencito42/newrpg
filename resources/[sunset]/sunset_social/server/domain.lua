-- sunset_social — domain rules (single source of truth shared by Lua + panel)
-- Panel API must mirror these limits.

Social = Social or {}

Social.MAX_POST_BODY    = 500
Social.MAX_COMMENT_BODY = 400
Social.ALLOWED_MEDIA_TYPES = { phone_photo = true }

-- Verify the acting character owns an active gallery entry for media_id.
-- Returns: ok (bool), err (string|nil)
function Social.VerifyGalleryOwnership(characterId, mediaId)
    if not characterId or not mediaId then return false, 'missing_params' end
    local row = MySQL.single.await(
        'SELECT pg.id FROM phone_gallery pg JOIN phone_media pm ON pm.id = pg.media_id WHERE pg.character_id = ? AND pg.media_id = ? AND pg.deleted_at IS NULL AND pm.deleted_at IS NULL LIMIT 1',
        { characterId, mediaId }
    )
    if not row then return false, 'media_not_in_gallery' end
    return true
end

-- Build a sanitized post body: trim, strip CR, enforce max length.
function Social.SanitizeBody(raw, maxLen)
    if type(raw) ~= 'string' then return nil end
    local s = raw:match('^%s*(.-)%s*$')  -- trim
    s = s:gsub('\r', '')
    if #s == 0 then return nil end
    if #s > (maxLen or Social.MAX_POST_BODY) then
        s = s:sub(1, maxLen or Social.MAX_POST_BODY)
    end
    return s
end

-- Fetch a post row including soft-delete check.
function Social.GetPost(postId)
    return MySQL.single.await(
        'SELECT id, character_id, body, media_id, created_at, updated_at FROM social_posts WHERE id = ? AND deleted_at IS NULL LIMIT 1',
        { postId }
    )
end

-- Fetch comment row.
function Social.GetComment(commentId)
    return MySQL.single.await(
        'SELECT id, post_id, character_id, parent_comment_id, body, created_at FROM social_comments WHERE id = ? AND deleted_at IS NULL LIMIT 1',
        { commentId }
    )
end

-- Build enriched feed rows with likes/comments counts and liked-by-viewer.
-- viewerCharId may be nil (unauthenticated).
-- Returns array of post tables.
function Social.FetchFeed(opts)
    -- opts: { characterIds (array|nil), beforeId (int|nil), limit (int), viewerCharId (int|nil) }
    local limit     = math.min(tonumber(opts.limit) or 20, 50)
    local beforeId  = tonumber(opts.beforeId)
    local viewerCharId = tonumber(opts.viewerCharId)

    local where = 'p.deleted_at IS NULL'
    local params = {}

    if opts.characterIds and #opts.characterIds > 0 then
        local placeholders = {}
        for _, id in ipairs(opts.characterIds) do
            placeholders[#placeholders + 1] = '?'
            params[#params + 1] = id
        end
        where = where .. ' AND p.character_id IN (' .. table.concat(placeholders, ',') .. ')'
    end

    if beforeId then
        where = where .. ' AND p.id < ?'
        params[#params + 1] = beforeId
    end

    params[#params + 1] = viewerCharId or 0
    params[#params + 1] = limit

    local rows = MySQL.query.await(string.format([[
        SELECT
            p.id,
            p.character_id,
            c.firstname,
            c.lastname,
            p.body,
            p.media_id,
            pm.url AS media_url,
            pm.thumbnail_url,
            pm.width,
            pm.height,
            p.created_at,
            p.updated_at,
            COALESCE(lk.likes_count, 0) AS likes_count,
            COALESCE(cm.comments_count, 0) AS comments_count,
            CASE WHEN vl.post_id IS NOT NULL THEN 1 ELSE 0 END AS liked_by_viewer
        FROM social_posts p
        JOIN characters c ON c.id = p.character_id
        LEFT JOIN phone_media pm ON pm.id = p.media_id AND pm.deleted_at IS NULL
        LEFT JOIN (
            SELECT post_id, COUNT(*) AS likes_count FROM social_post_likes GROUP BY post_id
        ) lk ON lk.post_id = p.id
        LEFT JOIN (
            SELECT post_id, COUNT(*) AS comments_count FROM social_comments WHERE deleted_at IS NULL GROUP BY post_id
        ) cm ON cm.post_id = p.id
        LEFT JOIN social_post_likes vl ON vl.post_id = p.id AND vl.character_id = ?
        WHERE %s
        ORDER BY p.id DESC
        LIMIT ?
    ]], where), params)

    return rows or {}
end

-- Fetch comments for a post (paginated).
function Social.FetchComments(postId, beforeId, limit)
    limit = math.min(tonumber(limit) or 30, 100)
    local extraWhere = ''
    local params = { postId }
    if beforeId then
        extraWhere = ' AND c.id < ?'
        params[#params + 1] = tonumber(beforeId)
    end
    params[#params + 1] = limit

    local rows = MySQL.query.await(string.format([[
        SELECT c.id, c.post_id, c.character_id, ch.firstname, ch.lastname,
               c.parent_comment_id, c.body, c.created_at, c.updated_at
        FROM social_comments c
        JOIN characters ch ON ch.id = c.character_id
        WHERE c.post_id = ? AND c.deleted_at IS NULL%s
        ORDER BY c.id ASC
        LIMIT ?
    ]], extraWhere), params)
    return rows or {}
end

-- Create notification (non-fatal: ignore errors).
function Social.Notify(characterId, actorId, notifType, postId, commentId)
    if not characterId or not actorId or characterId == actorId then return end
    MySQL.insert.await(
        'INSERT INTO social_notifications (character_id, actor_character_id, type, post_id, comment_id) VALUES (?, ?, ?, ?, ?)',
        { characterId, actorId, notifType, postId, commentId or nil }
    )
end

-- Count unread notifications for a character.
function Social.UnreadCount(characterId)
    local row = MySQL.single.await(
        'SELECT COUNT(*) AS cnt FROM social_notifications WHERE character_id = ? AND read_at IS NULL',
        { characterId }
    )
    return row and tonumber(row.cnt) or 0
end

-- Mark all notifications read for a character.
function Social.MarkNotificationsRead(characterId)
    MySQL.update.await(
        'UPDATE social_notifications SET read_at = NOW() WHERE character_id = ? AND read_at IS NULL',
        { characterId }
    )
end
