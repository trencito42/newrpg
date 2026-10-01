# Jobs audit (sunset_jobs, taxi, fishingshop, fishing_tournament, racing, quests, missions, sessions)

Method: static code tracing only. Nothing here was run on a FiveM server.
Static checks after edits: check-lua-syntax 0 errors, check-lua-forward-refs 0 in sunset_*, check-nui-bridge OK.

## Cross-cutting bug classes (fixed everywhere found)
- `{ localeKey = ... } .. string` (table concat, runtime error): core.lua, route_store, fishingshop x2, missions x2. NOT in my scope, still present: sunset_dispatch/server/service_core.lua:355, sunset_appearance/server/main.lua:61,66.
- Server `AddEventHandler('sunset:jobs:sessionEnded')` (a client-only event) in hunter/diver: cleanup never ran. Core now raises `sunset:jobs:serverSessionEnded`.
- Yielding payouts without state flip/lock (double pay): courier, garbage, hunter contract, mechanic, fishingshop. Added `SunsetJobs_WithLock`, state advanced before pay, rollback on failed AddMoney.
- Unchecked AddMoney/RemoveItem/AddItem results: hunter/diver sell, diver handoff, quests, missions, tournament, fishingshop, racing, taxi.
- Client-supplied netId adopted as work vehicle (courier/garbage).
- `exports.sunset_core:FormatMoney/IsPlayerAdmin` do not exist (proxy always truthy): tournament settlement threw mid-payout.
- Unbounded anim dict waits (garbage, courier) and missing onResourceStop cleanup (fisherman, garbage, courier, trucker_npc, fishingshop NPC, missions entities/blips, hunter, diver).

## Per job
### Courier - FIXED / PARTIALLY VERIFIED
Bugs: client netId adopted as van; deliver paid twice under concurrency; pay failure ignored; no travel plausibility; prop/checkpoint leak on restart. Fixed (lock, pre-pay state advance + rollback, 1.5s/70 m/s plausibility, onResourceStop). Remaining: loading steps have no pacing (no money attached).
Live test: Start Courier -> load all 6 -> deliver stop 1 -> destroy van -> shift fails, no further pay -> restart resource -> /work -> one checkpoint, one prop.

### Garbage - FIXED
Bugs: truck netId adopted from client; unload double-pay (ClearSession after yield); instant pickup->dump; world bag leaked; unload retry spam each frame. Fixed all.
Live test: pick bin, spam E on dump -> exactly one $48; fill truck, spam unload -> one bonus; /work cancel mid-carry -> no bag prop at next bin.

### Trucker - FIXED / REQUIRES LIVE TEST
Bugs: `/tptruck` `/trucktp` were ungated client commands (instant delivery); `isManual` 2x pay trusted client; returnDepot completable without delivery; no route travel-time check; trailer-loss 50% pay with zero driving and wrong route table; auto-hire bypassed driver licence; registerVehicle used nil `cfg` and retry keyed on English strings (non-English never retried); wreck not treated as lost; unconditional prints.
Fixed: admin-only server command (level 1, matches sunset_admin table), server docking verification, stage guard, 45 m/s plausibility, >=500 m travel for partial pay, `{retryable=true}` handshake, IsEntityDead, debug-gated logs. Remaining: `/aaddroute` edits cfg.routes which is ignored when the route store is populated.
Live test: start route, /tptruck as player -> denied; deliver within seconds -> rejected; park in bay -> 2x only when docked; return depot before delivering -> rejected.

### Fisherman - FIXED
Bugs: concurrent casts consumed bait/overwrote challenge; sell lock stuck if progress write threw; rod prop/UI leaked on restart. Fixed. Balance: jobs sell pays metadata value x1.15 uncapped, fishingshop clamps to FISH_PRICES max (inconsistent).
Live test: cast, reel in window -> one fish; sell at 24/7 and at Billy Ray; restart resource mid-cast -> no rod prop.

### Hunter - FIXED / REQUIRES LIVE TEST
Bugs: stale HunterContracts after shift end (old contract could pay in new shift); contract payout could double; failed payout cleared contract; registerAnimal re-register reset harvested, accepted any ped incl. players; reportAnimalDead accepted with zero damage; sellHarvest no proximity, unverified removals, restore dup; endShift illegal STARTING->COMPLETED left shift stuck; carcass menu ESC left NUI focus; dead-report spam.
Fixed all. Remaining: after reconnect the zone object is not resent (HUD stays go_to_zone until contract re-taken); hunter shifts need a live OneSync check that server GetEntityHealth for peds is accurate.
Live test: take contract, die, restart shift, harvest -> no contract credit; ESC on carcass menu -> cursor released; sell away from Mason -> rejected.

