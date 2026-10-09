-- sunset_social — server callbacks for FiveM phone integration

local function getChar(source)
    return exports.sunset_core:GetCharacter(source)
end

local function rateLimit(source, key, ms)
    return exports.sunset_core:RateLimit(source, key, ms)
end

-- =========================================================
-- social:getFeed
-- opts: { feed = 'global'|'contacts', beforeId, limit }
-- Returns: { posts = [...], nextCursor }
-- =========================================================
exports.sunset_core:RegisterCallback('social:getFeed', function(source, opts)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    opts = opts or {}
    local feedType = tostring(opts.feed or 'global')
    local beforeId = tonumber(opts.beforeId)
    local limit    = math.min(tonumber(opts.limit) or 20, 30)

    local charIds = nil
    if feedType == 'contacts' then
        local rows = MySQL.query.await(
            'SELECT contact_character_id FROM phone_contacts WHERE character_id = ? AND contact_character_id IS NOT NULL',
            { char.id }
        )
        charIds = {}
        for _, r in ipairs(rows or {}) do
            charIds[#charIds + 1] = r.contact_character_id
        end
        if #charIds == 0 then
            return { posts = {}, nextCursor = nil }
        end
    end

    local posts = Social.FetchFeed({
        characterIds  = charIds,
        beforeId      = beforeId,
        limit         = limit,
        viewerCharId  = char.id,
    })

    local nextCursor = nil
    if #posts == limit then
        nextCursor = posts[#posts].id
    end

    return { posts = posts, nextCursor = nextCursor }
end)

-- =========================================================
-- social:getPost
-- postId
-- Returns: { post, comments }
-- =========================================================
exports.sunset_core:RegisterCallback('social:getPost', function(source, postId)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    postId = tonumber(postId)
    if not postId then return nil, { code = 'invalid_params' } end

    local post = Social.FetchPostById(char.id, postId)
    if not post then return nil, { code = 'not_found' } end

    local comments = Social.FetchComments(postId, nil, 30)

    return { post = post, comments = comments }
end)

-- =========================================================
-- social:createPost
-- body (string|nil), mediaId (int|nil)
-- =========================================================
exports.sunset_core:RegisterCallback('social:createPost', function(source, body, mediaId)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    if not rateLimit(source, 'social:createPost', 5000) then
        return nil, { localeKey = 'phone.ui.action_failed' }
    end

    local cleanBody = Social.SanitizeBody(body, Social.MAX_POST_BODY)
    mediaId = tonumber(mediaId)

    if not cleanBody and not mediaId then
        return nil, { code = 'empty_post' }
    end

    if mediaId then
        local ok, err = Social.VerifyGalleryOwnership(char.id, mediaId)
        if not ok then return nil, { code = err } end
    end

    local postId = MySQL.insert.await(
        'INSERT INTO social_posts (character_id, body, media_id) VALUES (?, ?, ?)',
        { char.id, cleanBody, mediaId }
    )
    if not postId then return nil, { code = 'db_error' } end

    TriggerClientEvent('social:postCreated', -1, {
        postId      = postId,
        characterId = char.id,
        authorName  = (char.firstname or '') .. ' ' .. (char.lastname or ''),
    })

    return { ok = true, postId = postId }
end)

-- =========================================================
-- social:likePost / social:unlikePost
-- =========================================================
exports.sunset_core:RegisterCallback('social:likePost', function(source, postId)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    if not rateLimit(source, 'social:like', 300) then
        return nil, { localeKey = 'phone.ui.action_failed' }
    end

    postId = tonumber(postId)
    if not postId then return nil, { code = 'invalid_params' } end

    local post = Social.GetPost(postId)
    if not post then return nil, { code = 'not_found' } end

    MySQL.insert.await(
        'INSERT IGNORE INTO social_post_likes (post_id, character_id) VALUES (?, ?)',
        { postId, char.id }
    )

    if post.character_id ~= char.id then
        Social.Notify(post.character_id, char.id, 'like', postId, nil)
    end

    local lk = MySQL.single.await('SELECT COUNT(*) AS cnt FROM social_post_likes WHERE post_id = ?', { postId })
    local count = lk and tonumber(lk.cnt) or 0

    TriggerClientEvent('social:postEngagement', -1, { postId = postId, likesCount = count })

    return { ok = true, likesCount = count, likedByViewer = true }
end)

exports.sunset_core:RegisterCallback('social:unlikePost', function(source, postId)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    if not rateLimit(source, 'social:like', 300) then
        return nil, { localeKey = 'phone.ui.action_failed' }
    end

    postId = tonumber(postId)
    if not postId then return nil, { code = 'invalid_params' } end

    MySQL.update.await(
        'DELETE FROM social_post_likes WHERE post_id = ? AND character_id = ?',
        { postId, char.id }
    )

    local lk = MySQL.single.await('SELECT COUNT(*) AS cnt FROM social_post_likes WHERE post_id = ?', { postId })
    local count = lk and tonumber(lk.cnt) or 0

    TriggerClientEvent('social:postEngagement', -1, { postId = postId, likesCount = count })

    return { ok = true, likesCount = count, likedByViewer = false }
end)

-- =========================================================
-- social:addComment
-- postId, body, parentCommentId (optional)
-- =========================================================
exports.sunset_core:RegisterCallback('social:addComment', function(source, postId, body, parentCommentId)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    if not rateLimit(source, 'social:comment', 2000) then
        return nil, { localeKey = 'phone.ui.action_failed' }
    end

    postId = tonumber(postId)
    if not postId then return nil, { code = 'invalid_params' } end

    local post = Social.GetPost(postId)
    if not post then return nil, { code = 'not_found' } end

    local cleanBody = Social.SanitizeBody(body, Social.MAX_COMMENT_BODY)
    if not cleanBody then return nil, { code = 'empty_comment' } end

    parentCommentId = tonumber(parentCommentId)
    if parentCommentId then
        local parent = Social.GetComment(parentCommentId)
        if not parent or parent.post_id ~= postId then
            return nil, { code = 'invalid_parent' }
        end
        -- flatten: if replying to a reply, use root comment as parent
        parentCommentId = parent.parent_comment_id and parent.parent_comment_id or parent.id
    end

    local commentId = MySQL.insert.await(
        'INSERT INTO social_comments (post_id, character_id, parent_comment_id, body) VALUES (?, ?, ?, ?)',
        { postId, char.id, parentCommentId, cleanBody }
    )
    if not commentId then return nil, { code = 'db_error' } end

    -- Notify post author
    if post.character_id ~= char.id then
        Social.Notify(post.character_id, char.id, 'comment', postId, commentId)
    end
    -- Notify parent comment author if replying
    if parentCommentId then
        local parent = Social.GetComment(parentCommentId)
        if parent and parent.character_id ~= char.id and parent.character_id ~= post.character_id then
            Social.Notify(parent.character_id, char.id, 'reply', postId, commentId)
        end
    end

    local cm = MySQL.single.await('SELECT COUNT(*) AS cnt FROM social_comments WHERE post_id = ? AND deleted_at IS NULL', { postId })
    local commentsCount = cm and tonumber(cm.cnt) or 0

    TriggerClientEvent('social:postEngagement', -1, { postId = postId, commentsCount = commentsCount })

    local comment = Social.EnrichCommentAuthor({
        id = commentId,
        post_id = postId,
        character_id = char.id,
        firstname = char.firstname,
        lastname = char.lastname,
        parent_comment_id = parentCommentId,
        body = cleanBody,
        created_at = os.date('%Y-%m-%d %H:%M:%S'),
    }, char.id)

    return {
        ok = true,
        commentId = commentId,
        commentsCount = commentsCount,
        comment = comment,
    }
end)

-- =========================================================
-- social:deletePost
-- =========================================================
exports.sunset_core:RegisterCallback('social:deletePost', function(source, postId)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    postId = tonumber(postId)
    if not postId then return nil, { code = 'invalid_params' } end

    local post = Social.GetPost(postId)
    if not post then return nil, { code = 'not_found' } end

    if post.character_id ~= char.id then
        return nil, { code = 'forbidden' }
    end

    MySQL.update.await(
        'UPDATE social_posts SET deleted_at = NOW() WHERE id = ? AND character_id = ?',
        { postId, char.id }
    )

    return { ok = true }
end)

-- =========================================================
-- social:deleteComment
-- =========================================================
exports.sunset_core:RegisterCallback('social:deleteComment', function(source, commentId)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    commentId = tonumber(commentId)
    if not commentId then return nil, { code = 'invalid_params' } end

    local comment = Social.GetComment(commentId)
    if not comment then return nil, { code = 'not_found' } end

    if comment.character_id ~= char.id then
        return nil, { code = 'forbidden' }
    end

    MySQL.update.await(
        'UPDATE social_comments SET deleted_at = NOW() WHERE id = ? AND character_id = ?',
        { commentId, char.id }
    )

    return { ok = true }
end)

-- =========================================================
-- social:getActivity
-- Returns notifications for the acting character.
-- =========================================================
exports.sunset_core:RegisterCallback('social:getActivity', function(source)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    local rows = MySQL.query.await([[
        SELECT n.id, n.type, n.post_id, n.comment_id, n.created_at, n.read_at,
               ch.firstname, ch.lastname
        FROM social_notifications n
        JOIN characters ch ON ch.id = n.actor_character_id
        WHERE n.character_id = ?
        ORDER BY n.id DESC
        LIMIT 50
    ]], { char.id })

    Social.MarkNotificationsRead(char.id)

    return { notifications = rows or {}, unread = 0 }
end)

-- =========================================================
-- social:getProfile
-- characterId
-- =========================================================
exports.sunset_core:RegisterCallback('social:getProfile', function(source, targetCharId)
    local char = getChar(source)
    if not char then return nil, { localeKey = 'phone.message.no_character_loaded' } end

    targetCharId = tonumber(targetCharId)
    if not targetCharId then return nil, { code = 'invalid_params' } end

    local profile = MySQL.single.await([[
        SELECT c.id, c.firstname, c.lastname,
               JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.faction')) AS faction_id,
               JSON_UNQUOTE(JSON_EXTRACT(c.metadata, '$.skin')) AS author_skin,
               cl.tag AS clan_tag, cl.tag_color AS clan_color, cl.tag_style AS clan_tag_style
        FROM characters c
        LEFT JOIN clan_members clanm ON clanm.character_id = c.id
        LEFT JOIN clans cl ON cl.id = clanm.clan_id
        WHERE c.id = ?
        LIMIT 1
    ]], { targetCharId })
    if not profile then return nil, { code = 'not_found' } end

    local countRow = MySQL.single.await(
        'SELECT COUNT(*) AS cnt FROM social_posts WHERE character_id = ? AND deleted_at IS NULL',
        { targetCharId }
    )
    local postCount = countRow and tonumber(countRow.cnt) or 0

    local posts = Social.FetchFeed({
        characterIds = { targetCharId },
        limit        = 10,
        viewerCharId = char.id,
    })

    return {
        profile = {
            characterId = profile.id,
            name        = (profile.firstname or '') .. ' ' .. (profile.lastname or ''),
            postCount   = postCount,
            faction_id  = profile.faction_id,
            author_skin = profile.author_skin,
            clan_tag    = profile.clan_tag,
            clan_color  = profile.clan_color,
            clan_tag_style = profile.clan_tag_style,
        },
        posts = posts,
    }
end)

-- =========================================================
-- social:getUnreadCount
-- =========================================================
exports.sunset_core:RegisterCallback('social:getUnreadCount', function(source)
    local char = getChar(source)
    if not char then return { count = 0 } end
    return { count = Social.UnreadCount(char.id) }
end)
