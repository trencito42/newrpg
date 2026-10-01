# SunsetMP — UI & Design Consistency Matrix

This document compares all active UI interfaces across design tokens, font families, button systems, modal dialogs, focus management, and ESC key handling.

---

## 1. UI Module Comparison Matrix

| Screen / Module | Resource | Host Technology | Primary Font | Button Style | Modal Pattern | Close Triggers | Focus Ownership | Empty State Handled? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Auth / Login** | `sunset_auth_ui` | Dedicated NUI | Syne & Outfit | Gradient Glow | Centered Dialog | Auto on Login | Dedicated | ✅ Yes |
| **Character Select** | `sunset_ui` | Central SPA | Chakra Petch | Neon Border | Hero Cards | Spawn Action | `sunset_ui` | ✅ Yes |
| **HUD & Radar** | `sunset_hud` / `sunset_ui`| Central SPA | Rajdhani | N/A (HUD) | Overlay | Never (HUD) | No Focus | ✅ Yes |
| **Chat** | `sunset_chat` / `sunset_ui`| Central SPA | Inter / Segoe UI| Flat Inline | Overlay | ESC / Enter | Input Focused | ✅ Yes |
| **Inventory (Forza)**| `sunset_ui` | Central SPA | Chakra Petch & Rajdhani| Glass Card | Grid Modal | ESC / Tab / X | `sunset_ui` | ✅ Yes |
| **Cell Phone** | `sunset_ui` | Central SPA | SF Pro / Inter | Rounded Pill | Phone Chassis | ESC / Back Button| `sunset_ui` | ✅ Yes |
| **ATM / Banking** | `sunset_ui` | Central SPA | Chakra Petch | Modern Dark | Terminal Panel | ESC / Close Button| `sunset_ui` | ✅ Yes |
| **Dealership** | `sunset_ui` | Central SPA | Chakra Petch | Glass Accent | Vehicle Showcase| ESC / Test Drive | `sunset_ui` | ✅ Yes |
| **LS Customs / Tuning**| `sunset_tuning`| Dedicated NUI | Montserrat | Flat Rectangular| Side Panel | ESC / Space | Dedicated | ✅ Yes |
| **Diamond Casino** | `sunset_ui` / `sunset_slots`| Mixed SPA/NUI | Rajdhani & Montserrat| Gold Metallic | Table Overlay | ESC / Leave Seat| Mixed | ✅ Yes |
| **Police MDT** | `sunset_ui` | Central SPA | JetBrains Mono | Industrial Dark | Fullscreen Tablet| ESC / Close | `sunset_ui` | ✅ Yes |
| **Battlepass / Pass**| `sunset_pass` | Dedicated NUI | Chakra Petch | Tier Progress | Horizontal Carousel| ESC / Close Button| Dedicated | ✅ Yes |
| **Robbery Minigames**| `sunset_robbery`| Dedicated NUI | Monospace | Circuit Node | Mini Overlay | ESC / Failure | Dedicated | ✅ Yes |
| **Job Center / Shifts**| `sunset_ui` | Central SPA | Chakra Petch | Cyberpunk Pill | Card Grid | ESC / Apply Button| `sunset_ui` | ✅ Yes |

---

## 2. Standard Design System Specifications

The canonical SunsetMP design system consists of:

- **Typography**:
  - Headers & Titles: `'Chakra Petch'`, `sans-serif` (uppercase, letter-spacing: 0.05em).
  - Body & Labels: `'Rajdhani'`, `sans-serif` (font-weight: 500/600).
  - Data & Numbers: `'JetBrains Mono'`, `monospace`.
- **Color Palette**:
  - Background Base: `#0a0c10` (Dark obsidian).
  - Surface Glass: `rgba(16, 20, 28, 0.85)` with `backdrop-filter: blur(12px)`.
  - Primary Accent: `#00ffcc` (Sunset Cyan).
  - Secondary Accent: `#ff0077` (Sunset Magenta).
  - Success: `#00e676` (Emerald Green).
  - Warning: `#ffd600` (Amber Gold).
  - Destructive / Error: `#ff1744` (Crimson Red).
- **Component Geometry**:
  - Border Radius: `8px` (standard cards/modals), `4px` (tags/badges), `20px` (pill buttons).
  - Modal Borders: `1px solid rgba(255, 255, 255, 0.08)`.
  - Shadows: `0 8px 32px rgba(0, 0, 0, 0.5)`.
