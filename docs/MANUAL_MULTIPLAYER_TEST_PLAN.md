# Manual Multiplayer Test Plan
## Spawn / World Streaming / Property / Chat Systems

*Covers all changes from the audit series (commits 8fd056d → 78fcc99)*

---

## Prerequisites

- At least 2 test players (Player A and Player B) in separate browser sessions.
- Admin access for at least one account.
- The server must be running the latest deployed code.
- Check `docker logs blazed-fivem-1 --since 3m | grep -i 'Error parsing script'` — should be empty.

---

## 1. Spawn Menu

| # | Steps | Expected |
|---|-------|----------|
| 1.1 | Type `/spawnmenu` in-game. | Spawn menu panel appears with cursor. No blank overlay. |
| 1.2 | Select a spawn point in the panel; click Spawn. | Character spawns at the selected location, screen fades in smoothly. |
| 1.3 | Walk away, type `/spawnmenu` again. | Panel reopens; re-selecting a spawn and confirming moves character without fall-through. |

---

## 2. Safe Teleport / World Streaming (`Sunset.World.SafeTeleport`)

| # | Steps | Expected |
|---|-------|----------|
| 2.1 | Admin: use `/tp [id]` to teleport to a remote player. | Admin fades out, teleports, fades in. No falling through ground. Ground loads before fade-in completes. |
| 2.2 | Admin: use `/goto [coords]` to a remote location. | Same as 2.1. |
| 2.3 | Repeat 5 times quickly (spam). | All 5 teleports succeed; no stuck-frozen state; no permanent fade-out. |
| 2.4 | Teleport to interior location (Maze Bank, LSIA tower). | Collision loads; character stands on floor. |

---

## 3. Property / Interior System

| # | Steps | Expected |
|---|-------|----------|
| 3.1 | Approach a purchasable property with `/acreatehouse` created entry point. Press E. | Interior loads; player moves inside; routing bucket set to property ID; other players outside cannot see player. |
| 3.2 | Press E again while already inside. | Event ignored (mutex guard). No double-teleport. |
| 3.3 | Press E rapidly 5 times (E-spam). | Only one transition fires; player ends up cleanly inside or cleanly outside. |
| 3.4 | Exit property via interior door/E prompt. | Player teleports back to exterior entry coords. Ground loads before fade-in. |
| 3.5 | Player A is inside; Player B approaches exterior. | Player B cannot see Player A (different routing bucket). |
| 3.6 | Player A dies while inside property. | Player A respawns at hospital exterior, routing bucket reset to 0. Player A is NOT still stuck inside bucket. |
| 3.7 | Admin jails Player A while inside property. | Player A teleports to jail; routing bucket resets; property exits cleanly. |

---

## 4. Elevator Teleports

| # | Steps | Expected |
|---|-------|----------|
| 4.1 | Use elevator at Maze Bank Arena (on-foot). | Fade out → floor loads → fade in at destination floor. No fall-through. |
| 4.2 | Use elevator in a vehicle. | Vehicle + player stream to destination; vehicle does not fall through. |

---

## 5. Casino Teleport

| # | Steps | Expected |
|---|-------|----------|
| 5.1 | Enter Diamond Casino interior. | Screen fades, player appears inside. |
| 5.2 | Leave casino via exit prompt. | Player fades back to exterior casino entrance coords. No fall-through. |

---

## 6. Jail / Release Teleports

| # | Steps | Expected |
|---|-------|----------|
| 6.1 | Admin: `/jail [id] [minutes] [reason]`. | Target player fades out, world streams, arrives at jail cell. No fall-through ground on arrival. |
| 6.2 | Jail timer expires for Player A. | Player A teleports to police station release coords. World loaded; no fall-through. |
| 6.3 | Admin: `/unjail [id]`. | Player released immediately to station. World loaded; no fall-through. |

---

## 7. Death / Respawn

