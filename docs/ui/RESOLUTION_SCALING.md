# NUI resolution scaling

The visual reference is **1920×1080**. At that size `--ui-scale` is 1.

```
resolutionScale = clamp(min(viewportWidth / 1920, viewportHeight / 1080), 0.67, 2)
uiScale = resolutionScale * userScale
```

`userScale` defaults to 1 and is limited to 0.80–1.25. The sunset_ui page stores it in `localStorage` under `racket.uiScale` via `ResolutionScale.setUserScale`. It is a client display preference, not an account setting.

| Viewport | resolutionScale |
| --- | --- |
| 1280×720 | 0.67 |
| 1366×768 | 0.711 |
| 1600×900 | 0.833 |
| 1650×928 | 0.859 |
| 1920×1080 | 1 |
| 2560×1440 | 1.333 |
| 3440×1440 | 1.333 |
| 3840×2160 | 2 |
| 5120×1440 | 1.333 |

Height limits ultrawide. Do not scale from width alone.

The script is `resources/[sunset]/sunset_ui/web/js/resolution-scale.js`. It sets `--ui-resolution-scale`, `--ui-user-scale`, and `--ui-scale` on resize, one frame at a time. Another NUI document does not inherit those variables. Standalone pages load the same file with `nui://sunset_ui/web/js/resolution-scale.js`.

## What is scaled

Screen-edge widgets scale as one piece from their anchor: phone, chat, notifications, hotbar, speedometer, HUD clusters, radar, taxi meter, interaction prompt, robbery HUD, mission offer.

The phone stays a 340×720 layout. `--s` is `min(--ui-scale, (100vh - 36px) / 720)`. At 1080p that is 1, at 1440p about 1.333, at 4K 2. Gallery lives inside the phone and is not scaled again. Camera chrome (shutter, flip, close, roll) scales. The camera view stays full screen. The GTA camera is not a CSS scale.

World tooltips still place themselves with `innerWidth` and `innerHeight`. Only the inner `.wt-scale` card grows.

The MDC tablet uses `min(uiScale, fit)` once, in `--mdc-scale`. Do not multiply that by `--ui-scale` again.

Fixed canvases that must stay on screen use `min(uiScale, viewport / designSize)`: inventory, scoreboard, battle pass.

The M menu, shop body, and tuning layer use a reference canvas: layout size is `100% / uiScale`, then `transform: scale(uiScale)` from the top left. At 1080p the factor is 1, so the layout is unchanged.

Job HUD already uses `clamp(vw, vh)`. Its caps now follow `--ui-scale`. It is not transform-scaled a second time.

## What is not scaled

Do not `transform: scale()` the document, a Leaflet map, or a world-coordinate layer.

Hacking keeps its own mouse and puzzle coordinates. The scale script is loaded so variables exist. The puzzle root is not transformed.

The intro page, slot reels, ox_inventory, ox_lib, ox_target, oxmysql, pma-voice, and screenshot-basic are not layout-scaled. Third-party pages do not share this CSS.

1px borders are left alone.

## Phone check

| Viewport | Phone scale | Device CSS pixels |
| --- | --- | --- |
| 1920×1080 | 1 | 340×720 |
| 2560×1440 | 1.333 | about 453×960 |
| 3840×2160 | 2 | 680×1440 |
