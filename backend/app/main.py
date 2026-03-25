from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.tasks import router as tasks_router, supplies_router
from app.api.setup import router as setup_router

app = FastAPI(title="Home Maintenance Tracker")

app.include_router(tasks_router)
app.include_router(supplies_router)
app.include_router(setup_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve frontend static files in production
static_dir = Path(__file__).parent.parent / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="frontend")
