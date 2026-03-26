from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contractor import Contractor
from app.models.task import Category, TaskCompletion
from app.schemas.contractor import (
    CompletionHistoryItem,
    ContractorCreate,
    ContractorOut,
    ContractorUpdate,
    ContractorWithHistory,
)

router = APIRouter(prefix="/api/contractors", tags=["contractors"])


def contractor_to_out(contractor: Contractor) -> ContractorOut:
    data = ContractorOut.model_validate(contractor, from_attributes=True)
    total = 0.0
    count = 0
    for c in contractor.completions:
        count += 1
        if c.cost:
            total += float(c.cost)
    data.total_spent = total
    data.jobs_completed = count
    return data


def contractor_to_out_with_history(contractor: Contractor) -> ContractorWithHistory:
    data = ContractorWithHistory.model_validate(contractor, from_attributes=True)
    total = 0.0
    count = 0
    work: list[CompletionHistoryItem] = []
    for c in contractor.completions:
        count += 1
        if c.cost:
            total += float(c.cost)
        work.append(
            CompletionHistoryItem(
                id=c.id,
                task_id=c.task_id,
                task_name=c.task.name,
                completed_at=c.completed_at,
                cost=float(c.cost) if c.cost else None,
                notes=c.notes,
            )
        )
    data.total_spent = total
    data.jobs_completed = count
    data.recent_work = work
    return data


@router.get("", response_model=list[ContractorOut])
def list_contractors(
    specialty: Category | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Contractor)
    if specialty:
        q = q.filter(Contractor.specialty == specialty)
    contractors = q.order_by(Contractor.name).all()
    return [contractor_to_out(c) for c in contractors]


@router.get("/{contractor_id}", response_model=ContractorWithHistory)
def get_contractor(contractor_id: int, db: Session = Depends(get_db)):
    contractor = db.get(Contractor, contractor_id)
    if not contractor:
        raise HTTPException(404, "Contractor not found")
    return contractor_to_out_with_history(contractor)


@router.post("", response_model=ContractorOut, status_code=201)
def create_contractor(data: ContractorCreate, db: Session = Depends(get_db)):
    contractor = Contractor(**data.model_dump())
    db.add(contractor)
    db.commit()
    db.refresh(contractor)
    return contractor_to_out(contractor)


@router.patch("/{contractor_id}", response_model=ContractorOut)
def update_contractor(
    contractor_id: int, data: ContractorUpdate, db: Session = Depends(get_db)
):
    contractor = db.get(Contractor, contractor_id)
    if not contractor:
        raise HTTPException(404, "Contractor not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contractor, field, value)
    db.commit()
    db.refresh(contractor)
    return contractor_to_out(contractor)


@router.delete("/{contractor_id}", status_code=204)
def delete_contractor(contractor_id: int, db: Session = Depends(get_db)):
    contractor = db.get(Contractor, contractor_id)
    if not contractor:
        raise HTTPException(404, "Contractor not found")
    db.delete(contractor)
    db.commit()
