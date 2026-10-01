# Sunset RPG Web Panel — Production Deployment Guide

## 1. Architecture Topology

```
                       ┌─────────────────────────┐
                       │  Cloudflare CDN / WAF   │
                       └────────────┬────────────┘
                                    │ HTTPS (443)
                                    ▼
                       ┌─────────────────────────┐
                       │    Reverse Proxy Nginx  │
                       │   (SSL Term + Rate Lim) │
                       └────────────┬────────────┘
                                    │ HTTP (127.0.0.1:3000)
                                    ▼
                       ┌─────────────────────────┐
                       │  Next.js Panel Service  │
                       │   (Node 20+ Non-Root)   │
                       └─────┬──────────────┬────┘
                             │              │
       MariaDB Pooled SQL    │              │ HTTP / Local Socket
       (127.0.0.1:3306)      │              │ (127.0.0.1:30120)
                             ▼              ▼
                    ┌─────────────┐   ┌─────────────┐
                    │   MariaDB   │   │ FiveM Game  │
                    │ `rpgblipmade│   │ Server Core │
                    └─────────────┘   └─────────────┘
```

---

## 2. Environment Variables Configuration

Create `/panel/.env.production` based on `.env.example`:

| Variable | Required | Example Value | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Enables React production optimizations |
| `PORT` | No | `3000` | Port for the Next.js HTTP server |
| `DATABASE_HOST` | **Yes** | `127.0.0.1` | MariaDB server host |
| `DATABASE_PORT` | No | `3306` | MariaDB port |
| `DATABASE_USER` | **Yes** | `rpgblipmade` | Dedicated MariaDB user |
| `DATABASE_PASSWORD` | **Yes** | `[REDACTED_SECRET]` | MariaDB user password |
| `DATABASE_NAME` | **Yes** | `rpgblipmade` | Database name |
| `DATABASE_CONNECTION_LIMIT` | No | `15` | Maximum pooled SQL connections |
| `SESSION_SECRET` | **Yes** | `64-char-random-hex` | Secret for cookie HMAC signature |
| `SESSION_EXPIRY_DAYS` | No | `14` | Session lifetime in days |
| `FIVEM_BRIDGE_URL` | No | `http://127.0.0.1:30120` | FiveM internal HTTP bridge address |
| `FIVEM_BRIDGE_SECRET` | No | `[OPTIONAL_SECRET]` | Shared bearer token for privileged bridge |

---

## 3. Database Least-Privilege Setup

To strictly separate permissions and prevent accidental or malicious schema modifications from web vulnerabilities, provision a restricted database user:

```sql
-- 1. Create panel runtime user
CREATE USER IF NOT EXISTS 'panel_app'@'127.0.0.1' IDENTIFIED BY 'STRONG_SECRET_HERE';

-- 2. Grant SELECT only on game tables
GRANT SELECT ON `rpgblipmade`.`accounts` TO 'panel_app'@'127.0.0.1';
GRANT SELECT ON `rpgblipmade`.`players` TO 'panel_app'@'127.0.0.1';
GRANT SELECT ON `rpgblipmade`.`characters` TO 'panel_app'@'127.0.0.1';
GRANT SELECT ON `rpgblipmade`.`factions` TO 'panel_app'@'127.0.0.1';
GRANT SELECT ON `rpgblipmade`.`vehicles` TO 'panel_app'@'127.0.0.1';
GRANT SELECT ON `rpgblipmade`.`properties` TO 'panel_app'@'127.0.0.1';
GRANT SELECT ON `rpgblipmade`.`turfs` TO 'panel_app'@'127.0.0.1';
GRANT SELECT ON `rpgblipmade`.`bans` TO 'panel_app'@'127.0.0.1';
GRANT SELECT ON `rpgblipmade`.`admin_sanctions` TO 'panel_app'@'127.0.0.1';
GRANT SELECT ON `rpgblipmade`.`job_progress` TO 'panel_app'@'127.0.0.1';
GRANT SELECT ON `rpgblipmade`.`fishing_tournament_history` TO 'panel_app'@'127.0.0.1';

-- 3. Grant full CRUD ONLY on panel-owned tables
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_web_sessions` TO 'panel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_link_tokens` TO 'panel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_polls` TO 'panel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_poll_options` TO 'panel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_poll_votes` TO 'panel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_support_tickets` TO 'panel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_ticket_messages` TO 'panel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_complaints` TO 'panel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_complaint_messages` TO 'panel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_unban_requests` TO 'panel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_audit_log` TO 'panel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_stat_snapshots` TO 'panel_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `rpgblipmade`.`panel_preferences` TO 'panel_app'@'127.0.0.1';

FLUSH PRIVILEGES;
```

---

## 4. Multi-Stage Dockerfile Deployment

A production-ready `Dockerfile` using non-root `nodejs:nextjs` user:

```bash
cd /home/blipmade-rpg/htdocs/rpg.blipmade.com/panel
docker build -t sunset-rpg-panel:latest .
docker run -d \
  --name sunset-panel \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  --env-file .env.production \
  sunset-rpg-panel:latest
```

---

## 5. Systemd Service Deployment (Bare Metal / VM)

If running without Docker under systemd:

Create `/etc/systemd/system/sunset-panel.service`:

```ini
[Unit]
Description=Sunset RPG Next.js Web Panel
After=network.target mariadb.service

[Service]
Type=simple
User=blipmade-rpg
WorkingDirectory=/home/blipmade-rpg/htdocs/rpg.blipmade.com/panel
Environment=NODE_ENV=production
EnvironmentFile=/home/blipmade-rpg/htdocs/rpg.blipmade.com/panel/.env.production
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sunset-panel

# Security Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sunset-panel
sudo systemctl status sunset-panel
```

---

## 6. Nginx Reverse Proxy Configuration

```nginx
server {
    listen 80;
    server_name panel.rpg.blipmade.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name panel.rpg.blipmade.com;

    ssl_certificate /etc/letsencrypt/live/panel.rpg.blipmade.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/panel.rpg.blipmade.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:;" always;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # Static Asset Caching
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

---

## 7. Health & Readiness Verification

Run verification against local running instance:
```bash
curl -i http://127.0.0.1:3000/api/health
```

Expected response:
```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "healthy",
  "database": "connected",
  "timestamp": 1727784000000
}
```
