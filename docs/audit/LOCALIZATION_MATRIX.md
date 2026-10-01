# SunsetMP — Localization & Translation Matrix

This document provides a breakdown of the bilingual localization architecture (English `en` and Romanian `ro`), placeholder validation, and terminology standards.

---

## 1. Summary Statistics

| Locale Domain | Total Keys (EN) | Total Keys (RO) | Missing Keys | Placeholder Mismatches | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Lua Core & Gameplay** | 3,744 | 3,744 | 0 | 0 | ✅ 100% Parity |
| **NUI Modules & HUD** | 2,813 | 2,813 | 0 | 0 | ✅ 100% Parity |
| **Command Suggestions** | 275 | 275 | 0 | 0 | ✅ 100% Parity |
| **TOTAL STRINGS** | **6,832** | **6,832** | **0** | **0** | ✅ **VERIFIED** |

---

## 2. Standard Terminology Glossary

To prevent inconsistent translations across modules, the following authoritative terminology mapping is enforced across the entire codebase:

| Concept | English (`en`) | Romanian (`ro`) | Inconsistent Anti-Patterns (Avoid) |
| :--- | :--- | :--- | :--- |
| **Currency** | Cash / Bank | Bani gheață / Cont bancar | *Valută, Fonduri, Argint* |
| **Civilian Jobs** | Job / Shift | Job / Tură | *Muncă, Serviciu, Ocupație* |
| **Factions** | Faction / Department | Facțiune / Departament | *Grupare, Organizație* |
| **Real Estate** | Property / House / Apartment | Proprietate / Casă / Apartament | *Locuință, Imobil, Conac* |
| **Player Progression** | Level / XP / Respect | Nivel / XP / Respect | *Rang, Scor, Treaptă* |
| **Vehicles** | Vehicle / Trunk / Glovebox | Vehicul / Portbagaj / Torpedou | *Mașină, Căruță, Bric* |
| **Law Enforcement** | Wanted Level / Jail / Fine | Nivel Urmărire / Închisoare / Amendă | *Căutat, Pârnaie, Taxă* |
| **Inventory** | Inventory / Hotbar / Duffel Bag | Inventar / Bara Rapidă / Geantă | *Rucsac, Buzunar, Sac* |
| **Quests & Missions**| Quest / Storyline Mission | Misiune / Misiune Narativă | *Sarcină, Obiectiv, Quest* |

---

## 3. Namespace & Key Samples

| Key | English Translation (`en`) | Romanian Translation (`ro`) | Placeholders |
| :--- | :--- | :--- | :---: |
| `jobs.msg.trucker_deposit_paid` | `Security deposit of ${amount} paid for freight transport.` | `Garanția de ${amount} a fost achitată pentru transportul de marfă.` | `{amount}` |
| `factions.msg.arrest_sentence` | `Officer {officer} jailed you for {minutes} minutes. Reason: {reason}` | `Ofițerul {officer} te-a încarcerat pentru {minutes} minute. Motiv: {reason}` | `{officer}, {minutes}, {reason}` |
| `economy.msg.transfer_success` | `Successfully transferred ${amount} to account #{account}.` | `Ai transferat cu succes suma de ${amount} în contul #{account}.` | `{amount}, {account}` |
| `properties.msg.rent_due` | `Property #{id} rent renewed for ${cost}. Next payment in {days} days.` | `Chiria proprietății #{id} a fost reînnoită cu ${cost}. Următoarea plată în {days} zile.` | `{id}, {cost}, {days}` |
| `robbery.msg.vault_drilling` | `Drilling vault lockpins: {pct}% completed. Keep temperature stable.` | `Găurire încuietoare seif: {pct}% finalizat. Menține temperatura stabilă.` | `{pct}` |
| `licenses.msg.quiz_passed` | `Congratulations! You passed the {type} theory test with {score}% score.` | `Felicitări! Ai promovat testul teoretic pentru {type} cu scorul de {score}%.` | `{type}, {score}` |
