# FiveM runtime research decisions

Sources reviewed on 2026-09-28:

- Cfx.re event security: https://docs.fivem.net/docs/developers/server-security/
- Cfx.re OneSync: https://docs.fivem.net/docs/scripting-reference/onesync/
- Cfx.re state bags: https://docs.fivem.net/docs/scripting-manual/networking/state-bags/
- Cfx.re routing buckets: https://docs.fivem.net/docs/cookbook/2020/11/27/routing-buckets-split-game-state/
- Cfx.re manifests/Lua runtime: https://docs.fivem.net/docs/scripting-reference/resource-manifest/
- CitizenFX spawnmanager implementation: https://github.com/citizenfx/cfx-server-data/blob/master/resources/%5Bmanagers%5D/spawnmanager/spawnmanager.lua
- oxmysql transactions/placeholders: https://github.com/overextended/overextended.github.io/blob/main/content/docs/oxmysql/Functions/transaction.mdx and https://overextended.dev/docs/oxmysql/placeholders
- Qbox player registry/login implementation: https://github.com/Qbox-project/qbx_core/blob/main/server/player.lua
- QBCore player lifecycle implementation: https://github.com/qbcore-fivem/qb-core/blob/main/server/player.lua
- bob74_ipl upstream: https://github.com/Bob74/bob74_ipl

Applied conclusions:

- A correct event handler is not secure merely because client UI hides it. Every client->server event validates source state, type, length, permission, and rate.
- Internal server events use non-networked handlers.
- OneSync server natives validate entity state/coordinates; state bags hold only granular replicated flags.
- Login/onboarding buckets use lockdown and no population; they are not interiors.
- Spawn follows the proven model-load, fade, collision-load, resurrection, cleanup, unfreeze order with bounded waits.
- Player maps have both source and persistent-ID indexes and reject duplicate loaded identity.
- DB mutations use placeholders; registration/session/sanction invariants use real transactions.
- Resource restarts and `playerDropped` are first-class lifecycle paths, not afterthoughts.
- Lua 5.4 is now the default; deprecated `lua54 'yes'` flags were removed to avoid startup warnings.
- `bob74_ipl` is pinned as map infrastructure only and does not own framework state.

