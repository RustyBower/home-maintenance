import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ChannelType(str, enum.Enum):
    EMAIL = "email"
    WEBHOOK = "webhook"
    NTFY = "ntfy"


class NotificationChannel(Base):
    __tablename__ = "notification_channels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel_type: Mapped[ChannelType] = mapped_column(
        Enum(ChannelType, name="channeltype"), nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    config: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string
    notify_overdue: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    notify_due_today: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    notify_upcoming_days: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="7"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
