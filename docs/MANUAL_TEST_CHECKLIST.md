# Manual FiveM test checklist

Run with two FiveM clients where a scenario says A/B. Capture client F8 and FXServer logs.

## Boot and auth

- [ ] Loadscreen hands off exactly once to auth; no visible default ped, movement, flash, or stuck focus.
- [ ] Wrong password is generic; six rapid failures lock further attempts.
- [ ] Duplicate-case username and email registration are rejected.
- [ ] Male registration uses `a_m_m_bevhills_02`; female uses `u_f_y_taylor`.
- [ ] Password never appears in client/server logs or KVP.
- [ ] Stop DB, attempt login/register: connection does not receive a fake profile and UI reports safe failure.

## Tutorial/spawn

- [ ] First registration runs all scenes isolated, frozen, invisible, invincible, with no control.
- [ ] Disconnect mid-cinematic; reconnect restarts it.
- [ ] Finish cinematic; tutorial saves only afterward and subsequent login skips it.
- [ ] Spawn is directly at LSIA with correct model; collision is loaded before fade/control.
- [ ] Force invalid model in test DB; spawn fails protected with explicit feedback.

## Sessions/reconnect

- [ ] Login account on A, then on B: A saves/closes/drops before B becomes active.
- [ ] Disconnect/reconnect repeatedly; exactly one active DB session and one registry entry remain.
- [ ] Restart `rpg_core`; no ghost active session remains and clients cannot operate with stale authority.
- [ ] Compare playtime before/after graceful drop and server restart.

## Chat/commands

- [ ] T opens chat only after ACTIVE; auth/chat never own focus simultaneously.
- [ ] Up/down history works; Escape closes; movement does not occur while typing.
- [ ] HTML payload displays as text, never markup/script.
- [ ] Verify message length/rate feedback and global format `Username (ID): message`.
- [ ] `/asdasdasd`, denied command, missing args, offline ID, and handler error all give feedback.

## Admin

- [ ] Bootstrap owner through console, then test every command at levels 0-5.
- [ ] Hierarchy blocks equal/higher targets and unsafe self-targets.
- [ ] `/goto`, `/bring`, `/back` with either party in a vehicle and across buckets.
- [ ] Freeze cleanup when target drops, admin drops, and resource stops.
- [ ] Spectate off/target drop/admin drop/resource stop always restores visibility, invincibility, freeze, bucket, and coordinates.
- [ ] Warning/kick/ban/unban/setadmin rows and matching `admin_actions` exist.
- [ ] Temporary ban blocks before expiry and permits after expiry; permanent ban remains.
- [ ] Ban is enforced by account after login and by observed identifiers during connection.

## Stability soak

- [ ] 30-minute two-client soak with periodic save; no growing pending RPC/rate/focus/session tables.
- [ ] Restart each framework resource individually and inspect cleanup/recovery.
- [ ] Inspect `resmon`, server hitch warnings, DB slow-query output, and NUI console.
- [ ] Confirm `bob74_ipl` starts without missing dependencies or map collision warnings.

