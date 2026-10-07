# Vehicle physics audit

Generated deterministically from `scripts/vehicle-physics/catalog.js` and repository metadata. GTA's `fInitialDriveMaxFlatVel` is stored as a handling parameter; `targetTopSpeedKmh` is the gameplay design target used to derive it.

- Total deliberate profiles: **259**
- Vanilla/configured road vehicles: **65**
- Addon civilian vehicles: **147**
- Emergency/faction vehicles: **47**
- Uncertain identities: **15**

## Tier distribution

- utility_slow: 3
- commercial: 16
- economy: 3
- civilian: 15
- warm: 24
- sport: 19
- sport_high: 54
- performance_sedan: 22
- super: 25
- hyper: 7
- performance_suv: 16
- offroad: 10
- pursuit: 29
- pursuit_suv: 14
- motorcycle: 2

## Genuinely uncertain models

- `clubr`: Unidentified addon road vehicle; source `resources/[cars]/showcasecars/data/clubr`.
- `clubrhyc`: Unidentified addon road vehicle; source `resources/[cars]/showcasecars/data/clubrhyc`.
- `clubrpd`: Unidentified addon road vehicle emergency fleet variant; source `resources/[cars]/showcasecars2/data/clubrpd`.
- `parawmark`: Unidentified addon road vehicle emergency fleet variant; source `resources/[cars]/showcasecars/data/parawmark`.
- `sedanwid`: Unidentified addon road vehicle; source `resources/[cars]/showcasecars/data/sedanwid`.
- `srhatpd`: Unidentified addon road vehicle emergency fleet variant; source `resources/[cars]/showcasecars2/data/srhatpd`.
- `str`: Unidentified addon sports car; source `resources/[cars]/showcasecars/data/str`.
- `strman`: Unidentified addon sports car; source `resources/[cars]/showcasecars/data/strman`.
- `strmark`: Unidentified addon road vehicle emergency fleet variant; source `resources/[cars]/showcasecars/data/strmark`.
- `tol3j50`: Unidentified addon supercar; source `resources/[cars]/pitd_tol_car_pack_a`.
- `tol700`: Unidentified addon supercar; source `resources/[cars]/pitd_tol_car_pack_a`.
- `toldurus`: Unidentified addon SUV; source `resources/[cars]/pitd_tol_car_pack_a`.
- `tolexor`: Unidentified addon sports car; source `resources/[cars]/pitd_tol_car_pack_a`.
- `tolmig`: Unidentified addon sports car; source `resources/[cars]/pitd_tol_car_pack_a`.
- `tolpeigerzen`: Unidentified addon supercar; source `resources/[cars]/pitd_tol_car_pack_a`.

The sortable numeric dataset is [VEHICLE_PHYSICS_AUDIT.csv](VEHICLE_PHYSICS_AUDIT.csv); the full machine-readable catalog is `scripts/vehicle_inventory.json`. Runtime road tests are still required for measured acceleration, braking distance and rollover behavior.
