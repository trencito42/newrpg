# IMPL_CASINO - casino server authority

Goal: the client never chooses a result, layout, payout, multiplier or jackpot. Closes SECURITY_AUDIT_2 open item "slots outcome computed in NUI".

## Shared helper (new)
`sunset_casino/shared/rng.lua` (included by server_scripts of slots, blackjack, roulette, luckywheel, economy, casino):
- `CasinoRNG.Int/Shuffle/Weighted/Token/IsInt`: reads /dev/urandom with rejection sampling (no modulo bias); fallback is math.random re-seeded per call from os.time/os.clock/GetGameTimer/counter (logs a warning once).
- `CasinoLog.Record`: audit row in `casino_log` (sql/69-casino-log.sql, also lazily created) plus server log line, for every spin/settle/refund/forfeit.
- `CasinoPending`: chips owed that could not be delivered (player gone, char changed, inventory refusal) persisted in `casino_pending_chips`; claimed exactly once (`UPDATE ... SET claimed=1 WHERE id=? AND claimed=0`) on the next slots session or `sunset:casino:status` call.

## Slots (sunset_slots) - full rewrite of the authority model
- Client NUI only posts `spin{bet}`, `collect`, `gamble{color}`, `exitWith`. Removed events `PayOutRewards`, `BetsAndMoney`, `takePlace`, NUI `sendHook`.
- Server (server.lua): per-player session (seat reservation, proximity <=6m to the configured machine, valid char). Chips (<=25000) are taken at sit via inventory RemoveItem (single conditional `UPDATE ... count >= ?`); the balance is then server memory.
- Spin: rotating 16-hex token (rejects replay/double-click), `busy` flag, min 2000 ms interval, bet must be an integer in the allowed list `{50..300 step 50}`, must be <= balance, no pending win. Debit, RNG grid, payline evaluation and pending win are one non-yielding step. Client receives grid (symbols per cell), win lines for highlight, balance, new token; it animates only.
- Gamble (red/black): server draws; fair 50/50, max 4 doubles then auto-collect, disabled above 700.
- Settlement: `CloseSession` is the only place chips return to the inventory (exit/leave/drop/resource stop); session is removed before any yielding call so it cannot pay twice. Failure -> `casino_pending_chips`.
- Config: `sunset_slots/server_config.lua` is the ONE paytable (weights, multipliers, bonus, limits).
- RTP: original NUI logic simulated at ~74.8% (it double-counted overlapping lines); the server evaluator uses maximal runs (no duplicates) with symbol weights derived from the original generator: ~73% base game. Gamble is RTP neutral. Not rebalanced further.
- Client: tryPlay returns `{balance, token}`; result animation maps server grid onto ring cells (seed >=3 cells away from previous so no visible swap).

## Blackjack (sunset_blackjack)
- Bets must be in `bettingNums` (x10 variant) and >50000 only on high-stakes tables; floats/NaN rejected; no bets once cards dealt (fixed chips destroyed when betting mid-round); per-seat betting lock across the yielding chip removal.
- Sit-down needs proximity (8m) and a char. CSPRNG shuffle.
- Double/split only as first decision on unsplit 2-card hand (split needs equal card values) - previously client could request them anytime.
- Settlement rewritten as one per-hand function (marks `settled` before paying): fixes busted split hand counted as win, split paid 4x when one hand lost, natural blackjack paid instantly even vs dealer blackjack (now push), dealer blackjack vs player 21.
- `PlayerRemove` no longer refunds mid-hand (previously abandon a losing hand for full refund). Leave/drop before deal = refund; mid-hand = forfeit (logged). Resource stop refunds every unresolved stake once. All credits via `GiveMoney` with pending fallback. No insurance feature exists in this resource.

## Roulette (sunset_roulette)
Bets already collected before result (SEC2). Added: min 10 / max 50000 per bet, 200000 total, 40 lines, CSPRNG result, escrow table so a resource stop refunds charged stakes, payout verified against the same character (else pending), exactly-once settle, localized notifications.

## Lucky wheel (sunset_luckywheel, sunset_casino wheel)
Lock taken before any yielding call (race allowed two spins), CSPRNG, cooldown persisted in `casino_wheel_cooldown` (atomic upsert in sunset_casino; fail-closed in luckywheel), offline-at-prize or stop -> stake refunded to pending (cooldown stays), localized.

## sunset_casino (older NUI casino)
Strict integer bets, CSPRNG, blackjack start lock, blackjack dealer-BJ rule, payouts via `settleChips`, forfeit on drop, refund on stop, audit log.

## Economy
Dice: integer-only target/bet, CSPRNG, win log (escrow already existed). Lottery: already transactional; draw number now CSPRNG.

## Guards / tests
`node scripts/test-casino-authority.js`: handler params contain no payout/result/win/etc; chip credits only in settle functions; no math.random in gameplay; slots RTP from server_config.lua (72.9%). Also run check-lua-syntax (428 OK), check-locales (0), check-locale-usage, check-manifests, check-nui-bridge, `node --check sunset_slots/html/script.js`.

## Limits / needs live FiveM test
VERIFIED-STATIC only; nothing executed in-game.
- Hard server crash mid-session: slot session chips (<=25000) and in-flight roulette/wheel stakes are lost (no stop handler runs). Resource restart is covered.
- REQUIRES LIVE TEST: slot reel landing on server grid + win highlight, gamble flow, exit/ESC mid-spin, disconnect mid-session -> pending claim; blackjack settlement incl. split/double/natural; roulette timing; wheel cooldown persistence; `/dev/urandom` availability in container; new tables creation permissions; `@sunset_casino/shared/rng.lua` include resolving in each resource.
- Casino chips are inventory items, not an account: "atomic" debit = inventory conditional UPDATE; no money_transactions rows (account enum is cash/bank) - casino_log used instead.
- Blackjack allowed bets reuse client `bettingNums`; max for low tables is 50000 (previously effectively unlimited).
