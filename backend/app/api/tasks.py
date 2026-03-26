from datetime import date, timedelta

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.task import Category, Frequency, Priority, Season, Supply, Task, TaskCompletion
from app.services.activity import log_activity
from app.schemas.task import (
    CompleteTask,
    SnoozeTask,
    SupplyCreate,
    SupplyOut,
    SupplyUpdate,
    TaskCompletionOut,
    TaskCreate,
    TaskOut,
    TaskUpdate,
    TaskWithHistory,
)

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

# Map seasons to approximate month targets (Midwest US)
SEASON_MONTHS = {
    Season.SPRING: 4,   # April
    Season.SUMMER: 6,   # June
    Season.FALL: 10,    # October
    Season.WINTER: 12,  # December
}


def snap_to_weekend(d: date) -> date:
    """Move a date to the nearest Saturday."""
    weekday = d.weekday()  # 0=Mon, 5=Sat, 6=Sun
    if weekday == 5:
        return d
    if weekday == 6:
        return d + timedelta(days=6)  # next Saturday
    # Mon-Fri: move to next Saturday
    days_until_sat = 5 - weekday
    return d + timedelta(days=days_until_sat)


def compute_next_due(task: Task, from_date: date | None = None) -> date:
    base = from_date or date.today()
    match task.frequency:
        case Frequency.WEEKLY:
            result = base + timedelta(weeks=1)
        case Frequency.MONTHLY:
            result = base + relativedelta(months=1)
        case Frequency.QUARTERLY:
            result = base + relativedelta(months=3)
        case Frequency.SEASONAL:
            target_month = SEASON_MONTHS.get(task.season, 4)
            result = date(base.year, target_month, 1)
            if result <= base:
                result = date(base.year + 1, target_month, 1)
        case Frequency.ANNUAL:
            result = base + relativedelta(years=1)
        case Frequency.BIANNUAL:
            result = base + relativedelta(years=2)
        case Frequency.CUSTOM_DAYS:
            days = task.custom_interval_days or 30
            result = base + timedelta(days=days)
        case _:
            result = base + relativedelta(months=1)

    if task.prefer_weekend:
        result = snap_to_weekend(result)

    return result


def task_to_out(task: Task) -> TaskOut:
    last = task.completions[0].completed_at if task.completions else None
    data = TaskOut.model_validate(task, from_attributes=True)
    data.last_completed = last
    return data


@router.get("", response_model=list[TaskOut])
def list_tasks(
    category: Category | None = None,
    frequency: Frequency | None = None,
    priority: Priority | None = None,
    overdue: bool | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Task)
    if category:
        q = q.filter(Task.category == category)
    if frequency:
        q = q.filter(Task.frequency == frequency)
    if priority:
        q = q.filter(Task.priority == priority)
    if overdue is True:
        q = q.filter(Task.next_due <= date.today())
    elif overdue is False:
        q = q.filter(Task.next_due > date.today())
    tasks = q.order_by(Task.next_due.asc().nullslast(), Task.name).all()
    return [task_to_out(t) for t in tasks]


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db)):
    today = date.today()
    week_out = today + timedelta(days=7)

    overdue = db.query(Task).filter(Task.next_due < today).order_by(Task.priority, Task.next_due).all()
    due_today = db.query(Task).filter(Task.next_due == today).order_by(Task.priority).all()
    upcoming = (
        db.query(Task)
        .filter(Task.next_due > today, Task.next_due <= week_out)
        .order_by(Task.next_due, Task.priority)
        .all()
    )
    recent_completions = (
        db.query(TaskCompletion)
        .order_by(TaskCompletion.completed_at.desc())
        .limit(10)
        .all()
    )

    category_counts = (
        db.query(Task.category, func.count())
        .filter(Task.next_due < today)
        .group_by(Task.category)
        .all()
    )

    # Total time estimates
    overdue_minutes = sum(t.estimated_minutes or 0 for t in overdue)
    today_minutes = sum(t.estimated_minutes or 0 for t in due_today)
    upcoming_minutes = sum(t.estimated_minutes or 0 for t in upcoming)

    return {
        "overdue": [task_to_out(t) for t in overdue],
        "due_today": [task_to_out(t) for t in due_today],
        "upcoming": [task_to_out(t) for t in upcoming],
        "recent_completions": [
            TaskCompletionOut.model_validate(c, from_attributes=True)
            for c in recent_completions
        ],
        "overdue_by_category": {cat.value: count for cat, count in category_counts},
        "time_estimates": {
            "overdue_minutes": overdue_minutes,
            "today_minutes": today_minutes,
            "upcoming_minutes": upcoming_minutes,
        },
    }


