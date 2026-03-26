import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Category(str, enum.Enum):
    HVAC = "hvac"
    PLUMBING = "plumbing"
    ELECTRICAL = "electrical"
    EXTERIOR = "exterior"
    OUTDOOR = "outdoor"
    APPLIANCES = "appliances"
    SAFETY = "safety"
    HOT_TUB = "hot_tub"
    GARAGE = "garage"
    PEST = "pest"
    OTHER = "other"


class Frequency(str, enum.Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEASONAL = "seasonal"
    ANNUAL = "annual"
    BIANNUAL = "biannual"  # every 2 years
    CUSTOM_DAYS = "custom_days"


class Season(str, enum.Enum):
    SPRING = "spring"
    SUMMER = "summer"
    FALL = "fall"
    WINTER = "winter"


class Priority(str, enum.Enum):
    P1 = "p1"  # Critical — safety, prevent damage
    P2 = "p2"  # Important — efficiency, longevity
    P3 = "p3"  # Nice to have — cosmetic, comfort


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[Category] = mapped_column(Enum(Category), nullable=False)
    frequency: Mapped[Frequency] = mapped_column(Enum(Frequency), nullable=False)
    season: Mapped[Season | None] = mapped_column(Enum(Season), nullable=True)
    priority: Mapped[Priority] = mapped_column(
        Enum(Priority), nullable=False, server_default="P2"
    )
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prefer_weekend: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    custom_interval_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_due: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    asset_id: Mapped[int | None] = mapped_column(
        ForeignKey("assets.id", ondelete="SET NULL"), nullable=True
    )

    completions: Mapped[list["TaskCompletion"]] = relationship(
        back_populates="task",
        order_by="desc(TaskCompletion.completed_at)",
        cascade="all, delete-orphan",
    )
    supplies: Mapped[list["Supply"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )
    asset: Mapped["Asset | None"] = relationship(back_populates="tasks")


class TaskCompletion(Base):
    __tablename__ = "task_completions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    contractor_id: Mapped[int | None] = mapped_column(
        ForeignKey("contractors.id", ondelete="SET NULL"), nullable=True
    )

    task: Mapped["Task"] = relationship(back_populates="completions")
    contractor: Mapped["Contractor | None"] = relationship(back_populates="completions")


class Supply(Base):
    __tablename__ = "supplies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    quantity_on_hand: Mapped[int] = mapped_column(Integer, server_default="0")
    quantity_per_use: Mapped[int] = mapped_column(Integer, server_default="1")
    annual_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    task: Mapped["Task"] = relationship(back_populates="supplies")
