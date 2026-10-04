# Phone app parity

Audited against `ca10ebd6` and the layout pass on top of it. Asset linking and CNN attachment rendering were left in place.

| App | Backend already had | Phone showed before | Phone shows after | Left off the phone | Needs live play |
| --- | --- | --- | --- | --- | --- |
| Phone | Calls, contacts | Keypad stacked at the top | Full-height keypad, recents, contacts | — | Keypad fit at 1080p and 1440p |
| Messages | Threads, retry | Composer scrolled with history | List fills the view; composer stays at the bottom | — | Long thread scroll |
| Contacts | Add, edit, delete | Same actions in a short list | Full-height list, native edit form | — | Edit still saves |
| Bank | Balance, cash, transactions | Total, then a short list | Bank hero, cash, scrolling transactions, sticky transfer | Deposit still routes to the nearest ATM | Transfer failure text |
| Garage | Vehicles, impound, pins | Filter cards | Full list, filters, expand for GPS | Remote spawn | Stored / out / impound GPS |
| Market | Listings, own options | Options mixed into the browse page | Sticky filters; Sell opens the existing options | Asset picker is still the chat linker, not the market seller | Buy, cancel, promote |
| Taxi | Destinations, offers, active ride | Chips appended with no row gap; request in the flow | Wrapped chips, sticky request, ride state replaces request | — | Driver offer accept |
| Jobs | `jobs[]` for every civilian job, workplaces | Only `currentJob` | Current job plus every row, with `CanAccess` requirements and workplace GPS | Remote job start | Locked hunter requirements |
| Map | Taxi destination payload, plus CNN and impound | First 40 pins from taxi app data | `sunset:getPhoneMapLocations`, no 40 cap, group tabs | Player-owned property interiors | Search over 40 pins |
| Faction | Dashboard report, FP, society, grades, resignations, permissions | Overview, members, MOTD, fleet subset | Those fields, member sheet, management for permitted actions | Fleet "at depot" availability | Resignation accept |
| Properties | Owned page and rented page | One mixed list | Owned / Rented tabs, one Load more | Remote property management | Paging |
| Clan | Dashboard, permissions, lifetime | One scrolling page | Overview, Members, Management when permitted | — | Kick refresh |
| News | Ad text plus public attachment | Rich text already wired | Same renderer inside the full-height feed | — | Chip tap opens preview |
| Account | Nickname, level, prefs | Stacked panels | Same data in account, progression, and phone sections | — | Buy level refresh |
| Quests | Quest log | Handoff via `/quests` | Unchanged handoff | No second quest state | Focus returns |

Map locations are the taxi destination catalog read directly, plus CNN, impound, and job workplaces. Taxi still owns ride state. The phone map no longer calls `sunset:getTaxiAppData`.
