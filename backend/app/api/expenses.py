from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.expense import ExpenseFrequency, RecurringExpense
from app.models.task import Category
from app.schemas.expense import (
    CategoryBreakdown,
    ExpenseCreate,
    ExpenseOut,
    ExpenseSummary,
    ExpenseUpdate,
    UpcomingRenewal,
)

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


def _monthly_cost(amount: float, frequency: ExpenseFrequency) -> float:
    if frequency == ExpenseFrequency.MONTHLY:
        return float(amount)
    if frequency == ExpenseFrequency.QUARTERLY:
        return round(float(amount) / 3, 2)
    if frequency == ExpenseFrequency.ANNUAL:
        return round(float(amount) / 12, 2)
    return float(amount)


@router.get("/summary", response_model=ExpenseSummary)
def expense_summary(db: Session = Depends(get_db)):
    expenses = (
        db.query(RecurringExpense)
        .filter(RecurringExpense.active == True)  # noqa: E712
        .all()
    )

    total_monthly = 0.0
    cat_map: dict[str, dict] = {}

    for e in expenses:
        mc = _monthly_cost(float(e.amount), e.frequency)
        total_monthly += mc

        cat_key = e.category.value
        if cat_key not in cat_map:
            cat_map[cat_key] = {"monthly_total": 0.0, "annual_total": 0.0, "count": 0}
        cat_map[cat_key]["monthly_total"] += mc
        cat_map[cat_key]["annual_total"] += mc * 12
        cat_map[cat_key]["count"] += 1

    by_category = [
        CategoryBreakdown(
            category=cat,
            monthly_total=round(data["monthly_total"], 2),
            annual_total=round(data["annual_total"], 2),
            count=data["count"],
        )
        for cat, data in sorted(cat_map.items())
    ]

    today = date.today()
    cutoff = today + timedelta(days=30)
    upcoming_renewals = []
    for e in expenses:
        if e.renewal_date and today <= e.renewal_date <= cutoff:
            upcoming_renewals.append(
                UpcomingRenewal(
                    id=e.id,
                    name=e.name,
                    renewal_date=e.renewal_date,
                    amount=float(e.amount),
                    frequency=e.frequency,
                    days_until=(e.renewal_date - today).days,
                )
            )
    upcoming_renewals.sort(key=lambda r: r.renewal_date)

    return ExpenseSummary(
        total_monthly=round(total_monthly, 2),
        total_annual=round(total_monthly * 12, 2),
        active_count=len(expenses),
        by_category=by_category,
        upcoming_renewals=upcoming_renewals,
    )


@router.get("", response_model=list[ExpenseOut])
def list_expenses(
    category: Category | None = None,
    active: bool | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(RecurringExpense)
    if category:
        q = q.filter(RecurringExpense.category == category)
    if active is not None:
        q = q.filter(RecurringExpense.active == active)
    return q.order_by(RecurringExpense.name).all()


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.get(RecurringExpense, expense_id)
    if not expense:
        raise HTTPException(404, "Expense not found")
    return expense


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(data: ExpenseCreate, db: Session = Depends(get_db)):
    expense = RecurringExpense(**data.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.patch("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: int, data: ExpenseUpdate, db: Session = Depends(get_db)
):
    expense = db.get(RecurringExpense, expense_id)
    if not expense:
        raise HTTPException(404, "Expense not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.get(RecurringExpense, expense_id)
    if not expense:
        raise HTTPException(404, "Expense not found")
    db.delete(expense)
    db.commit()
