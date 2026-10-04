# Nginx Reverse Proxy Requirements

## Media Upload (phone photos, avatars, vehicle previews)

The panel API endpoint `/api/media/upload` accepts binary image uploads from FiveM clients.

**No nginx config was found in this repository.** The web server sits outside the Docker Compose stack (see `docker-compose.yml` — only the `fivem` service is defined; the panel presumably runs behind a host-level nginx or Caddy).

### Required nginx directive (host nginx config)

Add to the `server {}` block that proxies the panel:

```nginx
# Must be ABOVE the app limit (3 MiB for phone_photo, 5 MiB for avatar/vehicle_preview).
# Without this, nginx returns a proxy-level 413 before the request reaches the app,
# and the FiveM client logs PROXY_OR_UPSTREAM_413 instead of APPLICATION_REJECTED_OVERSIZED.
client_max_body_size 10M;
```

### Why 10 M?

| Upload type      | App limit     | Expected max (WebP 0.78) |
|------------------|---------------|--------------------------|
| phone_photo      | 3 MiB         | ~600 KB at 1080p         |
| player_avatar    | 5 MiB         | varies                   |
| vehicle_preview  | 5 MiB         | varies                   |

The proxy limit of 10 M gives a comfortable ceiling above the largest app limit (5 MiB) while still blocking truly oversized payloads at the proxy before they reach Node.

### Verifying the limit is applied

```bash
# From the VPS, send a 6 MiB body and expect a 413 from the APP (JSON), not nginx (HTML):
dd if=/dev/urandom bs=1M count=6 | curl -s -X POST https://racket.cat/api/media/upload \
  -H 'X-Media-Type: player_avatar' \
  -H 'X-Media-Token: fake' \
  --data-binary @- | head -c 200
# Expected: {"ok":false,"code":"oversized"} (JSON from app, not nginx HTML)
```

If you see `<html>` or `413 Request Entity Too Large` in plain text, the nginx limit is too low.
