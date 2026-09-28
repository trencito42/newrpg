# Commands and staff levels

Staff ranks are separate: `Helper Level 1-3` and `Admin Level 1-6`. Admins may use helper commands. Targeted actions enforce hierarchy: helpers cannot target admins or equal/higher helpers, and admins cannot target equal/higher admins.

## Player

| Command | Purpose |
|---|---|
| `/stats` | Account, progression, money, RP, and playtime |
| `/admins` | Online admins/helpers and duty status |
| `/report [text]` | Open one persistent admin report |
| `/n [text]`, `/helpme [text]` | Open one persistent newbie question |
| `/sleep` | Toggle AFK/sleep status |
| `/lc [text]` | Faction leader chat (leaders only) |

## Helpers

| Minimum | Commands |
|---|---|
| Helper 1 | `/hduty`, `/e`, `/pm [id] [text]`, `/an [question id] [answer]`, `/nd [question id] [reason]`, `/goto [id]` (3-minute cooldown) |
| Helper 2 | All above plus `/nmute [id] [reason] [minutes]` |
| Helper 3 | All helper commands; reserved for later helper-management capabilities |

Questions are shown to on-duty helpers/admins. Answers are broadcast in the requested Newbie/Helper format. Newbie mutes affect only `/n` and `/helpme`.

## Admins

| Minimum | Commands |
|---|---|
| Admin 1 | `/aduty`, `/a`, `/e`, `/pm`, `/cr`, `/noclip`, `/goto`, `/mark`, `/gotomark`, `/entercar`, `/togfind`, `/afklist`, `/check`, `/ainfo`, `/back`, `/coords`, `/serverstats` |
| Admin 2 | `/gethere` (`/bring`), `/freeze`, `/unfreeze`, `/heal`, `/revive`, `/respawn`, `/spec` (`/spectate`), `/warn`, `/history`, `/kick`, `/mute`, `/disarm`, `/sethp`, `/gotocar`, `/fixveh`, `/cc` |
| Admin 3 | `/ban`, `/tempban`, `/unban`, `/anno` (`/announce`), `/disarmarea`, `/sethparea`, `/setvw [id] [world]`, `/getcar`, `/respawncars` |
| Admin 4 | `/banip`, `/givegun`, `/givemoney`, `/setleader`, `/spawncar` |
| Admin 5 | `/createhouse`, `/giverpall`, `/setstat` |
| Admin 6 | `/setadmin [id] [0-6]`, `/sethelper [id] [0-3]` |

Durations for `/ban` use `30m`, `6h`, `7d`, or `perm`. `/mute` and `/nmute` use minutes. The third active warning creates a permanent account ban. `/banip` snapshots only the current IP; normal account bans snapshot non-IP platform identifiers.

Allowed `/setstat` variables are `money`, `rp`, `level`, and `xp`. Allowed `/givegun` names are `pistol`, `combatpistol`, `stun`, `smg`, `carbine`, `shotgun`, `bat`, `knife`, and `flashlight`.

`/spawncar [model]` creates a persistent unowned server vehicle and returns its database ID. `/gotocar`, `/getcar`, and `/respawncars` use these IDs. `/createhouse [level] [price]` persists the current position and virtual world. `/setleader [id] [faction name]` creates the faction record if needed and assigns a single leader.

## Console

First Admin Level 6 bootstrap:

```text
rpg_setowner <registered username>
```

Diagnostics: `framework health`, `framework players`, and `framework sessions`.
