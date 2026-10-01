# SunsetMP — Comprehensive Keybind & Input Ownership Matrix

This document maps all registered keybindings, control actions, physical fallbacks, and conditions across the gamemode to prevent future input regressions.

---

## 1. Keybind Matrix

| Key | Action / Feature | Resource | Registered Command | Register Type | Condition / Scope | Conflict Status | Current Owner |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **Z** | Player List / Scoreboard (Hold) | `sunset_scoreboard` | `+sunset_playerlist` | `RegisterKeyMapping` + Control 20 Fallback | Not typing, not in Turf War | ✅ Clean (Yields to Turf War on Z) | `sunset_scoreboard` |
| **G** | Player Interaction Menu | `sunset_interactions`| `+interactplayer` | `RegisterKeyMapping` + Control 47 Fallback | Near player (3.5m), not typing | ✅ Clean | `sunset_interactions` |
| **G (In Veh)**| Vehicle Refueling | `sunset_vehicles` | Native Control 47 | Distance-adaptive in-vehicle | Near gas station pump | ✅ Clean (Veh context only) | `sunset_vehicles` |
| **M** | Player Menu / Navigation | `sunset_menu` | `sunset_menu` | `RegisterKeyMapping` | Not typing, not pause menu | ✅ Clean | `sunset_menu` |
| **I / TAB** | Inventory & Containers | `sunset_inventory` | `inventory` | `RegisterKeyMapping` | Not typing, not pause menu | ✅ Clean | `sunset_inventory` |
| **X** | Emote Wheel (Hold) | `sunset_inventory` | `+sunset_emote_wheel`| `RegisterKeyMapping` | On foot, not typing | ✅ Clean | `sunset_inventory` |
| **T** | Open Chat | `sunset_chat` | `sunset_chat` | `RegisterKeyMapping` | Not in NUI focus | ✅ Clean | `sunset_chat` |
| **ESCAPE** | Close Chat / UI / Menu | `sunset_chat` / `sunset_ui`| `sunset_chat_close` | `RegisterKeyMapping` + DOM listener | Active open NUI / chat | ✅ Central Gateway | `sunset_ui` |
| **U** | Lock / Unlock Vehicle | `sunset_vehicles` | `sunset_lock` | `RegisterKeyMapping` | Vehicle owner / keys | ✅ Clean | `sunset_vehicles` |
| **K** | Toggle Seatbelt | `sunset_vehicles` | `sunset_seatbelt` | `RegisterKeyMapping` | In vehicle | ✅ Clean | `sunset_vehicles` |
| **2** | Vehicle Engine On / Off | `sunset_vehicles` | `sunset_engine` | `RegisterKeyMapping` | Driver seat | ✅ Clean | `sunset_vehicles` |
| **H** | Vehicle Headlights | `sunset_vehicles` | `sunset_lights` | `RegisterKeyMapping` | Driver seat | ✅ Clean | `sunset_vehicles` |
| **LSHIFT**| Nitrous Oxide Boost | `sunset_tuning` | `+nitrous` | `RegisterKeyMapping` | Vehicle with NOS installed | ✅ Clean | `sunset_tuning` |
| **Y** | Accept Trade Invite (Hold) | `sunset_inventory` | `+sunset_trade_accept`| `RegisterKeyMapping` | Pending trade request | ✅ Clean | `sunset_inventory` |
| **N** | Decline Trade Invite (Hold) | `sunset_inventory` | `+sunset_trade_decline`| `RegisterKeyMapping`| Pending trade request | ✅ Clean | `sunset_inventory` |
| **F7** | Teleport to Waypoint (Admin) | `sunset_admin` | `tpwp` | `RegisterKeyMapping` | Admin Level >= 2 | ✅ Permission Gated | `sunset_admin` |
| **E** | Contextual World Interact | Multiple resources | Native Control 38 | Proximity markers (<2.5m) | ✅ Distance Gated | Proximity Context |

---

## 2. Architectural Rules for Input & Keybinds

1. **No Silent Rejections**: When a player activates an interaction key (such as `G`) while out of range of a valid target, the system must immediately issue a localized feedback notification (`interactions.message.no_player_is_close_enough_move_within_3_metres`) rather than returning silently.
2. **Release-Immune Await**: Server callbacks invoked during keypress handlers (`Sunset.AwaitCallback`) must not check ephemeral key-hold state variables (like `lockedTarget`) upon resolution, preventing premature cancellation if the key is released before the server callback packet returns.
3. **Physical Control Fallbacks**: For primary keys (`Z` for scoreboard, `G` for player interaction), resources maintain lightweight physical control checks (`IsControlJustReleased` / `IsDisabledControlJustReleased`) to ensure immediate responsiveness regardless of local FiveM keybind profile desynchronization.
