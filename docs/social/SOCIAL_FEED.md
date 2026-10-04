# RACKET Social Feed

## Domain Ownership

`sunset_social` owns all social network business logic:
- Tables: `social_posts`, `social_post_likes`, `social_comments`, `social_notifications`
- Lua business rules: `resources/[sunset]/sunset_social/server/domain.lua`
- FiveM callbacks: `resources/[sunset]/sunset_social/server/main.lua`

`sunset_phone` integrates the Feed as a phone app UI (client + server bridge).

The panel reads/writes the same tables directly via `panel/src/app/api/feed/`.

---

## Tables

### social_posts
```sql
id           BIGINT UNSIGNED PK AUTO_INCREMENT
character_id INT UNSIGNED NOT NULL
body         VARCHAR(500) NULL
media_id     INT UNSIGNED NULL  -- references phone_media.id
created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at   TIMESTAMP NULL
deleted_at   TIMESTAMP NULL     -- soft delete
```

### social_post_likes
```sql
post_id      BIGINT UNSIGNED NOT NULL
character_id INT UNSIGNED NOT NULL
created_at   TIMESTAMP
PRIMARY KEY (post_id, character_id)  -- duplicate-safe
```

### social_comments
```sql
id                BIGINT UNSIGNED PK
post_id           BIGINT UNSIGNED NOT NULL
character_id      INT UNSIGNED NOT NULL
parent_comment_id BIGINT UNSIGNED NULL   -- one level of threading
body              VARCHAR(400) NOT NULL
created_at / updated_at / deleted_at
```

### social_notifications
```sql
id                BIGINT UNSIGNED PK
character_id      INT UNSIGNED NOT NULL  -- recipient
actor_character_id INT UNSIGNED NOT NULL -- who did it
type              ENUM('like','comment','reply')
post_id           BIGINT UNSIGNED NOT NULL
comment_id        BIGINT UNSIGNED NULL
created_at        TIMESTAMP
read_at           TIMESTAMP NULL
```

---

## Identity Model

Social identity is **character-based**, not account-based.

- In FiveM: author derived from `source` → `exports.sunset_core:GetCharacter(source)`
- In panel: acting identity is `session.selectedCharacterId` — never trusted from request body

---

## Content Limits

| Field   | Limit   |
|---------|---------|
| post body   | 500 chars |
| comment     | 400 chars |
| media type  | `phone_photo` only |
| posts per page | 20–30 |
| comments per page | 30 |

These are enforced in `domain.lua` (Lua) and the panel API routes (TypeScript). Both must match.

---

## Contacts Feed Semantics

```sql
-- Posts visible in Contacts feed for viewer character X:
SELECT * FROM social_posts
WHERE character_id IN (
    SELECT contact_character_id FROM phone_contacts
    WHERE character_id = X AND contact_character_id IS NOT NULL
)
AND deleted_at IS NULL
```

This is **one-way**: saving someone as a contact gives you their posts. They do not need to save you back.

---

## Global Feed

All non-deleted posts, ordered by `id DESC`. Cursor-paginated using `beforeId` (not OFFSET).

---

## Gallery Privacy Boundary

- Gallery (`phone_gallery`): **private** to the owning character
- Media served through a post (`social_posts.media_id`): **public** (post is public)

When creating a photo post, the server verifies:
```sql
SELECT pg.id FROM phone_gallery pg
JOIN phone_media pm ON pm.id = pg.media_id
WHERE pg.character_id = ? AND pg.media_id = ?
  AND pg.deleted_at IS NULL AND pm.deleted_at IS NULL
```

The Gallery index itself is never made public.

---

## Media Reference Lifetime

A `phone_media` binary is safe to GC only when:
- No active `phone_gallery` references
- No `phone_messages` references (via `attachment_id`)
- No `social_posts` references (`social_posts.media_id`)

Deleting a social post does NOT delete the underlying media or gallery entry.

---

## Panel/Game Sync

One MySQL source of truth. No duplicated tables.

- Post created in game → visible on panel on next fetch
- Post created on panel → visible in game on next feed poll (~12 seconds while Feed is open)
- Like on panel → `liked_by_viewer = 1` on game's next feed fetch
- Phone polls the feed every 12 seconds while the Feed app is open; no polling when closed

---

## Rate Limits

| Action | Limit |
|--------|-------|
| Create post | 1 per 5 seconds |
| Like/unlike | 1 per 300 ms per target |
| Comment | 1 per 2 seconds |

Applied via `exports.sunset_core:RateLimit(source, key, ms)` in FiveM.

---

## Moderation

Currently players can:
- Delete their own posts (soft delete)
- Delete their own comments (soft delete)

Staff moderation (hide/remove) can be added through the panel admin routes using the same `deleted_at` soft-delete pattern.

---

## Character Switch Safety

FiveM: `social:getFeed` and all other callbacks derive character from `source`. No state bleeds.

Panel: `session.selectedCharacterId` is re-read on every request. Switching character updates the session cookie and immediately changes Gallery/Contacts/Liked state on next navigation.

---

## FiveM Callbacks

| Callback | Args | Returns |
|----------|------|---------|
| `social:getFeed` | `{ feed, beforeId, limit }` | `{ posts, nextCursor }` |
| `social:getPost` | `postId` | `{ post, comments }` |
| `social:createPost` | `body, mediaId` | `{ ok, postId }` |
| `social:likePost` | `postId` | `{ ok, likesCount, likedByViewer }` |
| `social:unlikePost` | `postId` | `{ ok, likesCount, likedByViewer }` |
| `social:addComment` | `postId, body, parentCommentId?` | `{ ok, comment, commentsCount }` |
| `social:deletePost` | `postId` | `{ ok }` |
| `social:deleteComment` | `commentId` | `{ ok }` |
| `social:getProfile` | `characterId` | `{ profile, posts }` |
| `social:getActivity` | — | `{ notifications, unread }` |
| `social:getUnreadCount` | — | `{ count }` |

---

## Panel API Routes

| Route | Method | Auth |
|-------|--------|------|
| `/api/feed/posts` | GET | optional (liked_by_viewer needs session) |
| `/api/feed/posts` | POST | session + selectedCharacterId |
| `/api/feed/posts/[id]` | GET | optional |
| `/api/feed/posts/[id]` | DELETE | session, must be own post |
| `/api/feed/posts/[id]/like` | POST | session + selectedCharacterId |
| `/api/feed/posts/[id]/comments` | GET | none |
| `/api/feed/posts/[id]/comments` | POST | session + selectedCharacterId |
