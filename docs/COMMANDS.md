# Commands

Levels: `0 Player`, `1 Helper`, `2 Moderator`, `3 Admin`, `4 Super Admin`, `5 Owner`.

| Command | Level | Purpose |
|---|---:|---|
| `/stats` | 0 | Base account/player statistics |
| `/admins` | 0 | Online staff |
| `/aduty`, `/a` | 1 | Duty toggle and staff chat |
| `/ainfo [id]`, `/goto [id]`, `/back`, `/coords`, `/serverstats` | 1 | Framework diagnostics |
| `/bring [id]`, `/freeze [id]`, `/unfreeze [id]` | 2 | Player control |
| `/heal [id]`, `/revive [id]`, `/respawn [id]` | 2 | Health/spawn recovery |
| `/spectate [id\|off]` | 2 | Safe spectate with restoration |
| `/warn [id] [reason]`, `/history [id]`, `/kick [id] [reason]` | 2 | Sanctions/history |
| `/cc` | 2 | Clear chat |
| `/ban [id] [duration\|perm] [reason]`, `/tempban ...`, `/unban [id\|username] [reason]` | 3 | Persistent bans |
| `/announce [message]` | 3 | Global announcement |
| `/setadmin [id] [0-5]` | 5 | Audited staff-level change |

Console-only diagnostics: `framework`, `framework players`, `framework sessions`, `framework health` (the current diagnostic line includes all live counters and RPC metrics).

First owner bootstrap from the FXServer console:

```text
rpg_setowner <registered username>
```

The router always emits explicit unknown-command, permission, usage, player-not-found, and handler-error feedback.

