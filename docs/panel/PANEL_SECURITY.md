# Panel security status

The panel database credential was previously committed as a fallback. **The operator must rotate that MariaDB password immediately** and update the deployment secrets. Removing the fallback from current source does not remove it from Git history. Do not paste the old or replacement secret into issues, commits or logs.

Current controls:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` are mandatory. Missing values fail closed.
- Web login accepts only modern game-compatible scrypt hashes; password verification is asynchronous and constant-time. No PIN or legacy web login exists.
- Failed login attempts are limited by username, a process-wide budget, and trusted IP when `PANEL_TRUST_PROXY=1`. This is a single-process limit; the HTTPS reverse proxy must also rate-limit login. Do not expose Next.js directly on a public interface when trusting proxy headers.
- Session cookies are HttpOnly, Secure in production and SameSite=Lax. Raw session credentials never enter client DTOs. Session activity writes are throttled.
- State-changing JSON routes check same-origin browser headers; GET logout was removed. Next server actions use the framework's origin checks. CSP uses a per-request nonce; HSTS is emitted in production. Proxy TLS configuration must be checked separately.
- Public profiles do not query cash/bank for anonymous viewers, and do not fetch sanction details. SQL is parameterized.
- Poll options must match their poll in both endpoint validation and a database composite foreign key.

Known limitations: Full browser E2E coverage and a disposable MariaDB migration/integration test are not yet present. Staff gameplay actions are not wired to an authoritative FiveM action queue. No production-readiness claim should be made until those paths are implemented and exercised. Review the actual reverse-proxy configuration before setting `PANEL_TRUST_PROXY=1`.
