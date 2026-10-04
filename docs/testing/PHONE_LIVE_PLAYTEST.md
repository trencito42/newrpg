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

Do not mark a row live-verified from this document alone.
