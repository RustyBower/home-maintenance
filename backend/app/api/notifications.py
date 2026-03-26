import json
import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.notification import ChannelType, NotificationChannel
from app.models.task import Task
from app.schemas.notification import (
    ChannelCreate,
    ChannelOut,
    ChannelUpdate,
    DigestPreview,
    DigestTask,
)
from app.services.notifier import (
    format_digest_email,
    format_digest_ntfy,
    format_digest_webhook,
    send_email,
    send_ntfy,
    send_webhook,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _channel_to_out(ch: NotificationChannel) -> ChannelOut:
    return ChannelOut(
        id=ch.id,
        name=ch.name,
        channel_type=ch.channel_type,
        enabled=ch.enabled,
        config=json.loads(ch.config),
        notify_overdue=ch.notify_overdue,
        notify_due_today=ch.notify_due_today,
        notify_upcoming_days=ch.notify_upcoming_days,
        created_at=ch.created_at,
        updated_at=ch.updated_at,
    )


def _get_digest_data(db: Session, upcoming_days: int = 7):
    """Query overdue, due today, and upcoming tasks."""
    today = date.today()
    overdue = (
        db.query(Task)
        .filter(Task.next_due < today)
        .order_by(Task.priority, Task.next_due)
        .all()
    )
    due_today = (
        db.query(Task)
        .filter(Task.next_due == today)
        .order_by(Task.priority)
        .all()
    )
    upcoming = []
    if upcoming_days > 0:
        end = today + timedelta(days=upcoming_days)
        upcoming = (
            db.query(Task)
            .filter(Task.next_due > today, Task.next_due <= end)
            .order_by(Task.next_due, Task.priority)
            .all()
        )
    return overdue, due_today, upcoming


def _send_to_channel(channel: NotificationChannel, overdue, due_today, upcoming) -> str:
    """Send digest to a single channel. Returns status string."""
    config = json.loads(channel.config)

    # Filter lists based on channel preferences
    ch_overdue = overdue if channel.notify_overdue else []
    ch_due_today = due_today if channel.notify_due_today else []
    ch_upcoming = upcoming if channel.notify_upcoming_days > 0 else []

    if not ch_overdue and not ch_due_today and not ch_upcoming:
        return "skipped (nothing to send based on channel settings)"

    if channel.channel_type == ChannelType.EMAIL:
        html, text = format_digest_email(ch_overdue, ch_due_today, ch_upcoming)
        subject = "Home Maintenance Digest"
        if ch_overdue:
            subject += f" — {len(ch_overdue)} overdue"
        send_email(config, subject, html, text)
        return "sent"

    elif channel.channel_type == ChannelType.WEBHOOK:
        payload = format_digest_webhook(ch_overdue, ch_due_today, ch_upcoming)
        send_webhook(config, payload)
        return "sent"

    elif channel.channel_type == ChannelType.NTFY:
        title, message, priority = format_digest_ntfy(ch_overdue, ch_due_today, ch_upcoming)
        send_ntfy(config, title, message, priority)
        return "sent"

    return "unknown channel type"


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

@router.get("/channels", response_model=list[ChannelOut])
def list_channels(db: Session = Depends(get_db)):
    channels = db.query(NotificationChannel).order_by(NotificationChannel.name).all()
    return [_channel_to_out(ch) for ch in channels]


@router.post("/channels", response_model=ChannelOut, status_code=201)
def create_channel(data: ChannelCreate, db: Session = Depends(get_db)):
    channel = NotificationChannel(
        name=data.name,
        channel_type=data.channel_type,
        enabled=data.enabled,
        config=json.dumps(data.config),
        notify_overdue=data.notify_overdue,
        notify_due_today=data.notify_due_today,
        notify_upcoming_days=data.notify_upcoming_days,
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return _channel_to_out(channel)


@router.patch("/channels/{channel_id}", response_model=ChannelOut)
def update_channel(channel_id: int, data: ChannelUpdate, db: Session = Depends(get_db)):
    channel = db.get(NotificationChannel, channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")
    updates = data.model_dump(exclude_unset=True)
    if "config" in updates:
        updates["config"] = json.dumps(updates["config"])
    for field, value in updates.items():
        setattr(channel, field, value)
    db.commit()
    db.refresh(channel)
    return _channel_to_out(channel)


@router.delete("/channels/{channel_id}", status_code=204)
def delete_channel(channel_id: int, db: Session = Depends(get_db)):
    channel = db.get(NotificationChannel, channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")
    db.delete(channel)
    db.commit()


# ---------------------------------------------------------------------------
# Test / Send / Preview
# ---------------------------------------------------------------------------

@router.post("/channels/{channel_id}/test")
def test_channel(channel_id: int, db: Session = Depends(get_db)):
    """Send a test notification through this channel."""
    channel = db.get(NotificationChannel, channel_id)
    if not channel:
        raise HTTPException(404, "Channel not found")
    config = json.loads(channel.config)
    try:
        if channel.channel_type == ChannelType.EMAIL:
            send_email(
                config,
                "Home Maintenance — Test Notification",
                "<html><body><h1>Test</h1><p>Your email notification channel is working.</p></body></html>",
                "Test — your email notification channel is working.",
            )
        elif channel.channel_type == ChannelType.WEBHOOK:
            send_webhook(config, {
                "test": True,
                "message": "Home Maintenance test notification",
                "overdue": [],
                "due_today": [],
                "upcoming": [],
                "total_overdue": 0,
                "total_due_today": 0,
                "total_upcoming": 0,
            })
        elif channel.channel_type == ChannelType.NTFY:
            send_ntfy(config, "Home Maintenance — Test", "Your ntfy channel is working!", "default")
        return {"status": "ok", "message": f"Test sent to {channel.name}"}
    except Exception as e:
        logger.exception("Test notification failed for channel %d", channel_id)
        raise HTTPException(500, f"Test failed: {str(e)}")


@router.get("/preview", response_model=DigestPreview)
def preview_digest(db: Session = Depends(get_db)):
    """Preview the digest that would be sent (max upcoming_days across channels)."""
    channels = db.query(NotificationChannel).filter(NotificationChannel.enabled.is_(True)).all()
    max_days = max((ch.notify_upcoming_days for ch in channels), default=7)
    overdue, due_today, upcoming = _get_digest_data(db, upcoming_days=max_days)

    def to_digest(t: Task) -> DigestTask:
        return DigestTask(
            id=t.id,
            name=t.name,
            category=t.category.value,
            priority=t.priority.value,
            next_due=t.next_due.isoformat() if t.next_due else None,
        )

    return DigestPreview(
        overdue=[to_digest(t) for t in overdue],
        due_today=[to_digest(t) for t in due_today],
        upcoming=[to_digest(t) for t in upcoming],
        total_overdue=len(overdue),
        total_due_today=len(due_today),
        total_upcoming=len(upcoming),
    )


@router.post("/send-digest")
def send_digest(db: Session = Depends(get_db)):
    """Trigger a digest send to all enabled channels."""
    channels = (
        db.query(NotificationChannel)
        .filter(NotificationChannel.enabled.is_(True))
        .all()
    )
    if not channels:
        return {"status": "ok", "message": "No enabled channels", "results": []}

    # Get the max upcoming_days across all channels for the query,
    # then filter per-channel in _send_to_channel.
    max_days = max(ch.notify_upcoming_days for ch in channels)
    overdue, due_today, upcoming = _get_digest_data(db, upcoming_days=max_days)

    results = []
    for ch in channels:
        # Filter upcoming to this channel's window
        ch_upcoming = upcoming
        if ch.notify_upcoming_days > 0 and ch.notify_upcoming_days < max_days:
            cutoff = date.today() + timedelta(days=ch.notify_upcoming_days)
            ch_upcoming = [t for t in upcoming if t.next_due and t.next_due <= cutoff]
        elif ch.notify_upcoming_days == 0:
            ch_upcoming = []

        try:
            status = _send_to_channel(ch, overdue, due_today, ch_upcoming)
            results.append({"channel": ch.name, "status": status})
        except Exception as e:
            logger.exception("Failed to send digest to channel %d (%s)", ch.id, ch.name)
            results.append({"channel": ch.name, "status": f"error: {str(e)}"})

    return {
        "status": "ok",
        "total_overdue": len(overdue),
        "total_due_today": len(due_today),
        "total_upcoming": len(upcoming),
        "results": results,
    }
