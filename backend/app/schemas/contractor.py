from datetime import datetime

from pydantic import BaseModel

from app.models.task import Category


class ContractorOut(BaseModel):
    id: int
    name: str
    specialty: Category
    phone: str | None
    email: str | None
    website: str | None
    address: str | None
    notes: str | None
    rating: int | None
    created_at: datetime
    updated_at: datetime
    total_spent: float = 0.0
    jobs_completed: int = 0

    model_config = {"from_attributes": True}


class CompletionHistoryItem(BaseModel):
    id: int
    task_id: int
    task_name: str
    completed_at: datetime
    cost: float | None
    notes: str | None

    model_config = {"from_attributes": True}


class ContractorWithHistory(ContractorOut):
    recent_work: list[CompletionHistoryItem] = []


class ContractorCreate(BaseModel):
    name: str
    specialty: Category
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    address: str | None = None
    notes: str | None = None
    rating: int | None = None


class ContractorUpdate(BaseModel):
    name: str | None = None
    specialty: Category | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    address: str | None = None
    notes: str | None = None
    rating: int | None = None
