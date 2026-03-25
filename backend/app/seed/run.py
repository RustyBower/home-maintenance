"""Seed the database with default maintenance tasks. Idempotent — skips if tasks exist."""

from sqlalchemy.orm import Session

from app.api.tasks import compute_next_due
from app.database import SessionLocal
from app.models.task import Task
from app.seed.tasks import SEED_TASKS


def seed():
    db: Session = SessionLocal()
    try:
        if db.query(Task).count() > 0:
            print("Database already has tasks, skipping seed.")
            return

        for data in SEED_TASKS:
            task = Task(**data)
            task.next_due = compute_next_due(task)
            db.add(task)

        db.commit()
        print(f"Seeded {len(SEED_TASKS)} maintenance tasks.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
