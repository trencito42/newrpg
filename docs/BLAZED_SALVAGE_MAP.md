# Blazed Salvage & Architectural Classification Map

This document tracks the thorough audit of the reference codebase (`https://github.com/trencito42/blazed`) and classifies each component into **PORT NOW**, **PORT LATER**, **REFERENCE ONLY**, or **DO NOT PORT**.

---

## 1. Executive Summary

| Category | Description | Scope in `newrpg` |
| :--- | :--- | :--- |
| **PORT NOW** | Battle-tested framework-quality primitives & runtime fixes | Included in current foundation pass (NUI focus, bridge, diagnostics, chat UX, notifications, progress primitive, RPC timeout guards). |
| **PORT LATER** | High-value gameplay systems with sound core concepts | Scheduled for post-foundation domain modules (Inventory, Phone, MDC, Housing, Dealership, Businesses). |
| **REFERENCE ONLY** | Architectural reference, data schemas, sound cues | Retained for design inspiration; code will be written natively. |
| **DO NOT PORT** | Monolithic UI, synchronous script tags, cross-domain SQL, circular dependencies | Explicitly rejected to preserve performance and modularity. |

---

## 2. PORT NOW (Foundation Quality Primitives)

| Component | Origin in Blazed | Salvaged Concept / Fix | Destination in `newrpg` |
| :--- | :--- | :--- | :--- |
| **NUI Focus Protection** | `sunset_ui/client/main.lua` | Strict focus ownership (`focusOwner`), blocking unauthorized releases during auth/onboarding, resource stop cleanup. | `rpg_ui/client/main.lua` |
| **NUI Debug Instrumentation** | `sunset_ui/client/main.lua` | Gated ring buffers (`nuiMsgBuffer`, `nuiCbBuffer`, `nuiErrBuffer`) via `setr rpg_nui_debug 1`, console inspection command `rpg_ui_debug`. | `rpg_ui/client/main.lua` |
| **NUI Browser Error Forwarding** | `sunset_ui/web/app.js` | `window.onerror` & `window.onunhandledrejection` forwarding CEF exceptions back to Lua logger in debug mode. | `rpg_ui/web/src/core/errors.ts` |
| **NUI Canonical Bridge** | `sunset_ui` exports | Clean unified exports: `Show`, `Hide`, `Send`, `Notify`, `AcquireFocus`, `ReleaseFocus`, `GetFocusOwner`, `IsOpen`, `Progress`, `CancelProgress`. | `rpg_ui/client/main.lua` & `rpg_ui/web/src/core/bridge.ts` |
| **Chat Keyboard & History** | `sunset_chat/web/` | Command history navigation (Up/Down arrows, max 50 items), Escape key close, message category coloring (`system`, `admin`, `helper`, `private`). | `rpg_ui/web/src/features/chat/` |
| **Toast Notifications** | `sunset_ui/web/notifications.js` | Auto-expiring toast queue, kind-based color coding (`success`, `warning`, `error`, `info`), slide/fade animation. | `rpg_ui/web/src/core/notifications.ts` |
| **Progress UI Primitive** | `sunset_ui/web/progress.js` | Reusable circular/linear progress bar with cancel capability (`Progress(duration, label, onComplete, onCancel)`). | `rpg_ui/web/src/core/progress.ts` |
| **Loadscreen Handoff** | `sunset_loadscreen` | Explicit `ready` and `authRendered` handshake before loading screen shutdown to avoid black screens and stuck CEF frames. | `rpg_ui/client/main.lua` & `rpg_auth` |

---

## 3. PORT LATER (Post-Foundation Gameplay Modules)

| Gameplay System | Blazed Reference | Evaluated Value | Reason to Defer | Target Module |
| :--- | :--- | :--- | :--- | :--- |
| **Item & Weapon Inventory** | `sunset_inventory` | Weight-based slot grid, drag-and-drop, hotbar shortcuts, trunk/glovebox storage. | Requires canonical `rpg_economy` and items registry; do not build during foundation hardening. | `rpg_inventory` |
| **Smartphone System** | `sunset_phone` | Contacts, SMS, GPS routes, calls, camera photos, banking app. | Heavy UI module; should be implemented as a lazy-loaded standalone feature with dedicated exports. | `rpg_phone` |
| **Police MDC Tablet** | `sunset_police` / `sunset_mdc` | Warrant search, vehicle lookup, citizen records, incident reporting. | Belongs in future public service / faction module. | `rpg_police` |
| **Housing & Real Estate** | `sunset_properties` | Property interiors, lock/unlock, rent/sale, stash storage, keyholder access. | Decoupled stub exists in `rpg_housing`; full interior streamer to be built later. | `rpg_housing` |
| **Dealership & Vehicle Garage** | `sunset_dealership` / `sunset_garage` | Test drive, vehicle purchase, catalog browser, persistent tuning and health. | Decoupled stub exists in `rpg_vehicles`; full vehicle persistence to be built later. | `rpg_vehicles` |
| **Player Businesses** | `sunset_businesses` | Gas stations, 24/7 stores, ammunation supplies, manager payouts. | Requires mature economy and inventory foundation. | `rpg_businesses` |
| **Faction / Clan Warfare** | `sunset_factions` / `sunset_clans` | Turf capture, gang ranks, armory access, faction bank accounts. | Decoupled stub exists in `rpg_factions`; turf capture engine to be built later. | `rpg_factions` |

---

## 4. REFERENCE ONLY (Design Inspiration & Data Schemas)

- **Sound Asset Formats**: Audio cues (notification chime, button clicks, cash register sound) — ensure compressed `.ogg`/`.mp3` formats.
- **GTA Map Metadata**: Coordinate presets for LSIA, hospitals, police stations, and mechanic shops.
- **Visual Design Themes**: Sleek dark mode palette with vibrant Blaze Orange accents (`#F97316`).

---

## 5. DO NOT PORT (Architectural Anti-Patterns)

| Anti-Pattern in Blazed | Architectural Harm Identified | `newrpg` Solution |
| :--- | :--- | :--- |
| **Monolithic `index.html`** | 245 KB HTML, 1,180 DOM nodes, all panels parsed at boot -> 5s freeze during CEF loadscreen handoff. | Lightweight app shell: dynamic TypeScript modules with `mount()` / `unmount()` lifecycle. |
| **Synchronous Script Tags** | 47 `<script>` tags loaded synchronously at boot regardless of player state. | Vite dynamic imports and single-file inlining with zero render-blocking scripts. |
| **Unpruned Icon Fonts** | 477 KB Phosphor TTF + 243 KB CSS loaded for only ~30 active icons. | Inline SVG components with zero external font/CSS overhead. |
| **Uncompressed TTF Fonts** | 1.4 MB of Rajdhani/Chakra TTF files decoded simultaneously during login transition. | Modern system font stack (`Inter, system-ui, sans-serif`) with zero boot latency. |
| **Cross-Domain SQL in Core** | Factions, houses, businesses, and vehicles mutated directly inside `sunset_core` and `sunset_admin`. | Strict acyclic DAG with isolated domain resources (`rpg_economy`, `rpg_factions`, `rpg_housing`, `rpg_vehicles`). |
| **Direct Client `SetNuiFocus`** | Random resources calling `SetNuiFocus` directly, killing cursor or stealing focus. | `rpg_ui` is the single exclusive owner of NUI focus with explicit acquire/release leases. |
