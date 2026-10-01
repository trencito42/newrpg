# 200-Player Load Testing & Benchmark Strategy

## Objective
Measure and validate FXServer tick rate, hitch frequency, MariaDB connection pool pressure, network payload bytes/sec, and client frame times under synthetic and representative player loads (48, 100, 150, 200 players).

---

## 1. Metrics & Key Performance Indicators (KPIs)

| Metric | Target (100 Players) | Target (200 Players) | Failure Threshold |
|---|---|---|---|
| **Server Tick Rate** | 20.0 Hz (50.0 ms) | 20.0 Hz (50.0 ms) | < 18.0 Hz sustained |
| **Server Hitch Time** | 0 ms > 100ms | < 1 hitch / 5 min (> 150ms) | Sustained > 250ms hitches |
| **DB Queries / Sec** | < 40 QPS steady-state | < 80 QPS steady-state | > 300 QPS synchronized bursts |
| **DB Slow Queries (>50ms)** | 0 slow queries | 0 slow queries | > 2 slow queries / min |
| **Server Lua Memory** | < 250 MB total | < 450 MB total | Unbounded growth (leak) |
| **Client Resmon Idle** | < 0.25 ms total custom | < 0.30 ms total custom | > 0.60 ms |
| **NUI CEF CPU Usage** | < 3% single core | < 5% single core | > 15% |

---

## 2. Load Testing Procedures

### Scenario A: Baseline Idle (50 / 100 / 200 Players)
1. Launch FXServer with `sv_maxclients 200`.
2. Connect simulated or automated client sessions.
3. Observe server tick rate and memory over a 30-minute window.
4. **Verification**: Verify staggered autosave worker operates evenly without DB spikes every 60s.

### Scenario B: High-Density Combat & Firefight Test
1. Place 30–50 players in a small radius (e.g. Legion Square or a Clan Turf).
2. Execute rapid automatic weapon fire across multiple targets.
3. **Verification**:
   - Confirm `weaponDamageEvent` victim resolution remains $O(1)$ without tick degradation.
   - Verify anticheat `damage_check` CPU overhead stays negligible.

### Scenario C: Concurrent UI Burst (Phone & Scoreboard)
1. Trigger simultaneous phone open and scoreboard open across 50 connected players.
2. **Verification**:
   - Inspect oxmysql query log: confirm only demand-driven `WHERE id IN (?)` avatar queries fire.
   - Verify scoreboard responses are served directly from the 2.5s snapshot cache.

### Scenario D: Mass Property Mutation
1. Execute multiple property buy/rent/lock transactions in rapid succession.
2. **Verification**:
   - Verify server cache invalidation occurs cleanly.
   - Verify clients stagger cache refresh without issuing 200 simultaneous SQL queries.

---

## 3. Server-Side Monitoring Commands

- **TXAdmin / FXServer Console**:
  ```bash
  resmon 1
  profiler record 300
  profiler status
  ```
- **Database Connection Status**:
  ```sql
  SHOW GLOBAL STATUS LIKE 'Threads_connected';
  SHOW GLOBAL STATUS LIKE 'Questions';
  SHOW PROCESSLIST;
  ```
- **Linux Process Diagnostics**:
  ```bash
  top -p $(pidof FXServer)
  ```
