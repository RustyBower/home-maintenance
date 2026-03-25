from datetime import date, datetime

from pydantic import BaseModel

from app.models.task import Category, Frequency, Priority, Season


class TaskCompletionOut(BaseModel):
    id: int
    task_id: int
    completed_at: datetime
    notes: str | None
    cost: float | None
    photo_url: str | None
    duration_minutes: int | None

    model_config = {"from_attributes": True}


class SupplyOut(BaseModel):
    id: int
    task_id: int
    name: str
    url: str | None
    quantity_on_hand: int
    quantity_per_use: int
    annual_uses: int | None
    notes: str | None

    model_config = {"from_attributes": True}


class TaskOut(BaseModel):
    id: int
    name: str
    description: str | None
    category: Category
    frequency: Frequency
    season: Season | None
    priority: Priority
    estimated_minutes: int | None
    prefer_weekend: bool
    custom_interval_days: int | None
    next_due: date | None
    created_at: datetime
    updated_at: datetime
    last_completed: datetime | None = None

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    name: str
    description: str | None = None
    category: Category
    frequency: Frequency
    season: Season | None = None
    priority: Priority = Priority.P2
    estimated_minutes: int | None = None
    prefer_weekend: bool = True
    custom_interval_days: int | None = None
    next_due: date | None = None


class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category: Category | None = None
    frequency: Frequency | None = None
    season: Season | None = None
    priority: Priority | None = None
    estimated_minutes: int | None = None
    prefer_weekend: bool | None = None
    custom_interval_days: int | None = None
    next_due: date | None = None


class CompleteTask(BaseModel):
    notes: str | None = None
    cost: float | None = None
    photo_url: str | None = None
    duration_minutes: int | None = None


class SnoozeTask(BaseModel):
    days: int = 7


class TaskWithHistory(TaskOut):
    completions: list[TaskCompletionOut] = []
    supplies: list[SupplyOut] = []


class SupplyCreate(BaseModel):
    name: str
    url: str | None = None
    quantity_on_hand: int = 0
    quantity_per_use: int = 1
    annual_uses: int | None = None
    notes: str | None = None


class SupplyUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    quantity_on_hand: int | None = None
    quantity_per_use: int | None = None
    annual_uses: int | None = None
    notes: str | None = None
