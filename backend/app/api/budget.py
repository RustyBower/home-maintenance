from datetime import date

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.asset import Asset
from app.models.expense import ExpenseFrequency, RecurringExpense
from app.models.repair import Repair
from app.models.task import Task, TaskCompletion
from app.schemas.budget import (
    AssetReplacement,
    AssetReplacementResponse,
    BudgetSummaryResponse,
    CurrentYearSummary,
    ForecastMonth,
    ForecastResponse,
    ForecastTask,
    NextBigExpense,
)

router = APIRouter(prefix="/api/budget", tags=["budget"])


def _avg_task_cost(db: Session, task_id: int) -> float:
    """Average cost from completions for a given task, or 0 if none."""
    result = (
        db.query(func.avg(TaskCompletion.cost))
        .filter(TaskCompletion.task_id == task_id, TaskCompletion.cost.isnot(None))
        .scalar()
    )
    return float(result) if result else 0.0


def _monthly_repair_average(db: Session) -> float:
    """Average monthly repair cost from all historical repairs."""
    repairs = db.query(Repair.cost).filter(Repair.cost.isnot(None)).all()
    if not repairs:
        return 0.0
    total = sum(float(r.cost) for r in repairs)
    # Get date range
    earliest = db.query(func.min(Repair.reported_date)).scalar()
    if not earliest:
        return 0.0
    months_span = max(
        1,
        (date.today().year - earliest.year) * 12 + (date.today().month - earliest.month) + 1,
    )
    return total / months_span


def _recurring_expense_in_month(expense: RecurringExpense, year: int, month: int) -> float:
    """Return the expense amount if it falls in the given month, else 0."""
    if not expense.active:
        return 0.0

    if expense.frequency == ExpenseFrequency.MONTHLY:
        return float(expense.amount)

    start = expense.start_date or date(year, 1, 1)

    if expense.frequency == ExpenseFrequency.QUARTERLY:
        # Hits every 3 months from start_date month
        start_month = start.month
        # Check if this month is on a quarterly cycle from start
        diff = (month - start_month) % 3
        if diff == 0:
            return float(expense.amount)
        return 0.0

    if expense.frequency == ExpenseFrequency.ANNUAL:
        # Hits once per year in the start_date month
        if month == start.month:
            return float(expense.amount)
        return 0.0

    return 0.0


def _compute_monthly_recurring_total(db: Session) -> float:
    """Sum of all active recurring expenses normalized to monthly."""
    expenses = db.query(RecurringExpense).filter(RecurringExpense.active == True).all()  # noqa: E712
    total = 0.0
    for e in expenses:
        amt = float(e.amount)
        if e.frequency == ExpenseFrequency.MONTHLY:
            total += amt
        elif e.frequency == ExpenseFrequency.QUARTERLY:
            total += amt / 3.0
        elif e.frequency == ExpenseFrequency.ANNUAL:
            total += amt / 12.0
    return total


@router.get("/forecast", response_model=ForecastResponse)
def budget_forecast(db: Session = Depends(get_db)):
    today = date.today()
    repair_avg = _monthly_repair_average(db)
    expenses = db.query(RecurringExpense).filter(RecurringExpense.active == True).all()  # noqa: E712

    months: list[ForecastMonth] = []
    grand_total = 0.0

    for i in range(1, 13):
        target = today + relativedelta(months=i)
        year = target.year
        month = target.month
        first_day = date(year, month, 1)
        last_day = (first_day + relativedelta(months=1)) - relativedelta(days=1)

        # Tasks due in this month
        tasks_due = (
            db.query(Task)
            .filter(Task.next_due >= first_day, Task.next_due <= last_day)
            .all()
        )

        forecast_tasks: list[ForecastTask] = []
        maintenance_cost = 0.0
        for t in tasks_due:
            avg = _avg_task_cost(db, t.id)
            forecast_tasks.append(
                ForecastTask(
                    name=t.name,
                    estimated_cost=round(avg, 2),
                    due=t.next_due.isoformat() if t.next_due else first_day.isoformat(),
                )
            )
            maintenance_cost += avg

        # Recurring expenses in this month
        recurring_total = 0.0
        for e in expenses:
            recurring_total += _recurring_expense_in_month(e, year, month)

        month_total = maintenance_cost + recurring_total + repair_avg

        months.append(
            ForecastMonth(
                month=f"{year}-{month:02d}",
                label=target.strftime("%B %Y"),
                maintenance_cost=round(maintenance_cost, 2),
                recurring_expenses=round(recurring_total, 2),
                estimated_repairs=round(repair_avg, 2),
                total=round(month_total, 2),
                tasks=forecast_tasks,
            )
        )
        grand_total += month_total

    return ForecastResponse(
        months=months,
        annual_total=round(grand_total, 2),
        monthly_average=round(grand_total / 12, 2),
    )


