# SunsetMP — Comprehensive Permissions & Access Control Matrix

This document maps all administrative ranks, helper roles, player permissions, and faction ranks against the command suite and server actions.

---

## 1. Administrative Rank Hierarchy

| Level | Role Name | Scope & Authority | Logging Level |
| :---: | :--- | :--- | :---: |
| **0** | **Player** | Standard civilian & faction member commands | Normal |
| **1** | **Helper / Trial Support**| Ticket answering (`/ar`, `/cl`), spectate player (`/spec`), mute (`/mute`), unfreeze (`/unfreeze`) | High |
| **2** | **Junior Admin** | Kick (`/kick`), temporary jail (`/ajail`), goto/bring (`/goto`, `/bring`), vehicle fix (`/vfix`), revive (`/revive`) | High |
| **3** | **Senior Admin** | Temporary Ban (`/ban`), offline jail (`/offjail`), freeze player (`/freeze`), set dimension/bucket (`/setbucket`) | Critical |
| **4** | **Head Admin / Management**| Permanent Ban (`/pban`), faction leader assignment (`/setleader`), unban (`/unban`), economy audit (`/checkmoney`) | Critical |
| **5** | **SuperAdmin / Developer** | Direct database sync, give cash/items (`/givemoney`, `/giveitem`), reload configs (`/reloadconfig`), debug gizmo (`/dev`) | Full Audit |

---

## 2. Command Access & Security Matrix

| Command | Min Admin Level | Target Validation | Distance Check | Server File | Security Audit Status |
| :--- | :---: | :---: | :---: | :--- | :---: |
| `/spec [id]` | 1 | Online Player | N/A | `sunset_admin/server/main.lua` | ✅ Safe (stores previous coords) |
| `/goto [id]` | 2 | Online Player | N/A | `sunset_admin/server/main.lua` | ✅ Safe |
| `/bring [id]`| 2 | Online Player | N/A | `sunset_admin/server/main.lua` | ✅ Safe |
| `/kick [id] [reason]` | 2 | Online Player | N/A | `sunset_admin/server/main.lua` | ✅ Safe (logs to DB & Discord) |
| `/ajail [id] [min] [reason]` | 2 | Online Player | N/A | `sunset_admin/server/main.lua` | ✅ Safe (sets DB bucket & jail flag) |
| `/ban [id] [days] [reason]` | 3 | Online Player | N/A | `sunset_admin/server/main.lua` | ✅ Safe (records HWID + IP + License) |
| `/offban [account] [days]` | 3 | Offline Account | N/A | `sunset_admin/server/main.lua` | ✅ Safe |
| `/setleader [id] [faction]` | 4 | Online Player | N/A | `sunset_factions/server/leaders.lua` | ✅ Safe (revokes previous leader) |
| `/givemoney [id] [amount]` | 5 | Online Player | N/A | `sunset_admin/server/main.lua` | ✅ Safe (single atomic transaction) |
| `/giveitem [id] [item] [n]` | 5 | Online Player | N/A | `sunset_admin/server/main.lua` | ✅ Safe (validates item catalog) |
| `/dev` | 5 | Source Only | N/A | `sunset_devtools/server/main.lua` | ✅ Safe (restricted to dev ace group) |

---

## 3. Faction Rank Permissions (LSPD / BCSO)

| Rank | Title | Permitted Actions & Commands |
| :---: | :--- | :--- |
| **1** | Cadet / Recruit | Ride-along only, taser / baton loadout, `/duty`, `/r` radio |
| **2** | Officer I | Patrol cruiser access, service pistol loadout, `/cuff`, `/escort`, `/radar` |
| **3** | Officer II / Senior | Carbine rifle authorization, spike strips, `/ticket`, `/impound` |
| **4** | Sergeant | Fleet management, roadblock deployment, `/wanted`, `/jail`, tactical gear |
| **5** | Lieutenant | Shift supervisor, department broadcast (`/gov`), SWAT armory access |
| **6** | Captain | Internal affairs, faction hiring (`/finvite`), rank management (`/fsetrank`) |
| **7** | Chief of Police | Full faction ownership, budget management, faction roster clear |
