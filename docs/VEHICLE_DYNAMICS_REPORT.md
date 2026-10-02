# Vehicle Dynamics & Canonical Handling Architecture Report

**Generated:** 2026-10-02T20:32:30.440Z
**Repository:** `trencito42/newrpg`
**Resource:** `resources/[sunset]/sunset_vehicle_dynamics`

---

## 1. Executive Summary & Inventory

| Metric | Count | Description |
| :--- | :--- | :--- |
| **Vanilla Explicit Profiles** | `35` | Core GTA V road vehicles used in dealership, jobs, civilian gameplay |
| **Addon Discovered Models** | `179` | Total vehicle models discovered across `vehicles.meta` packs in repo |
| **Addon Explicit Profiles** | `151` | Dedicated calibrated civilian addon profiles |
| **Emergency Fleet Profiles** | `39` | 11 vanilla police/emergency + 28 addon emergency vehicles |
| **Total Explicit Profiles** | `225` | 100% managed with calibrated canonical profiles |
| **Fallback-Only Addon Cars** | `0` | Zero normal addon cars left unmanaged |
| **Orphan Profiles Removed** | `18` | Nonexistent fantasy model names removed from codebase |

---

## 2. Handling Pipeline Architecture

```
GTA / Addon raw meta handling
            ↓
sunset_vehicle_dynamics Canonical Realistic Baseline
            ↓
sunset_tuning Queries Canonical Baseline (exports.sunset_vehicle_dynamics:GetCanonicalBaseline)
            ↓
ECU Stages / Hardware / Power Multipliers layered on top
            ↓
Temporary gameplay modifiers (nitrous, tire damage, weather)
```

- **Idempotent Tuning**: `sunset_tuning` always restores the canonical realistic baseline before computing tune stage multipliers.
- **Stock Restoration**: Removing ECU or resetting a vehicle restores the RACKET realistic baseline (not Rockstar original).
- **Zero Double-Stacking**: Reapplying a tune multiple times produces the exact same handling values.

---

## 3. Old Police Handling Migration

All legacy configurations from `sunset_police_handling` have been consolidated into `shared/profiles_emergency.lua`:

| Model | Former Handling | Canonical Profile | Drivetrain | Mass | Calibration Focus |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`police`** | `POLICE` | `emergency_sedan` | RWD | 1750 kg | Heavy V8 cruiser, high highway stability, firm anti-roll |
| **`police2`** | `POLICE2` | `emergency_sedan` | RWD | 1800 kg | Pursuit interceptor, higher torque & top flat velocity |
| **`police3`** | `POLICE3` | `emergency_sedan` | AWD | 1820 kg | TT EcoBoost AWD, superior corner exit & traction |
| **`police4`** | `POLICE4` | `emergency_sedan` | RWD | 1720 kg | Unmarked Stanier, balanced patrol dynamics |
| **`sheriff`** | `SHERIFF` | `emergency_sedan` | RWD | 1760 kg | County cruiser, rugged suspension compliance |
| **`sheriff2`** | `SHERIFF2` | `emergency_suv` | AWD | 2650 kg | Fullsize SUV, high COM, heavy off-road chassis |
| **`fbi`** | `FBI` | `emergency_sedan` | RWD | 1800 kg | Federal tactical interceptor |
| **`fbi2`** | `FBI2` | `emergency_suv` | AWD | 2650 kg | Federal armored tactical SUV |
| **`ambulance`** | `AMBULANCE` | `van` | RWD | 3800 kg | Commercial EMS chassis, extended braking distance |
| **`firetruk`** | `FIRETRUK` | `commercial_heavy` | RWD | 8500 kg | Heavy fire apparatus, high mass, powerful air-brakes |

---

## 4. Full Discovered Addon Vehicle Inventory

