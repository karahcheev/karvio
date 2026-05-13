# Installation

Karvio runs as a Docker Compose stack with PostgreSQL, the FastAPI backend, a background worker, and a React frontend served by Nginx.

Use this guide for a self-hosted staging or production installation. For local feature development, use the repository development workflow instead.

!!! screenshot "SCREENSHOT TODO: Deployment Topology"
    Add a deployment diagram showing browser, reverse proxy, frontend, backend, PostgreSQL, worker, and persistent volumes.

## Production Topology

The production compose file starts these services:

| Service | Purpose | Network Exposure |
| --- | --- | --- |
| `frontend` | Serves the React app and proxies `/api/` to the backend. | Binds `127.0.0.1:8080` on the host. |
| `backend` | FastAPI application, migrations, API, status endpoint, metrics endpoint. | Internal Docker network only. |
| `procrastinate-worker` | Background jobs for audit, notifications, Jira sync, and import work. | Internal Docker network only. |
| `postgres` | PostgreSQL 16 database. | Internal Docker network only. |

For production, put a TLS-terminating reverse proxy in front of `127.0.0.1:8080`.

## Host Requirements

Minimum for evaluation:

- 2 vCPU
- 4 GB RAM
- 20 GB disk

Recommended starting point for production:

- 4 vCPU
- 8 GB RAM
- 100 GB SSD-backed disk
- automated backups for PostgreSQL and attachment volumes
- external monitoring for disk, CPU, memory, and HTTP health

Size disk for PostgreSQL data, uploaded attachments, performance artifacts, container images, and logs. Attachment-heavy teams should provision separate storage or aggressive backup/retention policies.

## Prerequisites

- Docker Engine 24 or later
- Docker Compose v2 (`docker compose` – no hyphen)
- A DNS name for the Karvio instance
- A TLS-capable reverse proxy such as Caddy, Nginx, Traefik, or a cloud load balancer
- SMTP and Jira credentials if those features will be enabled
- A secrets management process for production credentials

## Step 1 – Clone the Repository

```bash
git clone https://github.com/karahcheev/karvio.git
cd karvio
```

## Step 2 – Create the Production Configuration

The production compose file reads `config.prod`.

```bash
cp config.example config.prod
chmod 600 config.prod
```

Edit `config.prod` before first start.

### Required Settings

| Setting | Production Guidance |
| --- | --- |
| `POSTGRES_PASSWORD` | Use a long random password. Keep it out of version control. |
| `DATABASE_URL` | Must use the same PostgreSQL user/password/database as the `POSTGRES_*` values and host `postgres`. |
| `ADMIN_PASSWORD` | Initial admin password. Rotate after first login if shared during setup. |
| `AUTH_SECRET` | 64+ random bytes, base64 or hex encoded. Changing it invalidates existing sessions and tokens. |
| `APP_BASE_URL` | Public HTTPS URL, for example `https://karvio.example.com`. |
| `CORS_ORIGINS` | Public HTTPS frontend origin, for example `https://karvio.example.com`. |
| `VITE_API_BASE_URL` | Use `/api/v1` when frontend and API are served through the same reverse proxy origin. |
| `SESSION_COOKIE_SECURE` | Keep `true` for HTTPS production deployments. |
| `BOOTSTRAP_ENABLED` | Default is `false`. Temporarily set `true` only if you want startup to create the initial admin user and project. |

Generate secrets:

```bash
openssl rand -base64 64
openssl rand -base64 32
```

### Attachment and Artifact Storage

The production stack mounts Docker volumes into these backend paths:

| Setting | Default Container Path | Purpose |
| --- | --- | --- |
| `ATTACHMENT_STORAGE_DRIVER` | `localstorage` | Local file storage backend. |
| `ATTACHMENT_LOCAL_ROOT` | `/app/data/attachments` | Test case, step, draft step, and run item attachments. |
| `PERFORMANCE_ARTIFACT_ROOT` | `/app/data/performance_artifacts` | Imported performance artifacts and generated performance files. |

