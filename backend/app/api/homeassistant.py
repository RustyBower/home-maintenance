from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.task import Category, Supply, Task, TaskCompletion
from app.models.repair import Repair, RepairStatus
from app.models.checklist import ChecklistInstance
from app.api.tasks import compute_next_due, snap_to_weekend, task_to_out

router = APIRouter(prefix="/api/ha", tags=["homeassistant"])

# Device info shared across all MQTT discovery payloads
DEVICE_INFO = {
    "identifiers": ["home_maintenance_app"],
    "name": "Home Maintenance",
    "manufacturer": "Home Maintenance Tracker",
    "model": "Self-Hosted",
    "sw_version": "1.0",
}

STATE_TOPIC_PREFIX = "home_maintenance"


# --- Schemas ---

class WebhookPayload(BaseModel):
    action: str
    task_id: int | None = None
    days: int | None = None


# --- Sensors ---

@router.get("/sensors")
def all_sensors(db: Session = Depends(get_db)):
    """Return all sensor data in one call for HA REST integration."""
    today = date.today()
    week_out = today + timedelta(days=7)

    overdue_total = (
        db.query(func.count()).select_from(Task).filter(Task.next_due < today).scalar() or 0
    )
    due_today_total = (
        db.query(func.count()).select_from(Task).filter(Task.next_due == today).scalar() or 0
    )
    upcoming_7d_total = (
        db.query(func.count())
        .select_from(Task)
        .filter(Task.next_due > today, Task.next_due <= week_out)
        .scalar() or 0
    )

    # Overdue by category
    category_counts = (
        db.query(Task.category, func.count())
        .filter(Task.next_due < today)
        .group_by(Task.category)
        .all()
    )
    overdue_by_category = {cat.value: count for cat, count in category_counts}

    # Next upcoming task
    next_task_obj = db.query(Task).filter(Task.next_due >= today).order_by(Task.next_due).first()
    next_task = None
    if next_task_obj:
        next_task = {
            "name": next_task_obj.name,
            "due": next_task_obj.next_due.isoformat() if next_task_obj.next_due else None,
            "category": next_task_obj.category.value,
        }

    # Open repairs
    open_repairs = (
        db.query(func.count())
        .select_from(Repair)
        .filter(Repair.status != RepairStatus.RESOLVED)
        .scalar() or 0
    )

    # Total monthly cost (completions this month)
    current_month = today.month
    current_year = today.year
    monthly_cost = (
        db.query(func.coalesce(func.sum(TaskCompletion.cost), 0))
        .filter(
            TaskCompletion.cost.isnot(None),
            extract("month", TaskCompletion.completed_at) == current_month,
            extract("year", TaskCompletion.completed_at) == current_year,
        )
        .scalar()
    )

    # Low stock supplies
    low_stock = (
        db.query(func.count())
        .select_from(Supply)
        .filter(Supply.quantity_on_hand <= Supply.quantity_per_use)
        .scalar() or 0
    )

    # Active checklists (started but not completed)
    active_checklists = (
        db.query(func.count())
        .select_from(ChecklistInstance)
        .filter(ChecklistInstance.completed_at.is_(None))
        .scalar() or 0
    )

    return {
        "overdue_total": overdue_total,
        "due_today_total": due_today_total,
        "upcoming_7d_total": upcoming_7d_total,
        "overdue_by_category": overdue_by_category,
        "next_task": next_task,
        "open_repairs": open_repairs,
        "total_monthly_cost": float(monthly_cost),
        "low_stock_supplies": low_stock,
        "active_checklists": active_checklists,
    }


@router.get("/sensors/overdue")
def overdue_sensor(db: Session = Depends(get_db)):
    """Simple overdue count for a template sensor."""
    today = date.today()
    count = db.query(func.count()).select_from(Task).filter(Task.next_due < today).scalar() or 0
    return {"state": count, "unit_of_measurement": "tasks", "friendly_name": "Overdue Tasks"}


@router.get("/sensors/category/{category}")
def category_sensor(category: str, db: Session = Depends(get_db)):
    """Overdue count for a specific category."""
    try:
        cat_enum = Category(category)
    except ValueError:
        raise HTTPException(400, f"Invalid category: {category}")

    today = date.today()
    count = (
        db.query(func.count())
        .select_from(Task)
        .filter(Task.next_due < today, Task.category == cat_enum)
        .scalar() or 0
    )
    return {
        "state": count,
        "category": category,
        "unit_of_measurement": "tasks",
        "friendly_name": f"Overdue {category.replace('_', ' ').title()} Tasks",
    }


# --- Webhook ---