| Model | Source Resource | Archetype | Drivetrain | Mass | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `tol22m5` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tol240sx` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolc7` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `compact_fwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolcharger2` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolcurus` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `offroad` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `toldemon` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `muscle_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `toldurus` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `offroad` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tole36prb` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sedan_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tole36v` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `offroad` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tole6314` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolevo9` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `compact_fwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tol3j50` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolexor` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `compact_fwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolf360` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolf8spider` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolfxxk` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolgtam21` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolgtr` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `compact_fwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolgtrlw` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `compact_fwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolka` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tollam2` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tollwalk458` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `compact_fwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tol675ltsp` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolm5cs22` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolm5e60` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolm6x6` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolmig` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `compact_fwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolmm6x6` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolmus2` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolmustan` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `muscle_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolmustang` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `compact_fwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolpeigerzen` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolr33` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `compact_fwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tol700` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolr8c` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolr8v10` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `compact_fwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolraid` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `offroad` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolraptorv2` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolrrmansory` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolrs5` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `compact_fwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolrs6` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolrs7c821` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolrsurus` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `offroad` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tols63amg` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tola6` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `sports_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolap2` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `compact_fwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolaudidy` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolbt62r` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `tolc63` | `resources/[cars]/pitd_tol_car_pack_a/vehicles.meta` | `super_rwd` | `FWD` | 1800 kg | ✅ Explicit Profile |
| `abfbuff` | `resources/[cars]/showcasecars/data/abfbuff/vehicles.meta` | `super_rwd` | `RWD` | 1600 kg | ✅ Explicit Profile |
| `ballvenm` | `resources/[cars]/showcasecars/data/ballvenm/vehicles.meta` | `suv_awd` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `ballvmark` | `resources/[cars]/showcasecars/data/ballvmark/vehicles.meta` | `emergency_sedan` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `briosoav` | `resources/[cars]/showcasecars/data/briosoav/vehicles.meta` | `sports_rwd` | `AWD` | 1250 kg | ✅ Explicit Profile |
| `cazador` | `resources/[cars]/showcasecars/data/cazador/vehicles.meta` | `sports_awd` | `AWD` | 1380 kg | ✅ Explicit Profile |
| `cazadortcr` | `resources/[cars]/showcasecars/data/cazadortcr/vehicles.meta` | `sports_awd` | `AWD` | 1380 kg | ✅ Explicit Profile |
| `clubc` | `resources/[cars]/showcasecars/data/clubc/vehicles.meta` | `compact_fwd` | `FWD` | 950 kg | ✅ Explicit Profile |
| `clubp` | `resources/[cars]/showcasecars/data/clubp/vehicles.meta` | `compact_fwd` | `FWD` | 950 kg | ✅ Explicit Profile |
| `clubr` | `resources/[cars]/showcasecars/data/clubr/vehicles.meta` | `sports_awd` | `AWD` | 1540 kg | ✅ Explicit Profile |
| `clubrhyc` | `resources/[cars]/showcasecars/data/clubrhyc/vehicles.meta` | `sports_awd` | `AWD` | 1540 kg | ✅ Explicit Profile |
| `cometnor` | `resources/[cars]/showcasecars/data/cometnor/vehicles.meta` | `sports_rwd` | `RWD` | 1550 kg | ✅ Explicit Profile |
| `cometven` | `resources/[cars]/showcasecars/data/cometven/vehicles.meta` | `sports_rwd` | `RWD` | 1550 kg | ✅ Explicit Profile |
| `coquettepiston` | `resources/[cars]/showcasecars/data/coquettepiston/vehicles.meta` | `sports_rwd` | `RWD` | 1420 kg | ✅ Explicit Profile |
| `coqvenm` | `resources/[cars]/showcasecars/data/coqvenm/vehicles.meta` | `sports_rwd` | `RWD` | 1600 kg | ✅ Explicit Profile |
| `dawn` | `resources/[cars]/showcasecars/data/dawn/vehicles.meta` | `super_awd` | `AWD` | 1400 kg | ✅ Explicit Profile |
| `drafthyc` | `resources/[cars]/showcasecars/data/drafthyc/vehicles.meta` | `sports_awd` | `AWD` | 1650 kg | ✅ Explicit Profile |
| `draftven` | `resources/[cars]/showcasecars/data/draftven/vehicles.meta` | `sports_awd` | `AWD` | 1650 kg | ✅ Explicit Profile |
| `draftvmark` | `resources/[cars]/showcasecars/data/draftvmark/vehicles.meta` | `emergency_sedan` | `AWD` | 1650 kg | ✅ Explicit Profile |
| `dubmono` | `resources/[cars]/showcasecars/data/dubmono/vehicles.meta` | `super_awd` | `AWD` | 1800 kg | ✅ Explicit Profile |
| `elegyxa19` | `resources/[cars]/showcasecars/data/elegyxa19/vehicles.meta` | `sports_rwd` | `RWD` | 1710 kg | ✅ Explicit Profile |
| `elegyxa19ven` | `resources/[cars]/showcasecars/data/elegyxa19ven/vehicles.meta` | `sports_rwd` | `RWD` | 1710 kg | ✅ Explicit Profile |
| `flashgrs` | `resources/[cars]/showcasecars/data/flashgrs/vehicles.meta` | `sports_awd` | `AWD` | 1200 kg | ✅ Explicit Profile |
| `flattruckm` | `resources/[cars]/showcasecars/data/flattruckm/vehicles.meta` | `van` | `RWD` | 2800 kg | ✅ Explicit Profile |
| `gaterback` | `resources/[cars]/showcasecars/data/gaterback/vehicles.meta` | `sports_rwd` | `RWD` | 1600 kg | ✅ Explicit Profile |
| `gazatar` | `resources/[cars]/showcasecars/data/gazatar/vehicles.meta` | `sports_rwd` | `FWD` | 1380 kg | ✅ Explicit Profile |
| `hweevil` | `resources/[cars]/showcasecars/data/hweevil/vehicles.meta` | `sports_rwd` | `AWD` | 820 kg | ✅ Explicit Profile |
| `hycadetail` | `resources/[cars]/showcasecars/data/hycadetail/vehicles.meta` | `super_rwd` | `RWD` | 1600 kg | ✅ Explicit Profile |
| `hycbansh` | `resources/[cars]/showcasecars/data/hycbansh/vehicles.meta` | `sports_rwd` | `RWD` | 1550 kg | ✅ Explicit Profile |
| `hycbuff` | `resources/[cars]/showcasecars/data/hycbuff/vehicles.meta` | `super_rwd` | `RWD` | 1600 kg | ✅ Explicit Profile |
| `hycdeity` | `resources/[cars]/showcasecars/data/hycdeity/vehicles.meta` | `super_awd` | `AWD` | 1710 kg | ✅ Explicit Profile |
| `hycenty` | `resources/[cars]/showcasecars/data/hycenty/vehicles.meta` | `super_rwd` | `RWD` | 1420 kg | ✅ Explicit Profile |
| `hycgaunt` | `resources/[cars]/showcasecars/data/hycgaunt/vehicles.meta` | `sports_rwd` | `RWD` | 1800 kg | ✅ Explicit Profile |
| `hycignus` | `resources/[cars]/showcasecars/data/hycignus/vehicles.meta` | `super_awd` | `AWD` | 1600 kg | ✅ Explicit Profile |
| `hycpargn` | `resources/[cars]/showcasecars/data/hycpargn/vehicles.meta` | `sports_awd` | `AWD` | 1800 kg | ✅ Explicit Profile |
| `hycr300` | `resources/[cars]/showcasecars/data/hycr300/vehicles.meta` | `sports_rwd` | `RWD` | 1590 kg | ✅ Explicit Profile |
| `hycsedan` | `resources/[cars]/showcasecars/data/hycsedan/vehicles.meta` | `sedan_awd` | `AWD` | 1800 kg | ✅ Explicit Profile |
| `hycwagen` | `resources/[cars]/showcasecars/data/hycwagen/vehicles.meta` | `super_rwd` | `RWD` | 1860 kg | ✅ Explicit Profile |
| `hyczr350` | `resources/[cars]/showcasecars/data/hyczr350/vehicles.meta` | `sports_rwd` | `RWD` | 1234 kg | ✅ Explicit Profile |
| `issiwider` | `resources/[cars]/showcasecars/data/issiwider/vehicles.meta` | `sports_awd` | `AWD` | 1000 kg | ✅ Explicit Profile |
| `jestvenm` | `resources/[cars]/showcasecars/data/jestvenm/vehicles.meta` | `sports_rwd` | `RWD` | 1575 kg | ✅ Explicit Profile |
| `jubven` | `resources/[cars]/showcasecars/data/jubven/vehicles.meta` | `super_awd` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `kcjub` | `resources/[cars]/showcasecars/data/kcjub/vehicles.meta` | `super_awd` | `AWD` | 1400 kg | ✅ Explicit Profile |
| `komtmark` | `resources/[cars]/showcasecars/data/komtmark/vehicles.meta` | `super_awd` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `komtour` | `resources/[cars]/showcasecars/data/komtour/vehicles.meta` | `super_rwd` | `RWD` | 1575 kg | ✅ Explicit Profile |
| `kurxa19` | `resources/[cars]/showcasecars/data/kurxa19/vehicles.meta` | `sports_awd` | `AWD` | 1500 kg | ✅ Explicit Profile |
| `kurxmark` | `resources/[cars]/showcasecars/data/kurxmark/vehicles.meta` | `emergency_sedan` | `AWD` | 1500 kg | ✅ Explicit Profile |
| `neonvenm` | `resources/[cars]/showcasecars/data/neonvenm/vehicles.meta` | `sports_awd` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `paragonven` | `resources/[cars]/showcasecars/data/paragonven/vehicles.meta` | `sports_awd` | `AWD` | 2415 kg | ✅ Explicit Profile |
| `parawide` | `resources/[cars]/showcasecars/data/parawide/vehicles.meta` | `sports_awd` | `AWD` | 2315 kg | ✅ Explicit Profile |
| `parawmark` | `resources/[cars]/showcasecars/data/parawmark/vehicles.meta` | `emergency_suv` | `AWD` | 2315 kg | ✅ Explicit Profile |
| `remusx` | `resources/[cars]/showcasecars/data/remusx/vehicles.meta` | `sports_rwd` | `RWD` | 1105 kg | ✅ Explicit Profile |
| `rhinea19x` | `resources/[cars]/showcasecars/data/rhinea19x/vehicles.meta` | `sedan_awd` | `AWD` | 1660 kg | ✅ Explicit Profile |
| `rsxven` | `resources/[cars]/showcasecars/data/rsxven/vehicles.meta` | `sports_awd` | `AWD` | 1600 kg | ✅ Explicit Profile |
| `rt3000varis` | `resources/[cars]/showcasecars/data/rt3000varis/vehicles.meta` | `sports_rwd` | `RWD` | 1275 kg | ✅ Explicit Profile |
| `rt3kavan` | `resources/[cars]/showcasecars/data/rt3kavan/vehicles.meta` | `sports_rwd` | `RWD` | 1275 kg | ✅ Explicit Profile |
| `rwagvenm` | `resources/[cars]/showcasecars/data/rwagvenm/vehicles.meta` | `super_rwd` | `RWD` | 1234 kg | ✅ Explicit Profile |
| `schlag` | `resources/[cars]/showcasecars/data/schlag/vehicles.meta` | `sports_rwd` | `RWD` | 1550 kg | ✅ Explicit Profile |
| `sedanwid` | `resources/[cars]/showcasecars/data/sedanwid/vehicles.meta` | `sedan_awd` | `AWD` | 1650 kg | ✅ Explicit Profile |
| `shenron` | `resources/[cars]/showcasecars/data/shenron/vehicles.meta` | `suv_awd` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `sitavenm` | `resources/[cars]/showcasecars/data/sitavenm/vehicles.meta` | `sports_rwd` | `RWD` | 1543 kg | ✅ Explicit Profile |
| `sr8` | `resources/[cars]/showcasecars/data/sr8/vehicles.meta` | `suv_awd` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `sr8elem` | `resources/[cars]/showcasecars/data/sr8elem/vehicles.meta` | `suv_awd` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `srspback` | `resources/[cars]/showcasecars/data/srspback/vehicles.meta` | `sports_awd` | `AWD` | 1600 kg | ✅ Explicit Profile |
| `str` | `resources/[cars]/showcasecars/data/str/vehicles.meta` | `super_rwd` | `RWD` | 1575 kg | ✅ Explicit Profile |
| `strcoupe` | `resources/[cars]/showcasecars/data/strcoupe/vehicles.meta` | `sports_rwd` | `RWD` | 2315 kg | ✅ Explicit Profile |
| `strman` | `resources/[cars]/showcasecars/data/strman/vehicles.meta` | `super_rwd` | `RWD` | 1575 kg | ✅ Explicit Profile |
| `strmark` | `resources/[cars]/showcasecars/data/strmark/vehicles.meta` | `super_rwd` | `RWD` | 1575 kg | ✅ Explicit Profile |
| `strwag` | `resources/[cars]/showcasecars/data/strwag/vehicles.meta` | `super_rwd` | `RWD` | 1575 kg | ✅ Explicit Profile |
| `strwagmark` | `resources/[cars]/showcasecars/data/strwagmark/vehicles.meta` | `super_awd` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `sugoix` | `resources/[cars]/showcasecars/data/sugoix/vehicles.meta` | `sports_rwd` | `RWD` | 1500 kg | ✅ Explicit Profile |
| `sultlong` | `resources/[cars]/showcasecars/data/sultlong/vehicles.meta` | `sports_awd` | `AWD` | 1100 kg | ✅ Explicit Profile |
| `tailgatersr` | `resources/[cars]/showcasecars/data/tailgatersr/vehicles.meta` | `sports_rwd` | `RWD` | 1600 kg | ✅ Explicit Profile |
| `tailsr66` | `resources/[cars]/showcasecars/data/tailsr66/vehicles.meta` | `sports_rwd` | `RWD` | 1600 kg | ✅ Explicit Profile |
| `tailstmk` | `resources/[cars]/showcasecars/data/tailstmk/vehicles.meta` | `sports_rwd` | `RWD` | 1600 kg | ✅ Explicit Profile |
| `temphyc` | `resources/[cars]/showcasecars/data/temphyc/vehicles.meta` | `super_awd` | `AWD` | 1234 kg | ✅ Explicit Profile |
| `temptwins` | `resources/[cars]/showcasecars/data/temptwins/vehicles.meta` | `super_awd` | `AWD` | 1234 kg | ✅ Explicit Profile |
| `tenfhyc` | `resources/[cars]/showcasecars/data/tenfhyc/vehicles.meta` | `sports_rwd` | `RWD` | 1300 kg | ✅ Explicit Profile |
| `tenfvenm` | `resources/[cars]/showcasecars/data/tenfvenm/vehicles.meta` | `sports_rwd` | `RWD` | 1300 kg | ✅ Explicit Profile |
| `thraxven` | `resources/[cars]/showcasecars/data/thraxven/vehicles.meta` | `super_awd` | `AWD` | 1960 kg | ✅ Explicit Profile |
| `toroslbwk` | `resources/[cars]/showcasecars/data/toroslbwk/vehicles.meta` | `sports_rwd` | `RWD` | 1600 kg | ✅ Explicit Profile |
| `torosven` | `resources/[cars]/showcasecars/data/torosven/vehicles.meta` | `super_awd` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `tragambo` | `resources/[cars]/showcasecars/data/tragambo/vehicles.meta` | `emergency_sedan` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `trager` | `resources/[cars]/showcasecars/data/trager/vehicles.meta` | `sports_awd` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `tragmech` | `resources/[cars]/showcasecars/data/tragmech/vehicles.meta` | `emergency_sedan` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `tragpd` | `resources/[cars]/showcasecars/data/tragpd/vehicles.meta` | `emergency_sedan` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `turisgt3` | `resources/[cars]/showcasecars/data/turisgt3/vehicles.meta` | `super_rwd` | `RWD` | 1435 kg | ✅ Explicit Profile |
| `verusreg` | `resources/[cars]/showcasecars/data/verusreg/vehicles.meta` | `offroad` | `AWD` | 1200 kg | ✅ Explicit Profile |
| `xlsstr` | `resources/[cars]/showcasecars/data/xlsstr/vehicles.meta` | `suv_awd` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `zentven` | `resources/[cars]/showcasecars/data/zentven/vehicles.meta` | `super_awd` | `AWD` | 1500 kg | ✅ Explicit Profile |
| `zr350piston` | `resources/[cars]/showcasecars/data/zr350piston/vehicles.meta` | `sports_rwd` | `RWD` | 1300 kg | ✅ Explicit Profile |
| `briosoxpd` | `resources/[cars]/showcasecars2/data/briosoxpd/vehicles.meta` | `emergency_sedan` | `AWD` | 1250 kg | ✅ Explicit Profile |
| `carrion` | `resources/[cars]/showcasecars2/data/carrion/vehicles.meta` | `sports_awd` | `AWD` | 1380 kg | ✅ Explicit Profile |
| `carrionmech` | `resources/[cars]/showcasecars2/data/carrionmech/vehicles.meta` | `emergency_sedan` | `AWD` | 1380 kg | ✅ Explicit Profile |
| `carrionpd` | `resources/[cars]/showcasecars2/data/carrionpd/vehicles.meta` | `emergency_sedan` | `AWD` | 1380 kg | ✅ Explicit Profile |
| `cazadorpd` | `resources/[cars]/showcasecars2/data/cazadorpd/vehicles.meta` | `emergency_sedan` | `AWD` | 1380 kg | ✅ Explicit Profile |
| `clubrpd` | `resources/[cars]/showcasecars2/data/clubrpd/vehicles.meta` | `emergency_sedan` | `AWD` | 1540 kg | ✅ Explicit Profile |
| `cyphx` | `resources/[cars]/showcasecars2/data/cyphx/vehicles.meta` | `sports_rwd` | `RWD` | 1625 kg | ✅ Explicit Profile |
| `dawnpd` | `resources/[cars]/showcasecars2/data/dawnpd/vehicles.meta` | `emergency_sedan` | `AWD` | 1400 kg | ✅ Explicit Profile |
| `flashgrspd` | `resources/[cars]/showcasecars2/data/flashgrspd/vehicles.meta` | `emergency_sedan` | `AWD` | 1200 kg | ✅ Explicit Profile |
| `hyctailpd` | `resources/[cars]/showcasecars2/data/hyctailpd/vehicles.meta` | `emergency_sedan` | `RWD` | 1600 kg | ✅ Explicit Profile |
| `jubvenpd` | `resources/[cars]/showcasecars2/data/jubvenpd/vehicles.meta` | `emergency_sedan` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `kanjoep4` | `resources/[cars]/showcasecars2/data/kanjoep4/vehicles.meta` | `compact_fwd` | `FWD` | 1150 kg | ✅ Explicit Profile |
| `kanjox` | `resources/[cars]/showcasecars2/data/kanjox/vehicles.meta` | `sports_rwd` | `AWD` | 1500 kg | ✅ Explicit Profile |
| `omnvenpd` | `resources/[cars]/showcasecars2/data/omnvenpd/vehicles.meta` | `emergency_sedan` | `AWD` | 1650 kg | ✅ Explicit Profile |
| `reblax` | `resources/[cars]/showcasecars2/data/reblax/vehicles.meta` | `super_awd` | `AWD` | 2185 kg | ✅ Explicit Profile |
| `reblaxpd` | `resources/[cars]/showcasecars2/data/reblaxpd/vehicles.meta` | `emergency_sedan` | `AWD` | 2185 kg | ✅ Explicit Profile |
| `rhinea19xpd` | `resources/[cars]/showcasecars2/data/rhinea19xpd/vehicles.meta` | `emergency_sedan` | `AWD` | 1660 kg | ✅ Explicit Profile |
| `schlagpd` | `resources/[cars]/showcasecars2/data/schlagpd/vehicles.meta` | `emergency_sedan` | `RWD` | 1550 kg | ✅ Explicit Profile |
| `sen5tour` | `resources/[cars]/showcasecars2/data/sen5tour/vehicles.meta` | `sports_rwd` | `RWD` | 1870 kg | ✅ Explicit Profile |
| `sen5tourhyc` | `resources/[cars]/showcasecars2/data/sen5tourhyc/vehicles.meta` | `sports_rwd` | `RWD` | 1870 kg | ✅ Explicit Profile |
| `sent5bxane` | `resources/[cars]/showcasecars2/data/sent5bxane/vehicles.meta` | `sports_rwd` | `RWD` | 1870 kg | ✅ Explicit Profile |
| `sent5hyc` | `resources/[cars]/showcasecars2/data/sent5hyc/vehicles.meta` | `sports_rwd` | `RWD` | 1870 kg | ✅ Explicit Profile |
| `sent5wide` | `resources/[cars]/showcasecars2/data/sent5wide/vehicles.meta` | `sports_rwd` | `RWD` | 1870 kg | ✅ Explicit Profile |
| `shenronpd` | `resources/[cars]/showcasecars2/data/shenronpd/vehicles.meta` | `emergency_sedan` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `sr8pd` | `resources/[cars]/showcasecars2/data/sr8pd/vehicles.meta` | `emergency_sedan` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `srhatpd` | `resources/[cars]/showcasecars2/data/srhatpd/vehicles.meta` | `emergency_sedan` | `AWD` | 1600 kg | ✅ Explicit Profile |
| `strcoupepd` | `resources/[cars]/showcasecars2/data/strcoupepd/vehicles.meta` | `emergency_suv` | `RWD` | 2315 kg | ✅ Explicit Profile |
| `sultlpd` | `resources/[cars]/showcasecars2/data/sultlpd/vehicles.meta` | `emergency_sedan` | `AWD` | 1100 kg | ✅ Explicit Profile |
| `taurion` | `resources/[cars]/showcasecars2/data/taurion/vehicles.meta` | `suv_awd` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `taurionpd` | `resources/[cars]/showcasecars2/data/taurionpd/vehicles.meta` | `emergency_sedan` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `tenfhycpd` | `resources/[cars]/showcasecars2/data/tenfhycpd/vehicles.meta` | `emergency_sedan` | `RWD` | 1300 kg | ✅ Explicit Profile |
| `uranusx` | `resources/[cars]/showcasecars2/data/uranusx/vehicles.meta` | `sports_rwd` | `RWD` | 1240 kg | ✅ Explicit Profile |
| `varx` | `resources/[cars]/showcasecars2/data/varx/vehicles.meta` | `motorcycle_sport` | `RWD` | 1200 kg | ✅ Explicit Profile |
| `xlsstrpd` | `resources/[cars]/showcasecars2/data/xlsstrpd/vehicles.meta` | `emergency_sedan` | `AWD` | 2000 kg | ✅ Explicit Profile |
| `tempesta2` | `resources/[sunset]/sunset_addon_vehicles/vehicles.meta` | `super_awd` | `AWD` | 1422 kg | ✅ Explicit Profile |
| `sentinel_rts` | `resources/[sunset]/sunset_addon_vehicles/vehicles.meta` | `super_rwd` | `RWD` | 1200 kg | ✅ Explicit Profile |
| `d7cyp` | `resources/[sunset]/sunset_addon_vehicles/vehicles.meta` | `sedan_rwd` | `RWD` | 1400 kg | ✅ Explicit Profile |
| `schlagenstr` | `resources/[sunset]/sunset_addon_vehicles/vehicles.meta` | `sports_rwd` | `RWD` | 1450 kg | ✅ Explicit Profile |
| `cometcup` | `resources/[sunset]/sunset_addon_vehicles/vehicles.meta` | `sports_rwd` | `RWD` | 1290 kg | ✅ Explicit Profile |
| `h4rxst2` | `resources/[sunset]/sunset_addon_vehicles/vehicles.meta` | `sports_rwd` | `RWD` | 1800 kg | ✅ Explicit Profile |
