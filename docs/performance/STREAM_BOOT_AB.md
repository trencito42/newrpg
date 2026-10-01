# Streamed-content boot isolation

`CExtraContentWrapper` is an internal GTA/FiveM init function. The loadscreen
cannot identify a server resource from its timing or the last data-file event.
Use controlled, **staging-only** client boots to attribute any server cost.

Run `node scripts/audit-streamed-content.js` before each trial. It inventories
all streamed assets, SHA-256 duplicate files, size by resource, and invalid
`data_file` paths. Keep its output with the client boot summary.

Start with the normal staging configuration and the same client machine, GTA
build, cache policy, network, and graphics settings for every run. Record at
least three cold boots and three warm boots per variant. Record handoff time,
`loadProgress`, map load, `CExtraContentWrapper`, largest event gap, data-file
count and CEF frame gaps. Enable loadscreen diagnostics for the test client
with `localStorage.sunset_boot_verbose=1`; leave it off for players.

The independent content groups in `config/server.cfg.template` are:

| Group | `ensure` entries |
| --- | --- |
| Base | all normal gameplay resources except the groups below |
| IPL/interiors | `bob74_ipl` |
| Addon vehicles | `sunset_addon_vehicles`, `sunset_police_handling` |
| Maps/islands | `villa_island` |
| Casino audio/objects | `sunset_luckywheel` |

For each variant, remove only the corresponding `ensure` line(s) from a
**temporary staging config copy**. Do not alter production `server.cfg`, delete
assets, or run the repository deploy script against an unpushed worktree.
First boot base; then add one group at a time. If a group changes the median
`CExtraContentWrapper` materially, bisect inside that group with temporary
resource copies/manifests on staging. Repeated cold/warm measurements are
needed because GTA's own DLC loading and OS cache may dominate one boot.

In the current repository, addon vehicles are the largest group (~74 MiB).
There are byte-identical `.yft`/`.ytd` files with different model names; they
may be intentional aliases and must not be deleted without checking metadata
and a real spawn/visual test. No source-level measurement yet proves that they
cause the reported 12-second internal initialization.
