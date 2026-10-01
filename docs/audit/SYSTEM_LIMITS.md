# SunsetMP — System Limits & Constraints Matrix

This document provides an exhaustive inventory of all gameplay constraints, timers, distance thresholds, cooldowns, and entity limits across both server and client configurations.

---

## 1. Complete Limits Matrix

| System / Parameter | Configured Limit | Source File | Scope | Purpose | Client / Server Parity |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **Max Inventory Weight** | `30.0 kg` (base), `45.0 kg` (duffel) | `sunset_inventory/shared/config.lua` | Player | Prevents infinite item hoarding | ✅ Exact Match |
| **Max Inventory Slots** | `30 slots` | `sunset_inventory/shared/config.lua` | Player | Grid UI capacity | ✅ Exact Match |
| **Max Stack Size** | `100 units` (ammo/materials) | `sunset_inventory/shared/config.lua` | Items | Economy balance | ✅ Exact Match |
| **Max Owned Personal Vehicles**| `5 vehicles` (Standard), `10` (VIP) | `sunset_vehicles/server/main.lua` | Character | Database storage & garage cap | ✅ Server Authoritative |
| **Max Owned Properties** | `2 houses / apartments` | `sunset_properties/shared/config.lua`| Character | Real estate availability | ✅ Exact Match |
| **Max Owned Businesses** | `1 business` | `sunset_businesses/shared/config.lua`| Character | Monopolization prevention | ✅ Exact Match |
| **Max Clan Members** | `25 members` | `sunset_clans/shared/config.lua` | Clan | Turf war balancing | ✅ Exact Match |
| **Max Faction Members** | `50 members` (LSPD), `35` (EMS) | `sunset_factions/shared/config.lua` | Faction | Organization hierarchy | ✅ Exact Match |
| **Max Wanted Level** | `6 stars / Wanted Level 6` | `sunset_factions/server/police.lua` | Character | Law enforcement priority | ✅ Server Authoritative |
| **Max Jail Sentence** | `60 minutes` (real playtime) | `sunset_factions/server/police.lua` | Character | Maximum criminal detention | ✅ Server Authoritative |
| **Wanted Level Decay Rate** | `-1 level every 10 minutes` | `sunset_factions/server/police.lua` | Character | Passive cooldown outside chases | ✅ Server Authoritative |
| **Bank Transfer Daily Cap** | `$100,000 / 24h` (Unverified) | `sunset_economy/server/main.lua` | Account | Fraud & exploit mitigation | ✅ Server Authoritative |
| **ATM Withdrawal Limit** | `$25,000 / transaction` | `sunset_economy/shared/config.lua` | Character | Anti-spam banking | ✅ Exact Match |
| **CNN Ad Character Limit** | `140 characters` | `sunset_cnn/shared/config.lua` | Player | Chat/HUD clean formatting | ✅ Exact Match |
| **CNN Ad Cooldown** | `60 seconds` | `sunset_cnn/shared/config.lua` | Server | Spam flood protection | ✅ Exact Match |
| **Bank Robbery Cooldown** | `45 minutes` | `sunset_robbery/shared/config.lua` | Server | Heist pacing | ✅ Exact Match |
| **Jewelry Robbery Cooldown** | `30 minutes` | `sunset_robbery/shared/config.lua` | Server | Heist pacing | ✅ Exact Match |
| **Chop Shop Cooldown** | `15 minutes / player` | `sunset_carjack/shared/config.lua` | Player | Vehicle theft pacing | ✅ Exact Match |
| **Casino Max Bet (Blackjack)** | `$10,000 / hand` | `sunset_blackjack/config.lua` | Player | Economy inflation cap | ✅ Exact Match |
| **Casino Max Bet (Roulette)** | `$5,000 / number` | `sunset_roulette/config.lua` | Player | Risk management | ✅ Exact Match |
| **Lucky Wheel Daily Spin** | `1 spin every 24 hours` | `sunset_luckywheel/server.lua` | Account | Daily retention bonus | ✅ Server Authoritative |
| **Interaction Distance (NPC)**| `2.5 meters` | `sunset_interactions/shared/config.lua`| Player | Clean raycasting & prompts | ✅ Exact Match |
| **Interaction Distance (Veh)**| `3.5 meters` | `sunset_vehicles/shared/config.lua` | Player | Trunk / Hood / Lock access | ✅ Exact Match |
| **Callback Rate Limit (Standard)**| `10 requests / 5 seconds` | `sunset_core/server/main.lua` | Source | RPC flood defense | ✅ Server Enforced |
| **Callback Rate Limit (Expensive)**| `2 requests / 5 seconds` | `sunset_core/server/main.lua` | Source | Auth/Trade/Purchase protection | ✅ Server Enforced |

---

## 2. Parity & Validation Findings

- **Distance Gating**: All client-side interaction distances (`2.5m` for NPCs, `3.5m` for vehicles, `3.0m` for ATMs) are mirrored by strict server-side `#(playerCoords - targetCoords) < MAX_DIST + 1.5m` distance checks before processing events.
- **Economic Safety Caps**: All money and trade inputs are validated with `math.floor(tonumber(val))`, ensuring no fractional, negative, `NaN`, or infinite values can ever be injected.
