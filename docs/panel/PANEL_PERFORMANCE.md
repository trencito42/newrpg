# Panel performance notes

`getCurrentSession()` is request-memoized and writes `last_active_at` only when the prior timestamp is at least ten minutes old. The public header still loads a selected account's characters when signed in; this is not publicly cached. `getServerStatus()` performs one indexed snapshot lookup rather than a network request per render. The FiveM resource writes one snapshot row every 15 seconds by default.

Poll votes rely on `UNIQUE(poll_id, account_id)` and `fk_panel_vote_matching_option`. Public profile vehicle and property lists use indexed owner columns and are capped at 100 items per page; the displayed totals come from separate count queries. Query plans for those lookups should be rechecked after production data grows.

No throughput, latency or concurrent-user benchmark has been run. These are implementation observations, not measured performance guarantees. Heavy aggregate statistics on the landing page still scan game tables and need profiling/caching before a high-traffic launch.
