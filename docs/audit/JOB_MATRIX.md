# SunsetMP — Comprehensive Job Matrix

This document details all 7 civilian jobs, their starting locations, progression formulas, anti-cheat server validations, and edge-case lifecycle handling.

---

## 1. Summary Job Matrix

| Job Key | Name | Workplace Location | Min Level | License Required | Vehicle Provided | Base Pay / Route | XP / Route | Est. $/Hour |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `trucker` | Long-Haul Trucker | Elysian Island Freight Terminal | 3 | Driver License (Commercial) | Hauler / Phantom + Trailer | $3,500 – $8,500 | 120 – 300 XP | ~$45,000 |
| `courier` | Express Courier | GoPostal Center, Downtown LS | 1 | None (Faggio) / Driver (Van) | Faggio / Rumpo Custom | $1,200 – $2,800 | 50 – 110 XP | ~$28,000 |
| `fisherman`| Commercial Fisherman | Del Perro Pier | 1 | None | Dinghy (Tug on High Rank) | $150 – $1,200 / Fish | 15 – 45 XP / Catch | ~$32,000 |
| `diver` | Deep Sea Salvage | Paleto Bay & LS Docks | 4 | Boat License | Tug / Tropic + Scuba Gear | $4,000 – $9,500 / Site | 150 – 320 XP | ~$48,000 |
| `hunter` | Wildlife Hunter | Mount Chiliad Wilderness Depot | 2 | Hunting & Firearm License | Bison / Rebel 4x4 | $800 – $3,400 / Carcass | 40 – 120 XP | ~$36,000 |
| `garbage` | Sanitation Worker | LS City Recycling Depot | 1 | None (Worker) / Driver (Driver)| Trashmaster | $2,200 – $4,800 / Shift | 80 – 180 XP | ~$30,000 |
| `mechanic`| Roadside Mechanic | Los Santos Customs, Burton | 2 | Driver License | Flatbed Tow Truck | $1,500 – $4,000 / Service | 60 – 140 XP | ~$35,000 |

---

## 2. Detailed Job Specifications

### 1. Trucker (`trucker`)
- **NPC Employer & Workplace**: Vladislav, Elysian Island Depot (`vector4(124.6, -3253.2, 5.8, 270.0)`).
- **Route Logic**: Dynamic server-generated cargo routes (Short City, County Haul, Paleto Bay Cross-Country). Requires coupling designated trailer, navigating checkpoints, and reverse parking into target bay.
- **Reward Formula**: `BasePayout + (DistanceKm * 420) + (RankBonus * 0.15)`.
- **Server-Side Anti-Exploit**:
  - Distance & Minimum Travel Time validation: Prevents teleport hacks; route completion rejected if elapsed time < `(RouteDistance / MaxVehicleSpeed) * 0.75`.
  - Trailer Attached Validation: `IsVehicleAttachedToTrailer` checked upon reaching delivery destination.
- **Cancel & Disconnect**: Returning truck cancels route cleanly and refunds deposit; disconnect saves session for 5 minutes.

### 2. Courier (`courier`)
- **NPC Employer & Workplace**: Marco, GoPostal Terminal (`vector4(68.9, -1569.8, 29.6, 50.0)`).
- **Route Logic**: Multi-stop suburban delivery route (3 to 7 drop-offs). Player carries parcel box to doorsteps.
- **Reward Formula**: `(CompletedStops * $450) + TipVariance($50-$150)`.
- **Anti-Exploit**: Checkpoint order strictly validated on server; coordinates checked against pre-approved postal customer list.

### 3. Fisherman (`fisherman`)
- **Workplace**: Del Perro Pier Angler Stand.
- **Mechanic**: Cast line into designated ocean/river water zones -> Reel mini-game (tension slider) -> Fish weight & rarity roll.
- **Economy Link**: Fish can be sold to Billy Ray's Bait Shop or used in cooking/crafting recipes.
- **Anti-Exploit**: Rate limited to maximum 1 catch per 12 seconds; server validates rod item in inventory.

### 4. Deep Sea Diver (`diver`)
- **Workplace**: Port of Los Santos Pier 400.
- **Mechanic**: Rent dive boat -> Equip oxygen tank -> Navigate to sea wreck coordinates -> Search underwater debris crates -> Return loot to harbor master.
- **Reward**: High-value salvage scrap, rare jewelry, antique artifacts ($4,000 – $9,500 per expedition).
- **Anti-Exploit**: Server checks depth (`Z < -5.0`) and oxygen tank state bag before allowing salvage interact.

### 5. Wildlife Hunter (`hunter`)
- **Workplace**: Blaine County Forest Station.
- **Mechanic**: Equip hunting rifle (Musket/Sniper) with licensed ammo -> Track deer/boar/coyote -> Field dress carcass -> Transport pelt to butcher.
- **Reward Formula**: `CarcassBasePrice * (PeltWeight / AverageWeight) * CleanShotMultiplier (1.0 to 1.5)`.
- **Anti-Exploit**: Weapon license verified server-side; kill coordinates verified inside registered hunting zone boundaries.

### 6. Sanitation Worker (`garbage`)
- **Workplace**: South LS Recycling Plant.
- **Mechanic**: Dual-crew support (Driver + Collector). Drive Trashmaster truck -> Pick up trash bins at curbside -> Load into compactor.
- **Reward**: $2,200 – $4,800 split evenly between crew members.
- **Anti-Exploit**: Server tracks active crew netIds; both players must be within 15 meters of compactor to register bag load.

### 7. Roadside Mechanic (`mechanic`)
- **Workplace**: Burton LS Customs.
- **Mechanic**: Dispatch board for stranded NPC & player vehicles -> Tow via Flatbed -> Replace flat tires / repair engine bay.
- **Reward**: Service fee + mileage bonus.
