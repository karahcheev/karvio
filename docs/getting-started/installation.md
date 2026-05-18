# Installation

This guide covers a production deployment on a fresh Linux VM. The result is a working HTTPS installation with automatic TLS, persistent data, and an initial administrator account.

## What You Will Need

- A Linux VM (AlmaLinux 9, Ubuntu 22.04+, or Debian 12+) with at least 2 vCPU and 4 GB RAM
- A domain name with an A record pointing to the VM's public IP
- Port 80 and 443 open in the firewall (for TLS certificate issuance)
- Root or sudo access

The stack can run with Docker Compose or Podman Compose. The examples use the `docker compose` command; on Podman-based hosts, use `podman compose` where needed.

---

## Step 1 — Install the Container Runtime

=== "AlmaLinux / RHEL 9"

    ```bash
    dnf install -y podman podman-compose
    ```

=== "Ubuntu / Debian"

    ```bash
    apt-get update && apt-get install -y docker.io docker-compose-v2
    systemctl enable --now docker
    ```

Verify:

```bash
docker compose version   # Docker
podman-compose --version # Podman Compose
```

---

## Step 2 — Install Caddy (Reverse Proxy)

Caddy handles HTTPS automatically — it obtains and renews a Let's Encrypt certificate for your domain with no extra configuration.

=== "AlmaLinux / RHEL 9"

    ```bash
    dnf install -y 'dnf-command(copr)'
    dnf copr enable -y @caddy/caddy
    dnf install -y caddy
    ```

=== "Ubuntu / Debian"

    ```bash
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update && apt-get install -y caddy
    ```

---

## Step 3 — Clone the Repository

```bash
git clone https://github.com/karahcheev/karvio.git
cd karvio
```

---

## Step 4 — Configure the Stack

Open `docker-compose.yml` and fill in the deployment-specific values:

```bash
nano docker-compose.yml
```

Update these fields:

| Field | What to use |
|---|---|
| `POSTGRES_PASSWORD` in `x-postgres-env` | Run: `openssl rand -base64 32` |
| `APP_BASE_URL` | Your public HTTPS URL, for example `https://karvio.example.org` |
| `CHANGE_ME_STRONG_ADMIN_PASSWORD` | Choose a strong password for the initial `admin` user |
| `CHANGE_ME_LONG_RANDOM_SECRET` | Run: `openssl rand -base64 64` |

Also set `BOOTSTRAP_ENABLED: "true"` — this creates the admin account on first start.

!!! warning
    After the first successful login, set `BOOTSTRAP_ENABLED` back to `"false"` and restart the backend. Leaving it enabled means every restart re-runs the bootstrap logic.

Generate secrets in one go:

```bash
echo "DB password:    $(openssl rand -base64 32)"
echo "Auth secret:    $(openssl rand -base64 64)"
```

Do not commit secret values back to version control. Keep the production compose file on the server or manage the values through your deployment secret store.

---

## Step 5 — Start the Stack

```bash
docker compose -f docker-compose.yml up -d --build
```

The first run builds images and may take a few minutes. On subsequent starts, images are cached.

Check that all containers are running and healthy:

```bash
docker compose -f docker-compose.yml ps
```

Expected output: `postgres` and `backend` should be healthy; `frontend` and `procrastinate-worker` should be up.

```
NAME                         STATUS
karvio_postgres_1            Up (healthy)
karvio_backend_1             Up (healthy)
karvio_procrastinate-worker_1  Up
karvio_frontend_1            Up
```

If `backend` is stuck waiting, check logs:

```bash
docker compose -f docker-compose.yml logs backend
```

The backend waits for PostgreSQL to accept connections before running migrations. This is normal on first start and takes a few seconds.

---

## Step 6 — Configure Caddy

