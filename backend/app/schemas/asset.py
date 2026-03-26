from datetime import date, datetime

from pydantic import BaseModel

from app.models.task import Category
from app.schemas.task import TaskOut


class AssetOut(BaseModel):
    id: int
    name: str
    category: Category
    manufacturer: str | None
    model_number: str | None
    serial_number: str | None
    install_date: date | None
    warranty_expires: date | None
    expected_lifespan_years: int | None
    purchase_price: float | None
    manual_url: str | None
    notes: str | None
    location: str | None
    created_at: datetime
    updated_at: datetime
    age_years: float | None = None
    warranty_status: str = "unknown"
    replacement_estimate: date | None = None

    model_config = {"from_attributes": True}


class AssetWithTasks(AssetOut):
    tasks: list[TaskOut] = []


class AssetCreate(BaseModel):
    name: str
    category: Category
    manufacturer: str | None = None
    model_number: str | None = None
    serial_number: str | None = None
    install_date: date | None = None
    warranty_expires: date | None = None
    expected_lifespan_years: int | None = None
    purchase_price: float | None = None
    manual_url: str | None = None
    notes: str | None = None
    location: str | None = None


class AssetUpdate(BaseModel):
    name: str | None = None
    category: Category | None = None
    manufacturer: str | None = None
    model_number: str | None = None
    serial_number: str | None = None
    install_date: date | None = None
    warranty_expires: date | None = None
    expected_lifespan_years: int | None = None
    purchase_price: float | None = None
    manual_url: str | None = None
    notes: str | None = None
    location: str | None = None
