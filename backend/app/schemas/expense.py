from datetime import date, datetime

from pydantic import BaseModel, computed_field

from app.models.task import Category
from app.models.expense import ExpenseFrequency


class ExpenseOut(BaseModel):
    id: int
    name: str
    category: Category
    amount: float
    frequency: ExpenseFrequency
    provider: str | None
    start_date: date | None
    renewal_date: date | None
    auto_renew: bool
    notes: str | None
    active: bool
    contractor_id: int | None
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def monthly_cost(self) -> float:
        if self.frequency == ExpenseFrequency.MONTHLY:
            return float(self.amount)
        if self.frequency == ExpenseFrequency.QUARTERLY:
            return round(float(self.amount) / 3, 2)
        if self.frequency == ExpenseFrequency.ANNUAL:
            return round(float(self.amount) / 12, 2)
        return float(self.amount)

    model_config = {"from_attributes": True}


class ExpenseCreate(BaseModel):
    name: str
    category: Category
    amount: float
    frequency: ExpenseFrequency
    provider: str | None = None
    start_date: date | None = None
    renewal_date: date | None = None
    auto_renew: bool = True
    notes: str | None = None
    active: bool = True
    contractor_id: int | None = None


class ExpenseUpdate(BaseModel):
    name: str | None = None
    category: Category | None = None
    amount: float | None = None
    frequency: ExpenseFrequency | None = None
    provider: str | None = None
    start_date: date | None = None
    renewal_date: date | None = None
    auto_renew: bool | None = None
    notes: str | None = None
    active: bool | None = None
    contractor_id: int | None = None


class CategoryBreakdown(BaseModel):
    category: str
    monthly_total: float
    annual_total: float
    count: int


class UpcomingRenewal(BaseModel):
    id: int
    name: str
    renewal_date: date
    amount: float
    frequency: ExpenseFrequency
    days_until: int


class ExpenseSummary(BaseModel):
    total_monthly: float
    total_annual: float
    active_count: int
    by_category: list[CategoryBreakdown]
    upcoming_renewals: list[UpcomingRenewal]
