# Panel feature map (current implementation)

| Area | Source of truth | Panel behavior |
|---|---|---|
| Accounts and sessions | `accounts`, `panel_web_sessions` | Modern username/password login, logout, session revocation and character selection |
| Public profiles | `characters`, `vehicles`, `properties`, `admin_sanctions` | Public progression, vehicle/property lists and warning count; owner/staff-only cash and bank |
| Server status | `panel_runtime_snapshot` written by `sunset_panel_bridge` | Online count only when snapshot is fresh |
| Polls | `panel_polls`, options and votes | Server-side eligibility, one vote per account, matching option/poll relationship |
| Helpdesk and appeals | Panel-owned support/complaint/unban tables | Submission and existing read views; gameplay sanctions are not changed by these records |
| Staff dashboard | Game sanction logs and panel-owned moderation records | Read-only; no verified ban, mute, warn, unban or faction workflow from the web yet |

FiveM remains authoritative for player state and admin/faction actions. Do not add web SQL updates to game-owned tables as a shortcut for missing bridge operations. The complete code-level audit and E2E tests requested for the panel are still pending.
