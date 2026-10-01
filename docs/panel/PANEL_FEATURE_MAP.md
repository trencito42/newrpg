# Panel feature map (current implementation)

| Area | Source of truth | Panel behavior |
|---|---|---|
| Accounts and sessions | `accounts`, `panel_web_sessions` | Modern username/password login, logout, session revocation and character selection |
| Public profiles | `characters`, `vehicles`, `properties`, `admin_sanctions` | Public progression, vehicle/property lists and warning count; owner/staff-only cash and bank |
| Server status | `panel_runtime_snapshot` written by `sunset_panel_bridge` | Online count only when snapshot is fresh |
| Polls | `panel_polls`, options and votes | Server-side eligibility, one vote per account, matching option/poll relationship |
| Helpdesk and appeals | Panel-owned support/complaint/unban tables | Submission and existing read views; gameplay sanctions are not changed by these records |
| Staff actions | `panel_action_queue`, `sunset_admin`, `sunset_factions`, `sunset_core` | Queues ban, unban, mute, warn and faction changes from authorized player profiles; FiveM reports execution status. Ban/mute/warn require the target online; admin actor must be online for all actions. Runtime validation is still pending. |

FiveM remains authoritative for player state and admin/faction actions. Do not add web SQL updates to game-owned tables as a shortcut. Browser tests cover queue submission and authorization, but actual FiveM action execution and the complete code-level audit remain open.
