# IMPL_JOBS: server-authority pass (jobs, taxi, fishingshop, racing, sessions)

Static work only. Nothing here was run on a FiveM server. `panel/` untouched. No commits.

## Baseline
JOBS_AUDIT.md already made courier/garbage/trucker/fisherman/hunter/diver/mechanic/taxi/racing payouts server-validated (callbacks hold session, stage, coords, timing; no client-supplied amounts). This pass closed the remaining gaps below.

## Changes
| # | Change | Files |
|---|---|---|
| 1 | **Work-vehicle wreck/loss = shift FAILED, no reward.** New `SunsetJobs_WorkVehicleStatus(session)` (none/ok/missing/wrecked: entity gone, health <= 0, engine <= -3999). 5 s monitor fails the session when wrecked, or missing for 2 consecutive ticks, deletes session entities, ends the session (client gets `sessionEnded`, JobHud cleared by existing handler). Opt-in flag `failOnWorkVehicleLoss` set for courier, garbage, trucker. Courier previously had NO vehicle monitoring at all (deliver is on foot, `requiresWorkVehicle` would break it): `courier:deliver` now also verifies the van is intact before paying. `SunsetJobs_ValidateVehicle` (garbage unload, trucker deliver) rejects wrecked vehicles. | sunset_jobs/server/core.lua, server/courier.lua, sunset_core/shared/jobs_config.lua |
| 2 | **Trucker deliver double-pay race**: stage flipped only after a yielding `GetJobLevel`; two concurrent requests both paid. Handler is now wrapped in `SunsetJobs_WithLock`. | sunset_jobs/server/trucker.lua |
| 3 | **Balance flag 3, fish prices**: ONE table `Sunset.FishPrices` (+`FishPriceMid`) in `sunset_core/shared/fish_prices.lua`, loaded by both manifests. Decision: values = former fishingshop `FISH_PRICES` (docs/JOBS.md documents no per-fish price). The jobs midpoint table was exactly the midpoint of those ranges, so no change for plain fish. Jobs Fish Buyer now clamps per-unit metadata value to the same `max` (it was uncapped x1.15). The 1.15 `sellBonusMultiplier` stays (job perk, jobs_config). | sunset_core/shared/fish_prices.lua, sunset_fishingshop/{fxmanifest,server/main}.lua, sunset_jobs/{fxmanifest,server/fisherman}.lua |
| 4 | **Balance flag 1, solo race $500/5 min**: config says this is intended ("fixed reward per completed solo race", `soloReward`, `soloCooldownMs` in `sunset_racing/shared/config.lua`, the single central location; value unchanged). Hardened: payout requires server-measured race time >= route length / `soloMaxAvgSpeedMps` (75 m/s); otherwise withheld + logged `implausible_time`. Existing server checks kept (ordered checkpoints, driver seat, travel time, 20 s start spam guard, per-character cooldown). Cooldown is still in memory (a resource restart resets it; DB persistence not added). | sunset_racing/shared/config.lua, server/main.lua |
| 5 | **Balance flag 2, taxi vehicles**: `dynasty/rumpo/stretch/bus` are the grade-gated Cab Depot fleet in `sunset_core/shared/factions.lua`; `IsValidTaxiVehicle` already merges that fleet. So they are intended (docs/TAXI.md silent). `allowedVehicles` reduced to `{ 'taxi' }` (duplicates and the non-existent `taxiold` removed); accepted set is unchanged. Source of truth = faction depot fleet. | sunset_taxi/shared/config.lua |
| 6 | **Restart safety**: taxi server `onResourceStop` cancels all live rides (no fare charged on cancel), stops meters, ends framework sessions; taxi client hides the taxi meter on stop. | sunset_taxi/server/main.lua, client/main.lua |
| 7 | **Regression guard** `scripts/test-jobs-authority.js` (107 checks): no net event/callback in the 5 resources takes a reward-like param (taxi tip allowlisted: server-clamped, one per ride, moves passenger money); direct `AddMoney` in sunset_jobs only for refunds or reviewed payouts; courier/garbage/trucker payouts under `SunsetJobs_WithLock`; wreck-fail wiring; onResourceStop in every job/resource file; shared fish table; racing time check; taxi list. | scripts/test-jobs-authority.js |

## Verified already (no change needed)
Fisherman: server challenge token/timing, one fish per cast. Hunter/Diver: server health/zone/token checks, cleanup via `serverSessionEnded` + onResourceStop. Sessions: playerDropped, downed, jailed, resource stop. playerDropped deletes session vehicles; downed/jailed delete entities and FAIL the session. Sessions are never resumable after reconnect (memory only, removed on drop).

## Static checks
check-lua-syntax 424/424 OK; check-lua-forward-refs: 0 in my domain (1 in sunset_factions/server/main.lua:433 belongs to another agent, plus third-party ox_*); check-nui-bridge OK; check-locales 0 problems; check-locale-usage OK; check-manifests 0 missing; test-jobs-authority 107/0.
Known gap: the two new racing notify strings and the monitor's failure reason are English literals like their neighbours (not moved to the locale layer).

## VERIFIED-STATIC vs REQUIRES LIVE TEST
Everything above is static. Not verifiable without a server: `GetEntityHealth`/`GetVehicleEngineHealth` on a networked vehicle from the server after the owner destroys it; the 75 m/s solo threshold.

### Live tests
1. **Courier destroy-van**: /work courier, load 6 parcels, deliver stop 1 (+$90 expected), destroy the van (explode/RPG). Within ~10 s expect shift fails, no more pay, van entity gone, HUD card cleared. Also try delivering on foot to stop 2 right after the wreck: must be refused / shift already cancelled.
2. Same for Garbage (wreck truck mid-route, no unload bonus) and Trucker (wreck truck, no delivery pay).
3. Trucker: spam `trucker:deliver` (two clients/macros): exactly one payout.
4. `restart sunset_jobs` mid Courier/Trucker: van/trailer deleted, no NUI focus stuck, HUD card gone; `/work` starts a fresh single mission with no payout. `restart sunset_ui` mid job: no stuck focus; JobHud card re-sent on next objective update.
5. Taxi: `restart sunset_taxi` during a ride: both parties notified, no charge, meter hidden.
6. Fish: sell the same fish at Billy Ray, 24/7 and Fish Buyer, compare per-unit values (same ranges; jobs buyer x1.15).
7. Solo race: finish legit (reward once, 2nd within 5 min "cooldown"); verify a normal fast lap is not flagged `implausible_time` in server console.
8. Disconnect mid-job, reconnect: no resumable session, no orphan vehicle.
