# Vehicle display-name audit

## Contract

`model` remains the technical spawn/database identifier. `displayName` (or legacy `label` in owned-vehicle menu DTOs) is presentation-only. Never replace `model` in `CreateVehicle`, `joaat`, tuning profiles, entity validation, SQL identity, or image lookup.

The canonical in-game resolver is `sunset_vehicles:GetVehicleDisplayName(modelOrEntity)` on the client and `sunset_vehicles:GetVehicleDisplayName(model)` on the server. The server loads `dealership_vehicles` once into a case-insensitive `model -> {label, brand, category}` cache. Dealership admin save/delete refreshes that cache and publishes its version to clients. Client resolution uses, in order: catalog label, explicit streamed-addon fallback, validated GTA `GetLabelText(GetDisplayNameFromVehicleModel(hash))`, sanitized title-case model, then `Vehicle`. The server cannot call GTA localization natives, so its final fallback is sanitized title case. The website joins the same catalog and uses a sanitized fallback; it must never use the raw model as a vehicle title.

The catalog includes unavailable/hidden entries because previously owned vehicles retain their names. No display label is duplicated into `vehicles` rows. The client caches names by entity/model hash and invalidates on catalog version change; HUD updates reuse the cached name.

Fallbacks are auditable: the server export `GetUncataloguedVehicleModels` lists models missing from catalog/explicit addons; the client export `GetUnresolvedVehicleNames` lists models for which neither an explicit label nor a trustworthy GTA localization was found. In dev mode the client logs each such model once. These are discovery tools, not automatic evidence that every unlisted vanilla model needs a catalog row.

## Streamed addon inventory

`sunset_addon_vehicles/vehicles.meta` defines exactly six vehicle models. All six have catalog seed labels in `sql/53-addon-vehicles.sql` and explicit startup fallbacks:

| Technical model | Display name |
| --- | --- |
| `tempesta2` | Tempesta Widebody |
| `sentinel_rts` | Sentinel RTS Track |
| `d7cyp` | Cypher GTS Spec |
| `schlagenstr` | Schlagen STR AMG |
| `cometcup` | Comet Cup Edition |
| `H4RxST2` | Harx ST2 GT |

Missing labels among streamed models: **none in this repository**. The only reported real regression model is `d7cyp`; `abdna1` was a fictional example, not a missing vehicle to investigate.

Read-only check against the database configured by this workspace on 2026-10-02: 18 catalog rows, five owned vehicle rows (including one `d7cyp`), and zero owned models lacking a valid catalog label. All six addon labels matched the seed. This verifies the configured database, not the running FiveM resource copy or a player's client cache.

## Presentation surfaces migrated

- Owned vehicle DTOs feeding garage and M menu; vehicle-entry chat, `/givecar` notifications.
- HUD vehicle name and fuel pump; GTA-native fallback, carjack interaction, and staff vehicle labels/radar.
- Impound list; faction fleet fallback; MDC registered-vehicle and DMV cards; vehicle trade selector.
- Dealership catalog remains label-led; admin model field deliberately remains technical.
- Panel: owned vehicles, public player profile (featured and list), popular-vehicle statistics.

The UI stores and sends `model` where it needs identity or previews, but its visible title and image alt come from `displayName`/catalog label. Police search continues to match technical model as well as plate; only results use display names. Tuning `modelName`, handling/profile lookup, and debug hash output are intentionally technical.

## Verification and open runtime checks

Run `node scripts/test-vehicle-display-names.js` to compare all streamed model names with the SQL seed and shared fallback, and to guard key UI surfaces against direct model interpolation. Run Lua syntax, manifest, NUI bridge, panel typecheck, and panel tests before deployment. On a live FiveM client verify `d7cyp` in chat, HUD, M menu, garage, trade, fuel, impound, MDC, and panel; repeat with a vanilla model, fleet vehicle, and an unregistered addon. Confirm an admin label edit updates newly opened UIs without restart.

This repository audit cannot prove runtime content from separately installed resources. A live check and external-resource inventory are still required before claiming those cases complete.