### Diver - FIXED
Bugs: rented boat/gear/snapshots never cleaned on cancel/death/timeout (dead event); O2 refilled on every stateChanged and every contract; boat fee lost if spawn never confirmed; dead boat blocked rentals; sell anywhere; handoff paid-failed still disarmed; endShift stuck in STARTING. Fixed.
Live test: rent gear+boat, die -> boat deleted, gear removed; salvage twice -> O2 keeps counting down; sell away from Terry -> rejected.

### Mechanic - FIXED
Bugs: providers stayed registered after death/timeout/cancel (dispatch kept routing calls); repair paid without call state change before yield; self-repair; no minimum work time; client set en_route when accept failed; E key double-handled; client could spoof newCall relay. Fixed (dispatchOffer net event removed, zero refs).

### Workplaces / job center - FIXED
Hire via job center bypassed licence requirements; `/work` for hunter/diver dead-ended. Fixed (SunsetJobs_CheckRequirements shared).

### Route store - FIXED (concat bug). Remaining: SaveRoutes export is callable by any resource.

### Sessions mirror (sunset_jobs core) - FIXED
RegisterActivity fixed-wait replaced by polling; framework sessions now ended on player drop and resource stop; PayReward rejects NaN/negative/huge/float; job_progress read-modify-write serialised per character.

### Fishing shop - FIXED
Concat bugs; bait purchase charged without delivery (full bag) - now refunds; rod upgrade lost money/rod on full bag, was remote and double-chargeable; carts unlocked/unbounded; sell credit failure ate fish. Fixed. Legacy `sellFish247` callback has zero client refs (left in place).

### Fishing tournament - FIXED / REQUIRES LIVE TEST
Bugs: FormatMoney/IsPlayerAdmin nonexistent exports aborted settlement; history INSERT used columns absent from sql/58 (always failed); pending-reward claim was non-atomic (double pay) and marked claimed on failed pay; settlement error left SETTLING. Fixed. Remaining: participants are memory-only, a resource restart mid-event loses the scoreboard.

### Racing - FIXED / REQUIRES LIVE TEST
Bugs: start used non-existent `sunset_jobs:CancelSession` (added); concurrent joins double-charged; checkpoints teleportable (no travel time) and on-foot/passenger accepted; downed/jailed racer blocked the single global race 10 min; start/quit spam held the slot; restart lost entry fees; payouts unchecked. Fixed. Balance: free solo trial pays $500 every 5 min.

### Taxi - FIXED
Bugs: failed driver credit destroyed passenger fare (now refunded); error during payment left ride in `settling` forever; tip uncapped/duplicable and lost on failure; request spam; unvalidated coordinates/labels; expired request left dispatch call. Fixed. Balance: allowedVehicles includes civilian `dynasty`, `rumpo`, `stretch`, `bus`.

### Missions - FIXED / PARTIALLY VERIFIED
Bugs: client `escaped`/stage trusted; instant completion possible; unpaid-but-completed on AddMoney failure; concat bugs; no onResourceStop cleanup. Fixed (visited-stage escape, 45s minimum, 3s stage dwell, rollback). Remaining: stage progress is still client-driven (no server proof of objectives).

### Quests - FIXED (claim rolls back if payout fails).
### sunset_sessions - VERIFIED only as consumer; not modified.

## Unverifiable without a live server
Vehicle networking/ownership, `GetEntityHealth` on peds, bucket changes (no job handles routing buckets: REQUIRES LIVE TEST), admin teleport interplay, NUI focus release paths, resource-restart cleanup of props, all timings/plausibility thresholds (45 m/s trucker, 70 m/s courier, 110 m/s racing) may need tuning.
Note: `sunset:anticheat:markLegitLocal` is client-triggerable (security agent's domain).

## Balance concerns (not changed)
Fishing dual sell prices; solo race $500 free; taxi vehicle list; hunter/diver pay vs rank; trucker 2x manual bonus.