| # | Steps | Expected |
|---|-------|----------|
| 7.1 | Player A is killed (low health). | Player A goes downed; respawn timer appears. |
| 7.2 | Respawn timer expires or player clicks Respawn. | Fade out; world streams at hospital; player spawns at hospital exterior. No spawning under the map. |
| 7.3 | Repeat respawn 3 times. | Each time, player spawns correctly on ground. No degradation. |

---

## 8. Chat (SA RPG Style)

| # | Steps | Expected |
|---|-------|----------|
| 8.1 | Open chat (T). | Chat panel expands to full scroll view. All messages visible. |
| 8.2 | Close chat (Esc or Enter with empty message). | Chat shrinks to ~9 visible lines (≤175px height). |
| 8.3 | Send 3 messages; wait 13 seconds with chat closed. | Messages fade from view (12-second expiry). At least some messages disappear. |
| 8.4 | Send a message immediately after fade. | Message appears; timer resets; message stays visible for 12 more seconds. |
| 8.5 | Send 15 messages quickly. | Chat shows last ~9 when closed; all visible when opened. No overflow outside chat box. |
| 8.6 | PM another player: `/pm [id] test message`. | Sender sees "PM sent to [Name]" in correct format. Recipient sees formatted PM. |
| 8.7 | Check chat width at 1920×1080. | Chat ≤ 500px wide. Doesn't bleed to screen center. |

---

## 9. Detention System (Security)

| # | Steps | Expected |
|---|-------|----------|
| 9.1 | Player A (not police) spams `sunset:server:handsUp` via a modded client 10 times in 1 second. | Server logs show rate-limit blocks after first accepted call. No -1 broadcast storm. |
| 9.2 | Officer (Player B) cuffs Player A normally. | Player A animation plays correctly for all nearby players. |
| 9.3 | Officer Player B teleports >50m away from escorted Player A. | Escort desync fires; Player A freed from attach point. |

---

## 10. Localization

| # | Steps | Expected |
|---|-------|----------|
| 10.1 | Trigger mute notification (`/mute [id] [reason] [duration]`). | Muted player receives English notification: "You have been muted for X minutes. Reason: Y." |
| 10.2 | Admin uses `/warn [id] [reason]`. | Target player receives English warning message. Third warn triggers English ban broadcast to all players. |
| 10.3 | Player enters FNC modal (admin triggers via `/fnc [id]`). | Modal shows English labels: "Your New Nickname", "Change Name" button, English validation errors. |
| 10.4 | Gang player attempts to attack non-adjacent turf. | Notification in English: "You cannot attack this territory! It must be adjacent to territories already owned by your gang." |

---

## 11. Regression Checks

| # | Steps | Expected |
|---|-------|----------|
| 11.1 | Run courier job to completion (pick up parcel, deliver in van, carry to door). | Parcel not stuck in hand while driving. Three-step flow works. |
| 11.2 | Connect a second player; both chat. | Messages appear for both. No desync. |
| 11.3 | `/spawnmenu` → spawn → immediately enter property → die inside → respawn. | Each state transition completes cleanly. Player not stuck in any routing bucket after respawn. |

---

## Failure Signatures to Watch For

| Symptom | Root cause to suspect |
|---------|----------------------|
| Player spawns at LSIA beach / airport | `DefaultSpawn` fallback fired — collision timed out at target coords |
| Player falls through ground for 1-2 seconds | Collision not waited before `SetEntityCoordsNoOffset` |
| Player frozen indefinitely after teleport | `FreezeEntityPosition` set true but never cleared (crash in fade/collision wait) |
| Chat messages never fade | `scheduleExpiry()` not called or timer not set |
| Chat panel exceeds screen bounds | CSS `--chat-page-height` or width override in user settings |
| Hands-up animation plays/stops erratically | `handsUp` event fired multiple times without rate limit |
| Player stuck in property routing bucket after death | `Sunset.World.SafeTeleport` `restoreOnFail` fired and overrode server bucket reset |
