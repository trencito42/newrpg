# Performance audit

No load test was run. These are code-shape risks at the configured 48 slots and at a hypothetical 100 players.

| Risk | Where | Why it matters |
| --- | --- | --- |
| Per-frame input | `sunset_phone/client/main.lua`, `sunset_scoreboard/client/main.lua`, `sunset_inventory/client/quickslots.lua`, `sunset_hud/client/main.lua` | `Wait(0)` while polling a key. Cost is per client, so 100 players means 100 clients each doing it, not one server loop. Still worth sleeping until the control is pressed. |
| Phone open payload | `sunset_phone/server/main.lua` `getPhoneData` | Sends recent messages, calls, and money rows on every open. Avatars are not embedded. It is bounded, not a full-world dump. |
| Scoreboard | `sunset_scoreboard/server/main.lua` | Snapshot cache TTL is 2500 ms. Not a per-frame player scan. |
| Market expiry | `sunset_phone/server/market.lua` | One thread, 60s, 25 rows. Fine. |
| Turf participant scan | `runIntervene` | `GetPlayers()` once per intervene, not per frame. |
| Entity loops | job resources | Not rewritten here. A per-job `Wait(0)` marker loop would dominate before the scoreboard does. |

Nothing in this change adds a 0 ms loop.
