# FiveM NUI Rendering & CSS Guidelines

## Critical Rule: Never use `backdrop-filter: blur()` in FiveM NUI
1. **No `backdrop-filter: blur()` on transparent in-game overlays:**
   - In FiveM's Chromium Embedded Framework (CEF), applying `backdrop-filter: blur(...)` over transparent canvas (such as Chat, HUD, speedometer, notifications, inventory, menus) causes CEF to fail framebuffer sampling and render an opaque solid pitch-black box over the game.
   - Do NOT use `backdrop-filter: blur()` anywhere in in-game NUI overlays.

2. **How to achieve modern glassmorphism in FiveM NUI without blur:**
   - Use clean alpha backgrounds: `background: rgba(12, 14, 18, 0.65)` or `rgba(0, 0, 0, 0.45)`.
   - Use subtle borders: `border: 1px solid rgba(255, 255, 255, 0.08)` or accent border-left: `border-left: 2px solid #F97316`.
   - Use soft box shadows: `box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45)`.
   - Use crisp text shadows: `text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8), 0 0 4px rgba(0, 0, 0, 0.6)`.
