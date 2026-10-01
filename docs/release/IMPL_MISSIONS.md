# IMPL_MISSIONS - missions / quests / robbery / fire / turfs / fishing tournament

All items STATIC-verified (syntax, forward refs, db-writes, locales, scripts/test-missions-authority.js: 79 pass).
Nothing was run on a FiveM server. check-lua-syntax reports 1 error in sunset_slots/server.lua (other agent, not this domain).

## A. Missions (sunset_missions) - server-authoritative stages
- NEW server/stages.lua (+ fxmanifest): MSN_Transitions table. setStage only accepts the immediate successor, per-transition
  min dwell and a bounded server position check (zone / port / container / exit / delivery). Helpers: MSN_NearCoords,
  MSN_PlayerInMissionVehicle (server-side vehicle model + plate vs variant), MSN_ReadVehicleCondition (server vehicle health).
- server/main.lua: setStage via MSN_RequestTransition; vr:vehicleEntered requires being seated in the variant vehicle;
  vr:deliver requires DELIVER state, delivery position, mission vehicle, condition read server-side (client value ignored);
  c47:identify requires physical proximity to the slot + 2s per-slot throttle; c47:deliver only from DELIVER (ESCAPE bypass removed);
  alert level clamped; per-session busy lock + rewardClaimed; per-player accept lock; death (sunset:death:playerDowned) ends the
  session; onResourceStop closes sessions as 'interrupted' (no reward).
- Fixed latent bug: the old global 3s dwell rejected chained client transitions (LOCATE->STEAL, ALERT->ESCAPE); now per-transition.
- Mission defs: minDurationSec 90 (vehicle_recovery) / 150 (container_47).
- client/runtime.lua: refused setStage aborts the run (server is truth); nil guards after setStage.
- Quests: audited, already server-only events + guarded claim UPDATE; no change. Robbery: leaveStore only from LOOTING,
  escaped needs >=5s after escaping + busy flag (no teleport/instant success). Fire: client amount ignored (server constant),
  min burn time (20s), finisher needs >=3 hits. Turfs: payday income once per clan per window (TurfPayoutAt), failed credit releases.
  War kill scoring was already server-side (hit record + server death check).

## B. Fishing tournament persistence
- NEW sql/70-fishing-tournament-persistence.sql: fishing_tournaments (status machine), fishing_tournament_participants
  (uq tournament+char), fishing_tournament_catches (uq tournament+char+catch_key = idempotency; index for scoring).
- server/main.lua rewritten flow: start/resume by id (settled/cancelled ids refused), join persisted, each catch INSERT IGNORE
  (key reserved in memory before the yield; duplicates are no-ops), weight/age sanity (0<kg<=150, event <=30s old), scores rebuilt
  from DB on resume and settle (cut-off min(endsAt, now)). Settlement: status active->settling, history upsert, reward rows
  INSERT IGNORE (first insert wins), status settled, then online winners paid through the single atomic claim path
  (claimPendingRewards); offline winners claim at login. Errors leave status 'settling' and retry every 60s / next start.
  resumeFromDb on resource start settles expired/half-settled rows. playerDropped keeps the score (char-id keyed).
  sunset_events serverStart now passes the real remaining duration (previously fell back to a full 3600s).

## C. Cleanup
Client entity/blip/vehicle cleanup on stop/abort/complete already present (runtime.lua, entities.lua); server session cleanup on
drop/death/stop added. Robbery already cancels sessions on stop/drop/death.

## Tests
node scripts/test-missions-authority.js (79); check-lua-syntax / forward-refs / db-writes / nui-bridge / locales / locale-usage run.

## Residual - REQUIRES LIVE TEST
- Server vehicle natives (GetVehicleNumberPlateText, GetVehicleBodyHealth/EngineHealth, GetVehiclePedIsIn) under OneSync: plate/model
  match for client-spawned vehicle; tune radii (zone pad 80m, exits 45m) against real traffic of position replication.
- Vehicle and guards/pursuers are still client-spawned: escape bonus (10%) and container alert are advisory, not provable server-side.
- Apply migration 70 (re-check number is unused at merge); full tournament cycle: join, catch, restart resource mid-event, server
  restart, relog, end, claim online/offline, duplicate end triggers.
- Fire: confirm extinguish tick rate (client ~250ms) still completes a 100hp fire in reasonable time (>= 9 ticks + 20s burn).
