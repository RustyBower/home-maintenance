from datetime import datetime

from pydantic import BaseModel

from app.models.notification import ChannelType


class ChannelCreate(BaseModel):
    name: str
    channel_type: ChannelType
    enabled: bool = True
    config: dict
    notify_overdue: bool = True
    notify_due_today: bool = True
    notify_upcoming_days: int = 7


class ChannelUpdate(BaseModel):
    name: str | None = None
    channel_type: ChannelType | None = None
    enabled: bool | None = None
    config: dict | None = None
    notify_overdue: bool | None = None
    notify_due_today: bool | None = None
    notify_upcoming_days: int | None = None


class ChannelOut(BaseModel):
    id: int
    name: str
    channel_type: ChannelType
    enabled: bool
    config: dict
    notify_overdue: bool
    notify_due_today: bool
    notify_upcoming_days: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DigestTask(BaseModel):
    id: int
    name: str
    category: str
    priority: str
    next_due: str | None


class DigestPreview(BaseModel):
    overdue: list[DigestTask]
    due_today: list[DigestTask]
    upcoming: list[DigestTask]
    total_overdue: int
    total_due_today: int
    total_upcoming: int
