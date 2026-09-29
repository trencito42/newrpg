# Civilian Job Workplaces & Employment Office Architecture

## 1. Overview
In Sunset Roleplay, civilian employment is grounded in physical world activities rather than instant menu hiring. Every primary civilian career has its own dedicated physical workplace, supervisor NPC, career guide, and equipment/terminal amenities.

The **Job Center** at City Hall has been transformed into the **Employment Office**, whose sole responsibility is **Discovery and Navigation (GPS)**. Players explore career opportunities, review wages and workplace locations, and set direct GPS navigation to the workplace to meet their supervisor in person.

---

## 2. Workplace Architecture

```
                       EMPLOYMENT OFFICE (City Hall)
                       - Career discovery & salary overview
                       - Workplace address & supervisor profile
                       - "SET GPS TO WORKPLACE" Action
                                     │
                                     ▼
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
 ┌──────▼───────┐             ┌──────▼───────┐             ┌──────▼───────┐
 │ FISHERMAN    │             │ TRUCKER      │             │ GARBAGE      │
 │ Billy Ray    │             │ Earl         │             │ Sal          │
 │ Paleto Pier  │             │ Port of LS   │             │ Davis Depot  │
 └──────┬───────┘             └──────┬───────┘             └──────┬───────┘
        │                            │                            │
 ┌──────▼───────┐             ┌──────▼───────┐             ┌──────▼───────┐
 │ COURIER      │             │ FUTURE: HUNT │             │ FUTURE: DIVE │
 │ Artie        │             │ Hunting      │             │ Salvage      │
 │ Post OP Whse │             │ Lodge NPC    │             │ Contractor   │
 └──────────────┘             └──────────────┘             └──────────────┘
```

---

## 3. Workplace Directory

### 3.1. Fisherman
- **Supervisor**: Billy Ray (Master Angler)
- **Workplace**: Paleto Waterfront pontoon (`vector4(-1593.23, 5207.74, 3.31, 25.49)`)
- **Secondary Amenity**: Bait & Tackle Shop (`vector3(-1602.11, 5203.87, 4.31)`)
- **Actions**: Apply as Fisherman, Start Shift, Rod Upgrades, Fishing Guide, Sell Fish, Resign.

### 3.2. Trucker
- **Supervisor**: Earl (Depot Dispatcher)
- **Workplace**: Port of Los Santos (`vector4(1200.59, -3107.89, 6.03, 312.11)`)
- **Secondary Amenity**: Route Laptop Terminal (`vector4(1207.92, -3114.87, 5.54, 259.54)`)
- **License Requirement**: Valid Driver License (`driver`).
- **Actions**: Apply as Trucker, Open Route Laptop, Trucker Guide, End Active Shift, Resign.

### 3.3. Garbage Collector
- **Supervisor**: Sal (Sanitation Foreman)
- **Workplace**: Davis Sanitation Yard (`vector4(-321.70, -1545.94, 27.72, 270.0)`)
- **Secondary Amenity**: Compaction Unload Bay (`vector3(-350.45, -1560.22, 25.22)`)
- **License Requirement**: Valid Driver License (`driver`).
- **Actions**: Apply as Garbage Collector, Start Route, Garbage Guide, End Shift, Resign.

### 3.4. Courier
- **Supervisor**: Artie (Parcel Dispatcher)
- **Workplace**: Post OP Delivery Depot (`vector4(78.45, 112.22, 81.16, 160.0)`)
- **Secondary Amenity**: Loading Dock (`vector4(74.0, 118.0, 81.17, 180.0)`)
- **License Requirement**: Valid Driver License (`driver`).
- **Actions**: Apply as Courier, Start Deliveries, Courier Guide, End Shift, Resign.

---

## 4. Reusable Framework Design

### 4.1. Shared Definition (`sunset_core/shared/jobs_workplaces.lua`)
Defines:
- `jobId`, `jobLabel`, `locationLabel`, `address`, `description`
- `npc`: id, name, title, model, coords (`vector4`), scenario, badge, icon
- `secondaryLocation`: label, coords
- `guide`: title, numbered step-by-step instructions
- `requirements`: `minLevel`, `licenses` array
- `actions`: `apply`, `startShift`, `stopShift`, `guide`, `quitJob`, `special`

### 4.2. Server Authoritative Verification (`sunset_jobs/server/workplaces.lua`)
- **Proximity Enforced**: Remote hiring triggers are rejected if player is $> 12\text{m}$ away from supervisor NPC.
- **License Verification**: Integrates directly with `sunset_licenses:HasLicense(source, lic)`.
- **Shift Safety**: Switching or quitting civilian employment automatically cancels active sessions without data corruption.

### 4.3. Client Controller (`sunset_jobs/client/workplaces.lua`)
- Streamed NPC spawning and lifecycle management.
- Proximity prompt & world tooltip integration via `sunset_world:NpcShowTooltip`.
- Contextual action menu dynamically adapting based on employment status and active shift state.

---

## 5. Devtools Integration
Workplace NPC coordinates and secondary locations are registered in `SunsetDevTools.Adapters['workplaces']` for visual inspection and adjustment in `sunset_devtools`.
