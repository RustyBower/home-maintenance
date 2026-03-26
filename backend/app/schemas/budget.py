from pydantic import BaseModel


class ForecastTask(BaseModel):
    name: str
    estimated_cost: float
    due: str


class ForecastMonth(BaseModel):
    month: str
    label: str
    maintenance_cost: float
    recurring_expenses: float
    estimated_repairs: float
    total: float
    tasks: list[ForecastTask]


class ForecastResponse(BaseModel):
    months: list[ForecastMonth]
    annual_total: float
    monthly_average: float


class AssetReplacement(BaseModel):
    asset_id: int
    name: str
    category: str
    install_date: str | None
    age_years: float
    expected_lifespan_years: int
    remaining_years: float
    estimated_replacement_year: int
    purchase_price: float | None
    urgency: str  # "ok", "approaching", "overdue"


class AssetReplacementResponse(BaseModel):
    upcoming: list[AssetReplacement]
    total_replacement_value: float


class CurrentYearSummary(BaseModel):
    spent_maintenance: float
    spent_repairs: float
    spent_recurring: float
    total_spent: float
    forecasted_remaining: float
    forecasted_annual: float


class NextBigExpense(BaseModel):
    name: str
    estimated_cost: float
    due: str


class BudgetSummaryResponse(BaseModel):
    current_year: CurrentYearSummary
    monthly_recurring: float
    annual_recurring: float
    next_big_expense: NextBigExpense | None