@router.post("/webhook")
def webhook_receiver(payload: WebhookPayload, db: Session = Depends(get_db)):
    """Accept HA automation webhooks to trigger actions."""
    if payload.action == "complete":
        if payload.task_id is None:
            raise HTTPException(400, "task_id is required for 'complete' action")
        task = db.get(Task, payload.task_id)
        if not task:
            raise HTTPException(404, "Task not found")
        completion = TaskCompletion(task_id=task.id)
        db.add(completion)
        task.next_due = compute_next_due(task)
        db.commit()
        db.refresh(task)
        return {"status": "ok", "action": "complete", "task_id": task.id, "next_due": task.next_due.isoformat() if task.next_due else None}

    elif payload.action == "snooze":
        if payload.task_id is None:
            raise HTTPException(400, "task_id is required for 'snooze' action")
        days = payload.days or 7
        task = db.get(Task, payload.task_id)
        if not task:
            raise HTTPException(404, "Task not found")
        base = task.next_due or date.today()
        new_date = base + timedelta(days=days)
        if task.prefer_weekend:
            new_date = snap_to_weekend(new_date)
        task.next_due = new_date
        db.commit()
        db.refresh(task)
        return {"status": "ok", "action": "snooze", "task_id": task.id, "next_due": task.next_due.isoformat() if task.next_due else None}

    elif payload.action == "send_digest":
        # Trigger digest via the notifications module
        from app.api.notifications import send_digest as _send_digest_endpoint
        # Call the digest function directly - it needs a db session
        # We re-use the notifications router's logic
        from app.api.notifications import _get_digest_data, _send_to_channel
        from app.models.notification import NotificationChannel
        channels = (
            db.query(NotificationChannel)
            .filter(NotificationChannel.enabled.is_(True))
            .all()
        )
        if not channels:
            return {"status": "ok", "message": "No enabled channels", "results": []}

        max_days = max(ch.notify_upcoming_days for ch in channels)
        overdue, due_today, upcoming = _get_digest_data(db, upcoming_days=max_days)
        results = []
        for ch in channels:
            try:
                _send_to_channel(ch, overdue, due_today, upcoming)
                results.append({"channel": ch.name, "status": "sent"})
            except Exception as e:
                results.append({"channel": ch.name, "status": f"error: {str(e)}"})

        return {"status": "ok", "action": "send_digest", "results": results}

    else:
        raise HTTPException(400, f"Unknown action: {payload.action}. Valid actions: complete, snooze, send_digest")


# --- MQTT Discovery ---

def _mqtt_sensor_payload(
    object_id: str,
    name: str,
    state_topic: str,
    icon: str,
    unit: str | None = None,
    value_template: str = "{{ value_json.state }}",
) -> dict:
    """Build a single MQTT discovery payload for a sensor."""
    payload: dict = {
        "name": name,
        "state_topic": state_topic,
        "value_template": value_template,
        "unique_id": f"home_maintenance_{object_id}",
        "icon": icon,
        "device": DEVICE_INFO,
    }
    if unit:
        payload["unit_of_measurement"] = unit
    return payload


def _mqtt_binary_sensor_payload(
    object_id: str,
    name: str,
    state_topic: str,
    icon: str,
    value_template: str = "{{ value_json.state }}",
) -> dict:
    """Build a single MQTT discovery payload for a binary sensor."""
    return {
        "name": name,
        "state_topic": state_topic,
        "value_template": value_template,
        "payload_on": "ON",
        "payload_off": "OFF",
        "unique_id": f"home_maintenance_{object_id}",
        "icon": icon,
        "device": DEVICE_INFO,
    }


@router.get("/mqtt-config")
def mqtt_discovery_config():
    """Return MQTT discovery payloads for Home Assistant auto-configuration."""
    categories = [c.value for c in Category]

    configs = []

    # Main sensors
    configs.append({
        "topic": "homeassistant/sensor/home_maintenance/overdue/config",
        "payload": _mqtt_sensor_payload(
            "overdue",
            "Home Maintenance Overdue",
            f"{STATE_TOPIC_PREFIX}/overdue",
            "mdi:alert-circle",
            "tasks",
        ),
    })

    configs.append({
        "topic": "homeassistant/sensor/home_maintenance/due_today/config",
        "payload": _mqtt_sensor_payload(
            "due_today",
            "Home Maintenance Due Today",
            f"{STATE_TOPIC_PREFIX}/due_today",
            "mdi:calendar-today",
            "tasks",
        ),
    })

    configs.append({
        "topic": "homeassistant/sensor/home_maintenance/upcoming/config",
        "payload": _mqtt_sensor_payload(
            "upcoming",
            "Home Maintenance Upcoming (7d)",
            f"{STATE_TOPIC_PREFIX}/upcoming",
            "mdi:calendar-week",
            "tasks",
        ),
    })

    # Binary sensor for has_overdue
    configs.append({
        "topic": "homeassistant/binary_sensor/home_maintenance/has_overdue/config",
        "payload": _mqtt_binary_sensor_payload(
            "has_overdue",
            "Home Maintenance Has Overdue",
            f"{STATE_TOPIC_PREFIX}/has_overdue",
            "mdi:home-alert",
        ),
    })

    # Per-category sensors
    for cat in categories:
        cat_label = cat.replace("_", " ").title()
        configs.append({
            "topic": f"homeassistant/sensor/home_maintenance/overdue_{cat}/config",
            "payload": _mqtt_sensor_payload(
                f"overdue_{cat}",
                f"Home Maintenance Overdue {cat_label}",
                f"{STATE_TOPIC_PREFIX}/overdue_{cat}",
                "mdi:alert-circle-outline",
                "tasks",
            ),
        })

    return {"configs": configs}