@router.get("/asset-replacements", response_model=AssetReplacementResponse)
def asset_replacements(db: Session = Depends(get_db)):
    assets = (
        db.query(Asset)
        .filter(
            Asset.install_date.isnot(None),
            Asset.expected_lifespan_years.isnot(None),
        )
        .all()
    )

    today = date.today()
    upcoming: list[AssetReplacement] = []
    total_value = 0.0

    for a in assets:
        age_days = (today - a.install_date).days
        age_years = round(age_days / 365.25, 1)
        lifespan = a.expected_lifespan_years
        remaining = round(lifespan - age_years, 1)
        replacement_year = a.install_date.year + lifespan

        pct = age_years / lifespan if lifespan else 1.0
        if pct > 1.0:
            urgency = "overdue"
        elif pct >= 0.75:
            urgency = "approaching"
        else:
            urgency = "ok"

        price = float(a.purchase_price) if a.purchase_price else None
        if price:
            total_value += price

        upcoming.append(
            AssetReplacement(
                asset_id=a.id,
                name=a.name,
                category=a.category.value,
                install_date=a.install_date.isoformat() if a.install_date else None,
                age_years=age_years,
                expected_lifespan_years=lifespan,
                remaining_years=remaining,
                estimated_replacement_year=replacement_year,
                purchase_price=price,
                urgency=urgency,
            )
        )

    # Sort: overdue first, then approaching, then ok
    urgency_order = {"overdue": 0, "approaching": 1, "ok": 2}
    upcoming.sort(key=lambda x: (urgency_order.get(x.urgency, 3), x.remaining_years))

    return AssetReplacementResponse(
        upcoming=upcoming,
        total_replacement_value=round(total_value, 2),
    )


@router.get("/summary", response_model=BudgetSummaryResponse)
def budget_summary(db: Session = Depends(get_db)):
    today = date.today()
    current_year = today.year

    # Spent on maintenance (task completions) this year
    spent_maintenance = (
        db.query(func.coalesce(func.sum(TaskCompletion.cost), 0))
        .filter(
            TaskCompletion.cost.isnot(None),
            extract("year", TaskCompletion.completed_at) == current_year,
        )
        .scalar()
    )
    spent_maintenance = float(spent_maintenance)

    # Spent on repairs this year
    spent_repairs = (
        db.query(func.coalesce(func.sum(Repair.cost), 0))
        .filter(
            Repair.cost.isnot(None),
            extract("year", Repair.reported_date) == current_year,
        )
        .scalar()
    )
    spent_repairs = float(spent_repairs)

    # Spent on recurring expenses this year (prorated up to current month)
    expenses = db.query(RecurringExpense).filter(RecurringExpense.active == True).all()  # noqa: E712
    spent_recurring = 0.0
    for e in expenses:
        for m in range(1, today.month + 1):
            spent_recurring += _recurring_expense_in_month(e, current_year, m)

    total_spent = spent_maintenance + spent_repairs + spent_recurring

    # Forecasted remaining: sum recurring + repair avg for remaining months
    repair_avg = _monthly_repair_average(db)
    remaining_months = 12 - today.month
    forecasted_remaining = 0.0

    # Remaining recurring
    for e in expenses:
        for m in range(today.month + 1, 13):
            forecasted_remaining += _recurring_expense_in_month(e, current_year, m)

    # Remaining maintenance (tasks due in remaining months)
    for m in range(today.month + 1, 13):
        first_day = date(current_year, m, 1)
        last_day = (first_day + relativedelta(months=1)) - relativedelta(days=1)
        tasks_due = (
            db.query(Task)
            .filter(Task.next_due >= first_day, Task.next_due <= last_day)
            .all()
        )
        for t in tasks_due:
            forecasted_remaining += _avg_task_cost(db, t.id)

    # Add repair buffer for remaining months
    forecasted_remaining += repair_avg * remaining_months

    forecasted_annual = total_spent + forecasted_remaining

    # Monthly recurring total
    monthly_recurring = _compute_monthly_recurring_total(db)
    annual_recurring = monthly_recurring * 12

    # Next big expense: nearest future task with highest estimated cost
    upcoming_tasks = (
        db.query(Task)
        .filter(Task.next_due > today)
        .order_by(Task.next_due)
        .limit(50)
        .all()
    )
    next_big: NextBigExpense | None = None
    best_cost = 0.0
    for t in upcoming_tasks:
        avg = _avg_task_cost(db, t.id)
        if avg > best_cost:
            best_cost = avg
            next_big = NextBigExpense(
                name=t.name,
                estimated_cost=round(avg, 2),
                due=t.next_due.isoformat() if t.next_due else "",
            )

    return BudgetSummaryResponse(
        current_year=CurrentYearSummary(
            spent_maintenance=round(spent_maintenance, 2),
            spent_repairs=round(spent_repairs, 2),
            spent_recurring=round(spent_recurring, 2),
            total_spent=round(total_spent, 2),
            forecasted_remaining=round(forecasted_remaining, 2),
            forecasted_annual=round(forecasted_annual, 2),
        ),
        monthly_recurring=round(monthly_recurring, 2),
        annual_recurring=round(annual_recurring, 2),
        next_big_expense=next_big,
    )
