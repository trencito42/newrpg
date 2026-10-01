# SunsetMP — Economy & Monetary Flow Matrix

This document maps all economic inputs (money sources) and economic drains (money sinks), calculates progression timelines, and verifies financial safety mechanics.

---

## 1. Complete Money Sources Matrix

| Source Category | Activity / Feature | Payout Formula / Range | Frequency / Cooldown | Requirements |
| :--- | :--- | :--- | :--- | :--- |
| **Civilian Jobs** | Long-Haul Trucking | $3,500 – $8,500 | ~6–10 min / route | Level 3 + Commercial License |
| | Express Courier | $1,200 – $2,800 | ~3–5 min / route | Level 1 |
| | Deep Sea Salvage | $4,000 – $9,500 | ~8–12 min / site | Level 4 + Boat License |
| | Wildlife Hunting | $800 – $3,400 / pelt | ~2–4 min / animal | Level 2 + Hunting/Gun License |
| | Commercial Fishing | $150 – $1,200 / fish | ~15–30 sec / catch | Level 1 + Fishing Rod |
| | Sanitation Route | $2,200 – $4,800 | ~5–8 min / route | Level 1 |
| **Faction Duty** | Police / EMS / Government | $1,200 – $3,500 | Every 60 min (Payday) | On-duty minimum 30 min |
| **Illegal Heists** | Fleeca Bank Vault | $45,000 – $85,000 | 45 min server cooldown | 3+ Police Online + Thermite/Drill |
| | Vangelico Jewelry | $25,000 – $50,000 | 30 min server cooldown | 2+ Police Online + Glass Cutter |
| | Vehicle Chop Shop | $3,500 – $12,000 | 15 min / player | Lockpick + Hotwire |
| | Turf Hourly Income | $5,000 – $15,000 | Every 60 min | Clan controlling active turf |
| **Businesses** | 24/7 Store / Gas Station | $2,000 – $20,000 / day | Daily revenue payout | Business Ownership + Stock Supply |
| **Progression** | RPG Story Quests | $500 – $5,000 | One-time per quest | Quest Objective Completion |
| | Daily Battlepass Tiers | $1,000 – $10,000 | Daily / Weekly tasks | Battlepass Level Up |
| | Lucky Wheel Casino Spin | $0 – $50,000 | Once every 24 hours | Casino Visit |

---

## 2. Complete Money Sinks Matrix

| Sink Category | Purchase / Action | Cost Range | Frequency / Condition |
| :--- | :--- | :--- | :--- |
| **Vehicles** | Entry Civilian (Blista, Panto) | $15,000 – $35,000 | One-time purchase at Dealership |
| | Mid-Tier Sedan / SUV (Sultan, Dubsta) | $60,000 – $140,000 | One-time purchase at Dealership |
| | High-End Sports / Super (Tempesta, Zentorno)| $350,000 – $1,800,000 | One-time purchase at Dealership |
| **Vehicle Maintenance**| Fuel Refill (Petrol / Diesel) | $60 – $180 / tank | Per ~60–100 km driven |
| | Mechanic Repair & Towing | $250 – $1,500 | Upon vehicle damage / crash |
| | Impound Lot Retrieval Fee | $750 – $2,500 | When vehicle impounded by Police |
| | Performance Tuning (ECU, Turbo, Suspension)| $5,000 – $75,000 | LS Customs / Harmony Tuning |
| **Real Estate** | Low-End Motel / Apartment Rent | $800 – $2,500 / week | Weekly rent renewal |
| | Suburban House Purchase | $120,000 – $450,000 | One-time purchase |
| | Luxury Vinewood Hills Villa | $900,000 – $3,500,000 | One-time purchase |
| **Licensing** | Driver / Boat / Pilot / Gun Licenses | $500 – $5,000 | Exam fee at DMV / Range |
| **Fines & Penalties** | Speeding / Traffic Violations | $250 – $1,500 | Issued by Police Officer |
| | Emergency Hospital Medical Bill | $500 – $1,200 | Upon player respawn at hospital |
| **Commerce & Goods** | Food, Water, Repair Kits, Tools, Ammo | $10 – $500 | Convenience & Weapon stores |

---

## 3. Progression Timeline & Milestones

- **Milestone 1: First Personal Vehicle (e.g. Karin Sultan, $65,000)**:
  - Average earnings at Level 1–3 (Courier/Garbage/Trucker): ~$32,000/hour.
  - Estimated gameplay time: **~2.0 hours**.
- **Milestone 2: First Apartment / Property (e.g. Del Perro Condo, $180,000)**:
  - Average earnings at Level 4+ (Trucker/Diving/Heists): ~$48,000/hour.
  - Estimated gameplay time: **~3.75 hours**.
- **Milestone 3: High-End Supercar & Full Tuning (e.g. Pegassi Tempesta, $650,000)**:
  - Average earnings at Level 6+ (Master Trucker/Cartel Turfs/Bank Heists): ~$75,000/hour.
  - Estimated gameplay time: **~8.5 hours**.

---

## 4. Economic Security & Overflow Protection

- **Negative Balances**: All deduction endpoints verify `currentBalance >= amount` before committing.
- **Integer Safety**: Amounts are floored and bounded to `[1, 100,000,000]`, preventing integer overflows.
- **Atomic Transactions**: All money operations use `ApplyMoneyOperation` with SQL `FOR UPDATE` row locks, eliminating double-spend and race conditions.