Back up both storage roots. They are not stored in PostgreSQL.

### Secret Policy

Treat `config.prod` as a secret file. It can contain:

- `AUTH_SECRET`
- `POSTGRES_PASSWORD`
- `ADMIN_PASSWORD`
- Jira credentials stored through the app or future environment overrides
- SMTP credentials stored through the app or future environment overrides
- AI provider keys if global AI fallback is enabled

Do not commit `config.prod`. Store production copies in a secrets manager, encrypted backup, or deployment secret store. Restrict shell access to hosts where this file is present.

## Step 3 – Start the Stack

```bash
docker compose -f docker-compose.prod.yml --env-file config.prod up -d --build
```

Migrations run automatically in the backend container before Uvicorn starts.

Check containers:

```bash
docker compose -f docker-compose.prod.yml --env-file config.prod ps
```

Karvio listens on `127.0.0.1:8080` on the host. It is intentionally not exposed on all interfaces.

## Step 4 – Configure HTTPS Reverse Proxy

### Port Scheme

| Path | Upstream |
| --- | --- |
| `https://karvio.example.com/` | `http://127.0.0.1:8080/` |
| `https://karvio.example.com/api/` | Handled by the frontend Nginx container and proxied to backend internally. |

### Caddy Example

```caddy
karvio.example.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:8080
}
```

### Nginx Example

```nginx
server {
  listen 80;
  server_name karvio.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name karvio.example.com;

  ssl_certificate /etc/letsencrypt/live/karvio.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/karvio.example.com/privkey.pem;

  client_max_body_size 300m;

  location / {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_pass http://127.0.0.1:8080;
  }
}
```

Set `client_max_body_size` high enough for your attachment and performance import limits.

## Step 5 – Bootstrap and Log In

If you temporarily set `BOOTSTRAP_ENABLED=true`, Karvio creates the default admin account at startup. Log in with:

- username: `admin`
- password: the value of `ADMIN_PASSWORD`

For production setups, return `BOOTSTRAP_ENABLED` to its default `false` after the initial setup window and manage users from an admin session.

Open:

```text
https://karvio.example.com
```

![Karvio sign-in screen](<../images/Sign in to Karvio.png>)

## Health Checks

Check the public UI and API through the reverse proxy:

```bash
curl -fsS https://karvio.example.com/
curl -fsS https://karvio.example.com/api/v1/version
```

Check backend status from the host through the frontend proxy:

```bash
curl -fsS http://127.0.0.1:8080/status
```

Check backend status inside Docker:

```bash
docker compose -f docker-compose.prod.yml --env-file config.prod exec backend \
  python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/status').read().decode())"
```

Check PostgreSQL:

```bash
docker compose -f docker-compose.prod.yml --env-file config.prod exec postgres \
  sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

## Logs

Follow all services:

```bash
docker compose -f docker-compose.prod.yml --env-file config.prod logs -f
```

Follow one service:

```bash
docker compose -f docker-compose.prod.yml --env-file config.prod logs -f backend
docker compose -f docker-compose.prod.yml --env-file config.prod logs -f procrastinate-worker
docker compose -f docker-compose.prod.yml --env-file config.prod logs -f frontend
docker compose -f docker-compose.prod.yml --env-file config.prod logs -f postgres
```

For production log aggregation, set `LOG_JSON=true` and ship container stdout/stderr to your logging platform.

## Backup

Create a backup directory:

```bash
mkdir -p backups
```

Back up PostgreSQL:

```bash
docker compose -f docker-compose.prod.yml --env-file config.prod exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > backups/karvio-$(date +%Y%m%d-%H%M%S).dump
```

Back up attachments and performance artifacts through the backend container:

```bash
docker compose -f docker-compose.prod.yml --env-file config.prod cp backend:/app/data/attachments backups/attachments
docker compose -f docker-compose.prod.yml --env-file config.prod cp backend:/app/data/performance_artifacts backups/performance_artifacts
```

Back up deployment configuration:

```bash
cp config.prod backups/config.prod.$(date +%Y%m%d-%H%M%S)
```

Encrypt backups before moving them off-host.

## Restore

Stop application services while keeping PostgreSQL available:

```bash
docker compose -f docker-compose.prod.yml --env-file config.prod stop backend procrastinate-worker frontend
```

Restore PostgreSQL from a custom-format dump:

```bash
cat backups/karvio-YYYYMMDD-HHMMSS.dump | docker compose -f docker-compose.prod.yml --env-file config.prod exec -T postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists'
```

Restore file storage:

```bash
docker compose -f docker-compose.prod.yml --env-file config.prod cp backups/attachments/. backend:/app/data/attachments
docker compose -f docker-compose.prod.yml --env-file config.prod cp backups/performance_artifacts/. backend:/app/data/performance_artifacts
```

Start services:

```bash
docker compose -f docker-compose.prod.yml --env-file config.prod up -d
```

Run the health checks again after restore.

## Updating Karvio

Before updating, create a fresh backup of PostgreSQL, attachments, performance artifacts, and `config.prod`.

```bash
git fetch --tags
git pull
docker compose -f docker-compose.prod.yml --env-file config.prod build
docker compose -f docker-compose.prod.yml --env-file config.prod up -d
```

Migrations run automatically on backend startup.

## Rollback After a Failed Update

If the new version fails before a database migration changed data, roll back the code and restart:

```bash
git checkout <previous-tag-or-commit>
docker compose -f docker-compose.prod.yml --env-file config.prod build
docker compose -f docker-compose.prod.yml --env-file config.prod up -d
```

If migrations already ran and the previous version cannot read the database, restore the database and file-storage backup taken before the update, then start the previous version.

Rollback checklist:

1. Capture logs from `backend`, `procrastinate-worker`, and `postgres`.
2. Stop `backend`, `procrastinate-worker`, and `frontend`.
3. Check out the previous release.
4. Restore PostgreSQL if migrations changed schema or data.
5. Restore attachments/artifacts only if the failed version wrote files that must be removed.
6. Start the stack.
7. Run health checks and a login smoke test.

## Configuration Reference

All settings are environment variables loaded from `config.prod` by Docker Compose. See `config.example` for the full list.

| Setting | Default | Description |
| --- | --- | --- |
| `BOOTSTRAP_ENABLED` | `false` | Create default admin user and project on startup when enabled. |
| `AUDIT_RETENTION_DAYS` | `365` | Days to keep audit log entries. |
| `ATTACHMENT_STORAGE_DRIVER` | `localstorage` | Attachment storage backend. |
| `ATTACHMENT_LOCAL_ROOT` | `/app/data/attachments` | Attachment storage path in the backend container. |
| `PERFORMANCE_ARTIFACT_ROOT` | `/app/data/performance_artifacts` | Performance artifact path in the backend and worker containers. |
| `LOG_JSON` | `true` | Emit structured JSON logs. |
| `METRICS_ENABLED` | `true` | Enable authenticated Prometheus metrics endpoint. |
| `JIRA_SYNC_CRON` | `*/5 * * * *` | Periodic Jira refresh schedule. |
| `AI_TEST_CASE_ASSISTANT_ENABLED` | `false` | Enable server-side AI test case generation, review, and duplicate suggestions. |
| `AI_PROVIDER` | `openai` | AI provider name when global fallback is enabled. |
| `AI_MODEL` | `gpt-4o-mini` | Model name for the configured AI provider. |
| `AI_API_KEY` | empty | Server-side AI provider key. Never expose this in frontend variables. |
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` in example | Browser-reachable API base URL. Use `/api/v1` behind the production frontend proxy. |

Project managers and system administrators can configure AI per project from **Settings -> AI**. Per-project settings are stored server-side, encrypt the provider API key, and take precedence over global fallback variables.
