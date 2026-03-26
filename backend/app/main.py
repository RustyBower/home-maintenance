from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.tasks import router as tasks_router, supplies_router
from app.api.assets import router as assets_router
from app.api.contractors import router as contractors_router
from app.api.repairs import router as repairs_router
from app.api.activity import router as activity_router
from app.api.documents import router as documents_router
from app.api.setup import router as setup_router
from app.api.notifications import router as notifications_router
from app.api.expenses import router as expenses_router
from app.api.checklists import router as checklists_router
from app.api.export import router as export_router

app = FastAPI(title="Home Maintenance Tracker")

app.include_router(tasks_router)
app.include_router(supplies_router)
app.include_router(assets_router)
app.include_router(contractors_router)
app.include_router(repairs_router)
app.include_router(activity_router)
app.include_router(documents_router)
app.include_router(setup_router)
app.include_router(notifications_router)
app.include_router(expenses_router)
app.include_router(checklists_router)
app.include_router(export_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve frontend static files in production
static_dir = Path(__file__).parent.parent / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="frontend")
