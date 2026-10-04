# Economy progression audit

Numbers are the current source values. Durations that are not coded are marked as such.

## Activities

| Activity | Level | Pay | XP / respect | Cost | Comment |
| --- | --- | --- | --- | --- | --- |
| Courier | 1 + driver | $90 per package, typical 6 = $540 | job XP plus 2 respect when the shift completes | license $30, rental $500 | Best early cash. About 3–4 runs reach the $16,500 Blista with the story money. |
| Fisherman | 1 | sale price per kg in fish_prices.lua | job XP plus 2 respect | rod and bait from the shop | No license. First legal job. |
| Garbage | 1 + driver | $48 per bin, $120 unload | job XP plus 2 respect | license | Below courier. |
| Trucker | 1 + driver | $650–$900 by route and rank | job XP plus 2 respect, +4 on rank-up | fuel | Rank 1 routes exist. |
| Bus | 4 + driver | $120 per stop + $35 per passenger | job XP plus 2 respect | license | Mid early job. |
| Mechanic | 3 + driver | $160 per repair (`payPerRepair` in `jobs_config.lua`) | job XP plus 2 respect | license | |
| Diver | 6 | workplace payout in the job resource | job XP plus 2 respect | | |
| Hunter | 10 + weapon + hunting + range quest | hide/meat sale prices | job XP plus 2 respect | licenses and a legal hunting weapon | |
| Payday | any, 20 min played | bank payday minus 8% tax | +1 respect, and it advances license expiry | | Supplement, not the level engine. |
| Marketplace | 1 | seller receives price minus 5% | none | listing the asset | Fee is `MarketFeePercent`. Buy, transfer, and payout are one transaction. |

## Level purchase

| From | Respect | Money |
| --- | --- | --- |
| 1 to 3 | 12 | $3,000 |
| 1 to 5 | 40 | $10,000 |
| 1 to 10 | 180 | $45,000 |
| 10 to 15 | 240 more | $60,000 more |

A finished shift is 2 respect. Level 10 is about 76 shifts after the story rewards, roughly 8–15 hours. Level 15 is about 20 more hours of the same work.

## Assets

| Asset | Price | When it fits |
| --- | --- | --- |
| Driver exam | $30 | First session, from the $250 cash. |
| Starter rental | $500 | After the first fisherman or courier money. |
| Blista | $16,500 | After the $12,000 dedication reward and about four courier runs. |
| Level 1–10 | $45,000 | Same window as the shifts that earn the respect. |
| Hospital | $400 | A setback, not a softlock. |

## Not retuned

Job pay, quest cash, clan prices, and the dealership ladder were left as they are. The change that removed the payday wall is the shift and rank respect, plus the level cash cost moving from `level * 3000` to `level * 1000`.
