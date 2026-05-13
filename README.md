# Karvio

A self-hosted test management system (TMS) for QA teams. Manage test cases, plan and execute test runs, track results across environments and milestones, and monitor performance over time.

## Features

- **Test cases** — create and organize test cases with priority, tags, suites, and ownership
- **Test runs** — execute tests, track results per item, assign to team members, link to builds and environments
- **Test plans** — group test cases into plans for organized test campaigns
- **Performance tracking** — store and visualize performance artifacts from test runs
- **Environments & milestones** — multi-environment support with configuration revisions and release tracking
- **Jira integration** — sync test data with Jira issues
- **Audit trail** — full history of changes across the system
- **Metrics & observability** — Prometheus-compatible `/metrics` endpoint, structured JSON logging, request tracing

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, procrastinate |
| Database | PostgreSQL 16 (also backs the background-job queue) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Production serving | Nginx |
| Containerization | Docker, Docker Compose |

## Getting Started

### Prerequisites

- Docker and Docker Compose

### 1. Configure

Copy the example config and fill in your values:

```bash
cp config.example config
```

Key settings to update:

| Setting | Description |
|---------|-------------|
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `ADMIN_PASSWORD` | Initial admin account password |
| `AUTH_SECRET` | JWT signing secret — generate with `openssl rand -base64 64` |
| `APP_BASE_URL` | Public URL of the backend (e.g. `http://localhost:8000`) |
| `CORS_ORIGINS` | Allowed frontend origins (e.g. `http://localhost:5173`) |
| `VITE_API_BASE_URL` | Browser-reachable API URL (e.g. `http://localhost:8000`) |

### 2. Run (development)

```bash
docker compose -f docker-compose.dev.yml up
```

Services started:

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | Vite dev server with HMR |
| Backend | 8000 | FastAPI with auto-reload |
| PostgreSQL | 5432 | Database (also backs the procrastinate job queue) |
| procrastinate-worker | — | Background-job worker |

The backend automatically applies database migrations on startup.

Access the app at **http://localhost:5173**. API docs at **http://localhost:8000/docs**.

### 3. Run (production)

```bash
cp config.example config.prod  # create and edit production config
docker compose -f docker-compose.prod.yml up -d
```

The production stack serves the frontend as static files via Nginx on port **8080**. Database and backend are on an internal network with no exposed ports.

## Project Structure

```
karvio/
├── backend/
│   ├── app/
│   │   ├── api/          # Router setup
│   │   ├── core/         # Config, auth, middleware, metrics
│   │   ├── modules/      # Feature modules (test_runs, test_cases, …)
│   │   ├── models/       # ORM models and enums
│   │   ├── repositories/ # Data access layer
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   └── services/     # Business logic
│   ├── alembic/          # Database migrations
│   └── tests/
├── ui/
│   └── src/
│       ├── app/          # Root app, routing, providers
│       ├── modules/      # Feature UI modules
│       └── shared/       # Reusable components, API client, hooks
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── config.example
```

## Development

### Backend

```bash
cd backend
pip install -e ".[dev]"
pytest                  # run tests
ruff check app/         # lint
```

### Frontend

```bash
cd ui
npm install
npm run dev             # start dev server
npm run test            # run tests
npm run lint            # lint
```

## Configuration Reference

All configuration is loaded from the `config` file (or `config.prod` for production) as environment variables. See [`config.example`](config.example) for the full list with descriptions.

Notable options:

- `BOOTSTRAP_ENABLED` — defaults to `false`; set to `true` only when you want startup to create the initial admin user and project
- `AUDIT_RETENTION_DAYS` — how long to keep audit log entries
- `ATTACHMENT_STORAGE_DRIVER` — file storage backend (`local` by default)
- `LOG_JSON` — emit logs as JSON (recommended for production)
- `JIRA_SYNC_CRON` — cron expression that drives the periodic Jira refresh task
