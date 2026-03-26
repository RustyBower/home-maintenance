import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ActivityAction(str, enum.Enum):
    CREATED = "created"
    UPDATED = "updated"
    COMPLETED = "completed"
    SNOOZED = "snoozed"
    DELETED = "deleted"
    STATUS_CHANGED = "status_changed"


class EntityType(str, enum.Enum):
    TASK = "task"
    ASSET = "asset"
    REPAIR = "repair"
    CONTRACTOR = "contractor"
    DOCUMENT = "document"
    SUPPLY = "supply"


class Activity(Base):
    __tablename__ = "activity_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    action: Mapped[ActivityAction] = mapped_column(Enum(ActivityAction), nullable=False)
    entity_type: Mapped[EntityType] = mapped_column(Enum(EntityType), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    entity_name: Mapped[str] = mapped_column(String(255), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