@router.get("/weekend-planner")
def weekend_planner(db: Session = Depends(get_db)):
    """Get tasks for the upcoming weekend, sorted by priority with time totals."""
    today = date.today()
    # Find next Saturday
    days_to_sat = (5 - today.weekday()) % 7
    if days_to_sat == 0 and today.weekday() != 5:
        days_to_sat = 7
    next_saturday = today + timedelta(days=days_to_sat)
    next_sunday = next_saturday + timedelta(days=1)

    # Get overdue + due through the weekend
    tasks = (
        db.query(Task)
        .filter(Task.next_due <= next_sunday)
        .order_by(Task.priority, Task.next_due)
        .all()
    )

    total_minutes = sum(t.estimated_minutes or 0 for t in tasks)
    by_priority = {}
    for t in tasks:
        p = t.priority.value
        if p not in by_priority:
            by_priority[p] = {"tasks": [], "total_minutes": 0}
        by_priority[p]["tasks"].append(task_to_out(t))
        by_priority[p]["total_minutes"] += t.estimated_minutes or 0

    return {
        "weekend_date": next_saturday.isoformat(),
        "tasks": [task_to_out(t) for t in tasks],
        "total_tasks": len(tasks),
        "total_minutes": total_minutes,
        "by_priority": by_priority,
    }


@router.get("/timeline")
def seasonal_timeline(db: Session = Depends(get_db)):
    """Get all tasks organized by month/season for a year overview."""
    today = date.today()
    year_out = today + relativedelta(years=1)
    tasks = db.query(Task).order_by(Task.next_due.asc().nullslast()).all()

    months: dict[str, list] = {}
    for t in tasks:
        if t.next_due and t.next_due <= year_out:
            key = t.next_due.strftime("%Y-%m")
            if key not in months:
                months[key] = []
            months[key].append(task_to_out(t))

    return {"months": months}


@router.get("/costs")
def cost_summary(year: int | None = None, db: Session = Depends(get_db)):
    """Get cost summary from completions."""
    target_year = year or date.today().year

    completions = (
        db.query(TaskCompletion)
        .filter(
            TaskCompletion.cost.isnot(None),
            extract("year", TaskCompletion.completed_at) == target_year,
        )
        .order_by(TaskCompletion.completed_at.desc())
        .all()
    )

    total = sum(float(c.cost) for c in completions)

    # By category via join
    by_category = (
        db.query(Task.category, func.sum(TaskCompletion.cost))
        .join(TaskCompletion)
        .filter(
            TaskCompletion.cost.isnot(None),
            extract("year", TaskCompletion.completed_at) == target_year,
        )
        .group_by(Task.category)
        .all()
    )

    return {
        "year": target_year,
        "total_cost": total,
        "by_category": {cat.value: float(amount) for cat, amount in by_category},
        "completions": [
            TaskCompletionOut.model_validate(c, from_attributes=True)
            for c in completions
        ],
    }


@router.get("/ha-sensor")
def home_assistant_sensor(db: Session = Depends(get_db)):
    """Home Assistant REST sensor endpoint."""
    today = date.today()
    overdue_count = db.query(func.count()).select_from(Task).filter(Task.next_due < today).scalar()
    due_today_count = db.query(func.count()).select_from(Task).filter(Task.next_due == today).scalar()
    next_task = db.query(Task).filter(Task.next_due >= today).order_by(Task.next_due).first()

    return {
        "state": overdue_count,
        "attributes": {
            "overdue": overdue_count,
            "due_today": due_today_count,
            "next_task": next_task.name if next_task else None,
            "next_due": next_task.next_due.isoformat() if next_task and next_task.next_due else None,
            "friendly_name": "Home Maintenance",
            "unit_of_measurement": "tasks",
            "icon": "mdi:home-alert",
        },
        "_note": "This endpoint is maintained for backwards compatibility. See /api/ha/sensors for richer data.",
    }


