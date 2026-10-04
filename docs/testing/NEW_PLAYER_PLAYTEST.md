# New player playtest

This is a manual FiveM checklist. It was not executed in a GTA session.

| Step | Action | Expected |
| --- | --- | --- |
| No account | Register and log in | Auth identity is `accounts.username`. |
| First character | Create one nickname | `characters.level` is 1. `lastname` is empty. Cash $250, bank $1,000. |
| Intro | Wait after spawn | `sunset_intro` opens once. Skip or finish writes `account_intro_seen`. Reconnect and a second character do not open it. |
| Help and shop | Follow the first quest | `/quests` advances. A 24/7 purchase and an ATM use count. |
| Fisherman | Hire at the job center | `job_hired` for fisherman. Courier does not complete that step. |
| License | Pay the exam | $30. `license_obtained` driver. |
| Rental | Rent a ride at the dealership | $500. `vehicle_rented` once. A test drive does not count. |
| Shift | Finish a courier or fisherman loop | +2 respect on completion. Cancelling does not grant it. |
| Car | Buy the Blista and store it | Quest advances only after both purchase and garage store. |
| Level 5 | Buy levels up to 5 | The level-10 quest stays incomplete. |
| Level 10 | Buy the level | Notification names factions, hunting prerequisites, criminal contacts, and clan join. |
| Level 12 | Buy the level | Notification says robbery opens after a chop. |
| Level 15 | Buy the level | Notification says clan creation is 500 RC and turfs need an active clan. |
| Market | List and buy | A failed debit does not move the asset. An expired item listing returns the escrow once. Cancelling an item listing returns it immediately and the inventory UI updates without a relog. A vehicle buy without a driver license is rejected. A property buy below that house's `minimum_level` is rejected. |
| Faction | At level 10 with the level-10 quest claimed, accept an invite | Membership saves. Before that, invite and accept are refused. A faction leader using the panel cannot add a level-1 character. Staff admin level 3 or higher still can. |
| Auth | While the login screen is up, do not enter the world | The player stays in routing bucket 9999 until a spawn permit is accepted. |

## Two-hour soak

During one live session, rotate two jobs, open the phone (bank, garage, market), die once, reconnect once, and restart `sunset_phone` and `sunset_quests` while a character is loaded. Watch server hitch warnings, resmon on one client, and that cash, inventory, and the active quest match the database after reconnect. This checklist was not executed in this audit.
