from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.repair import Repair, RepairStatus, Severity
from app.models.task import Category
from app.schemas.repair import RepairCreate, RepairOut, RepairUpdate
from app.services.activity import log_activity

router = APIRouter(prefix="/api/repairs", tags=["repairs"])


@router.get("/summary")
def repair_summary(db: Session = Depends(get_db)):
    repairs = db.query(Repair).all()

    total_cost = sum(float(r.cost) for r in repairs if r.cost is not None)

    by_status: dict[str, int] = {}
    for s in RepairStatus:
        count = sum(1 for r in repairs if r.status == s)
        by_status[s.value] = count

    by_category: dict[str, int] = {}
    for r in repairs:
        cat = r.category.value
        by_category[cat] = by_category.get(cat, 0) + 1

    return {
        "total_count": len(repairs),
        "total_cost": total_cost,
        "by_status": by_status,
        "by_category": by_category,
    }


@router.get("", response_model=list[RepairOut])
def list_repairs(
    category: Category | None = None,
    status: RepairStatus | None = None,
    severity: Severity | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Repair)
    if category:
        q = q.filter(Repair.category == category)
    if status:
        q = q.filter(Repair.status == status)
    if severity:
        q = q.filter(Repair.severity == severity)
    repairs = q.order_by(Repair.reported_date.desc()).all()
    return [RepairOut.model_validate(r, from_attributes=True) for r in repairs]


@router.get("/{repair_id}", response_model=RepairOut)
def get_repair(repair_id: int, db: Session = Depends(get_db)):
    repair = db.get(Repair, repair_id)
    if not repair:
        raise HTTPException(404, "Repair not found")
    return RepairOut.model_validate(repair, from_attributes=True)


@router.post("", response_model=RepairOut, status_code=201)
def create_repair(data: RepairCreate, db: Session = Depends(get_db)):
    repair = Repair(**data.model_dump())
    db.add(repair)
    db.commit()
    db.refresh(repair)
    log_activity(db, "created", "repair", repair.id, repair.title, f"Status: {repair.status.value}, Severity: {repair.severity.value}")
    return RepairOut.model_validate(repair, from_attributes=True)


@router.patch("/{repair_id}", response_model=RepairOut)
def update_repair(repair_id: int, data: RepairUpdate, db: Session = Depends(get_db)):
    repair = db.get(Repair, repair_id)
    if not repair:
        raise HTTPException(404, "Repair not found")
    old_status = repair.status.value
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(repair, field, value)
    db.commit()
    db.refresh(repair)
    details_parts = []
    if "status" in updates and updates["status"].value != old_status:
        details_parts.append(f"Status changed to {repair.status.value}")
    if "cost" in updates and updates["cost"] is not None:
        details_parts.append(f"Cost: ${float(updates['cost']):.2f}")
    action = "status_changed" if "status" in updates and updates["status"].value != old_status else "updated"
    log_activity(db, action, "repair", repair.id, repair.title, "; ".join(details_parts) or None)
    return RepairOut.model_validate(repair, from_attributes=True)


@router.delete("/{repair_id}", status_code=204)
def delete_repair(repair_id: int, db: Session = Depends(get_db)):
    repair = db.get(Repair, repair_id)
    if not repair:
        raise HTTPException(404, "Repair not found")
    repair_title = repair.title
    db.delete(repair)
    db.commit()
    log_activity(db, "deleted", "repair", repair_id, repair_title)