@router.post("", response_model=TaskOut, status_code=201)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**data.model_dump())
    if task.next_due is None:
        task.next_due = compute_next_due(task)
    db.add(task)
    db.commit()
    db.refresh(task)
    log_activity(db, "created", "task", task.id, task.name)
    return task_to_out(task)


@router.get("/{task_id}", response_model=TaskWithHistory)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    last = task.completions[0].completed_at if task.completions else None
    data = TaskWithHistory.model_validate(task, from_attributes=True)
    data.last_completed = last
    return data


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    log_activity(db, "updated", "task", task.id, task.name)
    return task_to_out(task)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    task_name = task.name
    db.delete(task)
    db.commit()
    log_activity(db, "deleted", "task", task_id, task_name)


@router.post("/{task_id}/complete", response_model=TaskOut)
def complete_task(task_id: int, data: CompleteTask, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    completion = TaskCompletion(
        task_id=task.id,
        notes=data.notes,
        cost=data.cost,
        photo_url=data.photo_url,
        duration_minutes=data.duration_minutes,
    )
    db.add(completion)
    task.next_due = compute_next_due(task)
    db.commit()
    db.refresh(task)
    details_parts = []
    if data.cost:
        details_parts.append(f"Cost: ${data.cost:.2f}")
    if data.duration_minutes:
        details_parts.append(f"{data.duration_minutes}min")
    log_activity(db, "completed", "task", task.id, task.name, "; ".join(details_parts) or None)
    return task_to_out(task)


@router.post("/{task_id}/snooze", response_model=TaskOut)
def snooze_task(task_id: int, data: SnoozeTask, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    base = task.next_due or date.today()
    new_date = base + timedelta(days=data.days)
    if task.prefer_weekend:
        new_date = snap_to_weekend(new_date)
    task.next_due = new_date
    db.commit()
    db.refresh(task)
    log_activity(db, "snoozed", "task", task.id, task.name, f"Snoozed by {data.days} days")
    return task_to_out(task)


@router.get("/{task_id}/history", response_model=list[TaskCompletionOut])
def get_task_history(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return [
        TaskCompletionOut.model_validate(c, from_attributes=True)
        for c in task.completions
    ]


# === Supplies ===

supplies_router = APIRouter(prefix="/api/supplies", tags=["supplies"])


@supplies_router.get("", response_model=list[SupplyOut])
def list_supplies(task_id: int | None = None, low_stock: bool = False, db: Session = Depends(get_db)):
    q = db.query(Supply)
    if task_id:
        q = q.filter(Supply.task_id == task_id)
    if low_stock:
        q = q.filter(Supply.quantity_on_hand <= Supply.quantity_per_use)
    return [SupplyOut.model_validate(s, from_attributes=True) for s in q.all()]


@supplies_router.post("", response_model=SupplyOut, status_code=201)
def create_supply(task_id: int, data: SupplyCreate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    supply = Supply(task_id=task_id, **data.model_dump())
    db.add(supply)
    db.commit()
    db.refresh(supply)
    return SupplyOut.model_validate(supply, from_attributes=True)


@supplies_router.patch("/{supply_id}", response_model=SupplyOut)
def update_supply(supply_id: int, data: SupplyUpdate, db: Session = Depends(get_db)):
    supply = db.get(Supply, supply_id)
    if not supply:
        raise HTTPException(404, "Supply not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(supply, field, value)
    db.commit()
    db.refresh(supply)
    return SupplyOut.model_validate(supply, from_attributes=True)


@supplies_router.delete("/{supply_id}", status_code=204)
def delete_supply(supply_id: int, db: Session = Depends(get_db)):
    supply = db.get(Supply, supply_id)
    if not supply:
        raise HTTPException(404, "Supply not found")
    db.delete(supply)
    db.commit()
