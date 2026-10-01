# PANEL_GAP_ANALYSIS.md — FiveM RPG Server vs. Web Panel Gap Analysis

This document records the exact boundaries between what exists in the FiveM server (`newrpg`), what is added as a legitimate panel-owned system, and what features from legacy RPG panels (such as B-Zone) do **NOT** exist in the game backend and are intentionally deferred rather than fabricated with fake data.

---

## 1. Executive Summary

A critical directive of this project is:
> **No fake metrics. No fake data. No placeholder player profiles pretending to be real. No dead pages. No invented server features.**

To satisfy this, all features fall into three strict classifications:
1. **Existing FiveM Server Systems:** Direct mapping to production tables and runtime authority (`sunset_*` resources).
2. **Panel-Owned Systems:** Production web systems with their own schema, foreign keys to `accounts`/`characters`, and full server-side logic (e.g. Polls, Web Support Helpdesk, Player Complaints, Unban Appeals, Web Audit Log).
3. **Deferred / Non-Existent Systems:** Features common in 15-year-old SA:MP portals that have no backing in `newrpg` (e.g. Web Shop/Donations, Crates, Faction Application Forms, Web Marketplace). These are **NOT** fabricated with dummy data.

---

## 2. Detailed Gap Register

| Feature / Concept | Legacy RPG Precedent (e.g. B-Zone) | Current `newrpg` FiveM Reality | Panel Approach & Resolution |
|---|---|---|---|
| **Community Polls & Elections** | Mayoral elections, community questions, rank surveys | No poll table exists in `sql/` migrations. | **Implemented as Panel-Owned System:** Schema includes `panel_polls`, `panel_poll_options`, and `panel_poll_votes`. Enforces `UNIQUE KEY (poll_id, account_id)` at DB engine level. Supports start/end timestamps, eligibility rules, and Romanian/English translations. |
| **Support Helpdesk (Tickets)** | Player questions, bug reports, staff support | In-game `tickets` table is exclusively for **police citations/fines** (`officer_character_id`, `amount`, `paid`). `/report` and `/helpme` are in-memory transient chat commands. | **Implemented as Panel-Owned System:** Table `panel_support_tickets` & `panel_ticket_messages`. Categorized by department (Billing/Account, Bug Report, General Question, Staff Inquiry). Separate from police citations. |
| **Player Complaints** | Report a player / report a faction member / report staff | No complaint system in DB. In-game `/report` vanishes on server restart or disconnect. | **Implemented as Panel-Owned System:** Table `panel_complaints` & `panel_complaint_messages`. Links accused character and reporting account, supports staff resolution workflows and action logging. |
| **Unban Appeals** | Request unban after sanction | `bans` table exists with `reason`, `expires_at`, `license`, `ip`. No appeal or unban request table exists. | **Implemented as Panel-Owned System:** Table `panel_unban_requests`. Allows banned accounts/licenses to submit appeals, reviewable by staff with level ≥ 3 (`unban` permission). |
| **Live Online Player Count** | Live server player list and count | `sunset_core` tracks `Players[source]` in Node/Lua memory. No public external API existed. | **Bridge / Snapshot Resolution:** Panel uses a lightweight local query / snapshot cache (`panel_stat_snapshots`) updated via local bridge. If FiveM is offline, panel honestly displays "Server Offline" rather than rendering fake online counts. |
| **Web Shop / Coin Store / Donations** | Buy Blaze Points, VIP, vehicles, unban passes on web | In-game has `accounts.premium_points`, but no web payment gateway, Tebex/Stripe webhook, or digital catalog exists. | **Explicitly Deferred:** No fake "Buy Now" buttons or mock payment gateways. Account overview accurately displays current `premium_points` balance. |
| **Crates / Lucky Wheels on Web** | Open crates on web dashboard | `sunset_luckywheel` and `sunset_casino` exist exclusively in-game inside the Diamond Casino interior. | **Explicitly Deferred:** Casino games belong to the 3D in-game experience; no simulated web gambling. |
| **Faction / Leader Web Applications** | Complex 20-question Google Forms / web questionnaires | `sunset_factions` manages recruitment via `/finvite` in-game and Discord community channels. | **Explicitly Deferred:** Display faction rosters, leadership, vacancies, and application requirements, with a direct link to the official application discord/forum route. |
| **Player-to-Player Web Marketplace** | Sell cars/houses to offline players via web auction | Vehicle and property ownership transfers are atomic in-game transactions (`TransferVehicleOwnership`, `sunset_properties`). | **Explicitly Deferred:** Bypassing FiveM runtime to trade cars/properties risks race conditions and duplication. Display properties and dealership catalogs as read-only. |
| **Friend Lists / Social Graph** | Web friend requests, online alerts | Phone system (`phone_contacts`) stores contacts per character in DB (`character_id, contact_name, phone_number`). No social "friend" request graph. | **Mapped to Existing Reality:** Expose character phone contacts in the character portal. Do not invent an artificial social network layer. |
| **Achievements / Badges** | 100+ generic web badges | Server uses SA:MP style Respect Points (`characters.respect_points`, `paydays_received`), Quests (`character_quests`), and Mission Reputation (`sunset_mission_reputation`). | **Mapped to Existing Reality:** Expose real quest progression, mission contacts, and respect levels. |
| **Traffic Citations vs. Support Tickets** | Confusion between police tickets and support tickets | Table `tickets` stores traffic fines issued by police officers. | **Clear Disambiguation:** In-game fines appear under the Character profile / Police history as "Citations". Web support tickets use `panel_support_tickets`. |

---

## 3. Invariant Safety Guarantees

1. **No Phantom Accounts:** All accounts in search or leaderboards are real records from `accounts` and `characters`.
2. **No Fabricated Charts:** Server economy distribution, vehicle counts, and population statistics are computed from real database aggregations or honest snapshots.
3. **No Dead Links / Placeholders:** If a subsystem is not yet implemented on the server, it is omitted from navigation rather than rendering a `404` or an empty "Coming Soon" placeholder card.
