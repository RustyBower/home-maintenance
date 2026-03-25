# CLAUDE.md

## Project Overview

Home maintenance task tracker — a self-hosted web app for managing recurring home maintenance. FastAPI backend + React frontend + PostgreSQL.

## Repository Structure

```
home-maintenance/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   │   ├── tasks.py  # Task CRUD, dashboard, weekend planner, timeline, costs, HA sensor
│   │   │   └── setup.py  # Onboarding wizard — home feature presets
│   │   ├── models/       # SQLAlchemy models (Task, TaskCompletion, Supply)
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── seed/         # Legacy seed data (superseded by setup.py feature presets)
│   │   ├── database.py   # DB engine, session, Base
│   │   └── main.py       # FastAPI app, router registration, static file serving
│   ├── migrations/       # Alembic migrations
│   ├── alembic.ini
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api.ts        # API client, types, constants (categories, priorities, colors)
│   │   ├── App.tsx       # Router + sidebar navigation
│   │   ├── App.css       # Global styles (dark theme)
│   │   └── pages/        # Dashboard, TaskList, TaskDetail, AddTask, WeekendPlanner,
│   │                     #   Timeline, Costs, Supplies, Setup
│   ├── vite.config.ts    # Dev proxy: /api -> localhost:8000
│   └── package.json
├── Dockerfile            # Multi-stage: build frontend + serve via FastAPI
├── Dockerfile.migrator   # Runs alembic upgrade head + seed
└── .dockerignore
```

## Build & Run Commands

```bash
# Backend (from backend/)
source .venv/bin/activate
PYTHONPATH=. DATABASE_URL=postgresql://homemaint:homemaint@localhost:5432/homemaint uvicorn app.main:app --reload --port 8000

# Frontend (from frontend/)
npm run dev          # Dev server with HMR (proxies /api to :8000)
npm run build        # Production build to dist/

# Migrations (from backend/)
PYTHONPATH=. DATABASE_URL=... alembic upgrade head
PYTHONPATH=. DATABASE_URL=... alembic revision --autogenerate -m "description"

# Seed (legacy, prefer setup wizard)
PYTHONPATH=. DATABASE_URL=... python -m app.seed.run
```

## Architecture Notes

- **DATABASE_URL** env var configures the connection. Defaults to `postgresql://homemaint:homemaint@localhost:5432/homemaint`.
- Backend serves the built frontend from `backend/static/` in production (Dockerfile copies it there).
- In dev, Vite proxies `/api` requests to the backend.
- The migrator Docker image runs `alembic upgrade head` then seeds via `app.seed.run`. It runs as a Kubernetes init container.
- Task due dates auto-snap to Saturday when `prefer_weekend` is enabled on a task.
- Priority enum values are uppercase in Postgres (`P1`, `P2`, `P3`) but lowercase in the Python/API layer (`p1`, `p2`, `p3`).

## Key Patterns

- **Task completion** recomputes `next_due` based on frequency and weekend preference.
- **Snooze** offsets from current `next_due`, not from today.
- **Setup wizard** (`/api/setup/populate`) is idempotent — skips tasks that already exist by name.
- **Supplies** are linked to tasks. Low stock = `quantity_on_hand <= quantity_per_use`.
- **HA sensor** at `/api/tasks/ha-sensor` returns overdue count as state with attributes.