Create the Caddy config and replace `karvio.example.com` with your domain:

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
karvio.example.com {
    reverse_proxy 127.0.0.1:8080
}
EOF
```

Start Caddy and enable it on boot:

```bash
systemctl enable --now caddy
```

Caddy immediately starts obtaining a TLS certificate. This usually takes 10-30 seconds and requires port 80 to be reachable from the internet.

Verify the certificate was issued:

```bash
systemctl status caddy
```

Look for `certificate obtained` in the logs. Once done, your site is live at `https://your-domain`.

---

## Step 7 — Log In and Disable Bootstrap

Open your Karvio URL in a browser. Log in with:

- **Username:** `admin`
- **Password:** the value you set for `ADMIN_PASSWORD`

After logging in, disable bootstrap so it does not re-run on future restarts:

```bash
# Edit docker-compose.yml: set BOOTSTRAP_ENABLED: "false"
nano docker-compose.yml

# Recreate the backend container to pick up the change
docker compose -f docker-compose.yml up -d backend
```

---

## Verifying the Installation

```bash
# Frontend and API through Caddy
curl -fsS https://your-domain/api/v1/version

# Backend status directly from the host
curl -fsS http://127.0.0.1:8080/status

# PostgreSQL
docker compose -f docker-compose.yml exec postgres \
  sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

---

## Backups

### PostgreSQL

```bash
mkdir -p backups
docker compose -f docker-compose.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > backups/karvio-$(date +%Y%m%d-%H%M%S).dump
```

### File Storage (Attachments and Artifacts)

```bash
docker compose -f docker-compose.yml cp backend:/app/data/attachments backups/attachments
docker compose -f docker-compose.yml cp backend:/app/data/performance_artifacts backups/performance_artifacts
```

### Configuration

```bash
cp docker-compose.yml backups/docker-compose.yml.$(date +%Y%m%d-%H%M%S)
```

Automate database, file storage, and configuration backups with a daily job and store copies off-host.

---

## Updating Karvio

Always take a backup before updating.

```bash
git pull
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d
```

Database migrations run automatically on backend startup.

### Rolling Back

If the update fails and no migrations changed data:

```bash
git checkout <previous-tag-or-commit>
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d
```

If migrations already ran, restore the PostgreSQL backup taken before the update:

```bash
docker compose -f docker-compose.yml stop backend procrastinate-worker frontend

cat backups/karvio-YYYYMMDD-HHMMSS.dump | \
  docker compose -f docker-compose.yml exec -T postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists'

git checkout <previous-tag-or-commit>
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d
```

---

## Logs

```bash
# All services
docker compose -f docker-compose.yml logs -f

# One service
docker compose -f docker-compose.yml logs -f backend
```

---

## Configuration Reference

All settings go in the `environment` section of `docker-compose.yml`. See `config.example` for the full list.

| Setting | Default | Description |
|---|---|---|
| `POSTGRES_USER` | `karvio` | Database user |
| `POSTGRES_PASSWORD` | — | Database password — **must be set** |
| `POSTGRES_DB` | `karvio` | Database name |
| `APP_BASE_URL` | — | Public HTTPS URL — **must be set** |
| `ADMIN_PASSWORD` | — | Initial admin password — **must be set** |
| `AUTH_SECRET` | — | Session signing key — **must be set**, 64+ random bytes |
| `BOOTSTRAP_ENABLED` | `false` | Create admin account on startup. Enable for first run only. |
| `LOG_JSON` | `true` | Structured JSON logs |
| `METRICS_ENABLED` | `true` | Prometheus-compatible `/metrics` endpoint |
| `AUDIT_RETENTION_DAYS` | `365` | Days to keep audit log entries |
| `AI_TEST_CASE_ASSISTANT_ENABLED` | `false` | Enable AI test case generation |
| `AI_PROVIDER` | — | `openai` or other supported provider |
| `AI_MODEL` | — | Model name, e.g. `gpt-4o-mini` |
| `AI_API_KEY` | — | Server-side API key — never expose in frontend |
