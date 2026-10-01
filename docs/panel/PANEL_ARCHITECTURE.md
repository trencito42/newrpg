# Panel architecture (implemented state)

The Next.js panel and FXServer share MariaDB on the same VPS. FiveM owns gameplay state. The panel reads game tables, and writes only panel-owned sessions, polls, support, complaints, preferences and audit records. It must not update online character cash, inventory, vehicles, factions or sanctions directly.

Authentication uses existing `accounts.username` and modern scrypt `accounts.password_hash`, verified asynchronously. The browser receives an HttpOnly session cookie. Only its SHA-256 hash is stored in `panel_web_sessions`. Client components receive a restricted viewer DTO, never the cookie or token hash. Web PIN and legacy login are removed; the game's `auth_quick_tokens` is separate and unchanged.

Live status is not an HTTP call. `sunset_panel_bridge` writes one row to `panel_runtime_snapshot` every 15 seconds by default; the panel treats a row older than 45 seconds as offline. Migration `66-panel-hardening.sql` creates this table. The bridge currently does **not** consume staff actions. The staff dashboard is read-only for gameplay administration; ban, unban, mute, warn and faction operations must not be represented as successful web actions until an authoritative queue/consumer is implemented and tested.

Public profiles read progression and public vehicle/property lists. Cash and bank are queried only for the owner or staff. Public sanctions expose only warning count; reasons and staff identity are not fetched. The web panel handles poll votes transactionally, with an option/poll relationship checked both in code and by a composite foreign key.

Panel environment variables are documented in `panel/.env.example`. Database connection configuration has no password fallback and fails closed. Deploy behind a trusted HTTPS reverse proxy; set `PANEL_TRUST_PROXY=1` only if Next.js is bound to loopback and that proxy overwrites `X-Real-IP` and preserves `Host`/`Origin`.

This document describes current code, not a promise of full production readiness. Consult the deployment and security documents for the remaining gaps.
