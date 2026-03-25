# Home Maintenance Tracker

A self-hosted web app for tracking recurring home maintenance tasks. Built with FastAPI, React, and PostgreSQL.

![License](https://img.shields.io/github/license/RustyBower/home-maintenance)

## Features

- **Onboarding wizard** — select what your home has (hot tub, pool, fireplace, irrigation, etc.) and auto-populate the right tasks
- **Dashboard** — see overdue, due today, and upcoming tasks at a glance with time estimates
- **Weekend planner** — "Plan my Saturday" view with tasks grouped by priority and running time totals
- **Seasonal timeline** — 12-month calendar view of everything coming up
- **Task management** — create, edit, complete, snooze, and delete tasks
- **Priority levels** — P1 (critical/safety), P2 (important), P3 (nice to have)
- **Time estimates** — track estimated and actual time per task
- **Weekend optimization** — auto-snap due dates to Saturday
- **Cost tracking** — log expenses per completion with yearly summaries by category
- **Supply inventory** — track consumables (filters, chemicals, etc.) with low-stock alerts
- **Completion history** — full log with notes, cost, duration, and photo URLs per completion
- **Home Assistant integration** — REST sensor endpoint at `/api/tasks/ha-sensor`

## Tech Stack

- **Backend**: Python 3.13, FastAPI, SQLAlchemy 2.0, Alembic
- **Frontend**: React 19, TypeScript, Vite, React Router, Lucide Icons, date-fns
- **Database**: PostgreSQL 16
- **Deployment**: Docker, Kubernetes (Kustomize)

## Quick Start

### Docker Compose (recommended)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: homemaint
      POSTGRES_PASSWORD: changeme
      POSTGRES_DB: homemaint
    volumes:
      - pgdata:/var/lib/postgresql/data

  migrate:
    build:
      context: .
      dockerfile: Dockerfile.migrator
    environment:
      DATABASE_URL: postgresql://homemaint:changeme@db:5432/homemaint
    depends_on:
      - db

  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://homemaint:changeme@db:5432/homemaint
    depends_on:
      migrate:
        condition: service_completed_successfully

volumes:
  pgdata:
```

```bash
docker compose up -d
# Open http://localhost:8000
```

### Local Development

```bash
# Start PostgreSQL
brew services start postgresql@15  # or use Docker
createdb homemaint

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install "fastapi[standard]" sqlalchemy alembic psycopg2-binary python-dateutil
PYTHONPATH=. DATABASE_URL=postgresql://localhost/homemaint alembic upgrade head
PYTHONPATH=. DATABASE_URL=postgresql://localhost/homemaint uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/tasks` | List tasks (filterable by category, frequency, priority, overdue) |
| `GET /api/tasks/dashboard` | Dashboard data (overdue, today, upcoming, time estimates) |
| `GET /api/tasks/weekend-planner` | Weekend plan grouped by priority |
| `GET /api/tasks/timeline` | 12-month task timeline |
| `GET /api/tasks/costs` | Yearly cost summary by category |
| `GET /api/tasks/ha-sensor` | Home Assistant REST sensor |
| `POST /api/tasks` | Create a task |
| `PATCH /api/tasks/:id` | Update a task |
| `POST /api/tasks/:id/complete` | Complete with notes, cost, duration, photo |
| `POST /api/tasks/:id/snooze` | Snooze by N days |
| `DELETE /api/tasks/:id` | Delete a task |
| `GET /api/supplies` | List supplies (filterable by task, low stock) |
| `POST /api/supplies` | Add a supply |
| `GET /api/setup/features` | Get available home feature presets |
| `POST /api/setup/populate` | Create tasks for selected features |

### Home Assistant Integration

Add a REST sensor to your `configuration.yaml`:

```yaml
sensor:
  - platform: rest
    resource: http://home-maintenance.home-maintenance.svc.cluster.local:8000/api/tasks/ha-sensor
    name: Home Maintenance
    value_template: "{{ value_json.state }}"
    json_attributes_path: "$.attributes"
    json_attributes:
      - overdue
      - due_today
      - next_task
      - next_due
```

## Kubernetes Deployment

See the [kustomize configs](https://github.com/RustyBower/kustomize) for a production deployment on K3s with:
- PostgreSQL StatefulSet with Longhorn storage
- Alembic migrations as an init container
- Ingress with TLS via cert-manager
- Sealed Secrets for credentials
- Homepage dashboard annotations

## License

MIT
