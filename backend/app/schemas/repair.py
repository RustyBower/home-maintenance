from datetime import date, datetime

from pydantic import BaseModel

from app.models.repair import RepairStatus, Severity
from app.models.task import Category


class RepairOut(BaseModel):
    id: int
    title: str
    description: str | None
    diagnosis: str | None
    resolution: str | None
    category: Category
    asset_id: int | None
    contractor_name: str | None
    cost: float | None
    reported_date: date
    resolved_date: date | None
    status: RepairStatus
    severity: Severity
    photo_url: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RepairCreate(BaseModel):
    title: str
    description: str | None = None
    diagnosis: str | None = None
    resolution: str | None = None
    category: Category
    asset_id: int | None = None
    contractor_name: str | None = None
    cost: float | None = None
    reported_date: date
    resolved_date: date | None = None
    status: RepairStatus = RepairStatus.REPORTED
    severity: Severity = Severity.MEDIUM
    photo_url: str | None = None
    notes: str | None = None


class RepairUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    diagnosis: str | None = None
    resolution: str | None = None
    category: Category | None = None
    asset_id: int | None = None
    contractor_name: str | None = None
    cost: float | None = None
    reported_date: date | None = None
    resolved_date: date | None = None
    status: RepairStatus | None = None
    severity: Severity | None = None
    photo_url: str | None = None
    notes: str | None = None
