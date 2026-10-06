# Panel staff CMS — API vs UI gaps

Date: 2026-10-06

## Fixed in this pass

| Area | Was | Now |
|------|-----|-----|
| Polls | `DELETE` required admin ≥3; no staff UI | `/staff/content/polls` actions + `DELETE` for admin ≥1 |
| Updates | Delete only on public article (admin ≥3); staff list read-only | Staff list **Delete**; edit/delete API + `canManage` for admin ≥1 |
| Rules | No delete in editor | **Delete** on saved rule in Rules CMS |

## Still limited (known)

| Area | API | UI gap |
|------|-----|--------|
| Wiki categories | `POST/PATCH/DELETE` on `/api/staff/cms/wiki/categories` | No category CRUD screen — only pick existing category on articles |
| Rules sections | `POST/PATCH/DELETE` on sections routes | Edit section titles inline only; no **new section** / **delete section** buttons |
| Legal CMS | Publish/draft per key | No delete (by design — versioned legal pages) |
| Forum admin | Full structure + ACL in `/staff/forum` | Moderation queue remains at `/staff/forum/moderation` and `/forum/mod` |

## Permission convention

Staff **Content** hub pages gate on `adminLevel >= 1`. Destructive CMS APIs should match unless a deliberate senior-only action is required.
