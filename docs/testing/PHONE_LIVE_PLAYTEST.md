# RACKET phone live playtest

Static checks do not prove these. Run them in FiveM after deploy. Mark each LIVE VERIFIED only after you see it in game.

| Check | Expected UI | Expected server state | Failure symptom |
| --- | --- | --- | --- |
| Phone time equals HUD time | Status clock matches the HUD hour and minute | No clock callback on the server | Phone shows the VPS/Windows clock |
| Open and close 20 times | Cursor and keyboard return every close | No leftover phone prop | Stuck mouse, floating phone, stuck animation |
| SMS to a saved contact | Thread shows the text, then Sent | `phone_messages` row for both character ids | Generic "server rejected" toast plus a HUD alert |
| SMS to an unknown number | Number is the title if unsaved | Recipient resolved from `characters.phone_number` | Unknown with no number, or invalid recipient |
| SMS to an offline contact | Message stays in the thread | Row inserted, no live `phoneNewMessage` to a source | Send looks failed even though the row exists |
| SMS failure and retry | Bubble says Not sent, Retry sends the same text | No empty message row | Composer is wiped and the text must be retyped |
| Receive SMS | One new bubble, unread badge increments | Receiver gets one insert | Full phone reload or a second copy of the bubble |
| Unread badge | Drops after the thread is opened | `read_at` set for that peer | Badge survives after reading |
| Call | Ring, answer, hang up, voice ends | `phone_calls` status matches the end reason | Ringtone continues, voice channel stays open |
| Missed call | Badge appears, then clears when Recents opens | `phone_character_prefs.calls_seen_id` advances | Red badge stays for a day after viewing Recents |
| Ringtone off | Incoming call is silent | `ringtone = 0` | Remote_Ring still plays |
| Bank transfer | Server ID field, success shows the new balance | Bank balances move once | Player ID confusion, double debit, HUD plus phone toast |
| Garage GPS | Stored and impound use those lots; streamed cars say exact; others say last known | Waypoint only | Stale parked coords labeled exact |
| Taxi waypoint | Request stays disabled until a destination or waypoint is chosen | Destination coords stay inside map bounds | Ride created with no destination, or raw coordinates on screen |
| Taxi fixed destination | Default list is a few popular places, search finds the rest | Fare uses the configured destination | Faction HQs fill the first screen |
| Market list | Sell uses the shared asset picker, then price | One listing row, CNN only if promoted | A raw dump of every vehicle and item |
| Rich chat asset link | Chip opens the preview, no ownership change | No inventory or vehicle write | Text injection or a second picker |
| CNN promoted listing | Promote is optional and uses the station rules | `cnn_ads` row only after a real promote | Listing rolls back when promote fails, or remote promote works |
| Jobs | Current job, level, locked reason | No job change from merely opening the app | Blank page or every internal record |
| Faction | Duty and members match the real faction | Rank changes rejected without permission | Fake depot state |
| Clan | Capacity, expiry, members refresh after a change | Clan tables match the phone | Needs a reconnect to see a kick or renewal |
| Properties | Owned and rented pages append without duplicates | Page query stays ordered | Repeated rows or a blank list |
| Account | Base nickname, not the clan tag | `firstname` only | `[clan]name` in the name row |
| Buy level | Button shows the next level and disables when RP or money is short | Level, RP, and money change once | `/buylevel` label, `$13000`, no refresh |
| Settings | Ringtone and notification toggles revert if the save fails | Prefs row matches the switch | Switch stays on after a failed save |
| Quest handoff | Phone closes focus before the quest log, or the quest log replaces it | One focus owner | Two cursors or no cursor after closing quests |
| Character switch | Character B has none of A's threads, taxi destination, or toast | Prefs stay on B's character id | A's SMS still on screen |
| Resource restart | `sunset_phone`, `sunset_ui`, `sunset_taxi` recover | No stuck focus | Ring forever, blank phone, dead prop |
| Dialer uses the full screen | Keypad, number, and Call fill the view; no dead lower half | Call still uses `sunset:phoneCallStart` | Keys stuck at the top, Call behind the home indicator |
| Recents and contacts | Each tab is a full-height list | Same call and contact rows | The page jumps height between tabs |
| Conversation composer | Composer stays at the bottom while messages scroll | `read_at` still updates | Composer scrolls away |
| Taxi chips | Wrapped chips have a visible vertical gap | Popular list stays short; search still caps at 8 | Pills glued to the previous row |
| Taxi request | Request stays at the bottom and hides during an active ride | No second ride while one is active | Request Ride still visible in progress |
| Jobs catalog | Current job plus every civilian job | `access.allowed` comes from `CanAccess` | Only the current job is listed |
| Job locks | Locked jobs list level, license, and quest requirements | Phone does not start the job | A lock icon with no reason |
| Map catalog | More than 40 locations stay searchable | Pins come from `sunset:getPhoneMapLocations`, not taxi ride state | Search stops at 40, or the map is empty when taxi data fails |
| Faction report | Weekly current/target, own FP, society only if the dashboard sent it | Resignations and pardon call the existing faction callbacks | Report data arrives and the phone ignores it |
| Faction management | Member tap opens actions; resignations only with permission | Rank change rejected without permission | Four buttons on every row, or a member sees resignations |
| Properties tabs | Owned and Rented are separate, one Load more | Page query stays on the active filter | Both lists mixed, two Load more buttons |
| Garage and bank | Garage list/detail and bank transactions fill the body | GPS and transfer callbacks unchanged | Cards floating in empty space |
| Clan tabs | Overview, Members, Management only when permitted | Clan manage callbacks unchanged | One endless page, empty management for members |
| News rich asset | Ad text keeps the inline attachment; tap opens Asset Preview | Snapshot stays the public one | Chip missing, or a second detail implementation |
| Account | Nickname, number, id, progression, phone toggles | Prefs and buy level unchanged | One undifferentiated stack |

Do not mark a row live-verified from this document alone.
