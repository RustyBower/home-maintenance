from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.activity import Activity, EntityType
from app.schemas.activity import ActivityOut

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("", response_model=list[ActivityOut])
def list_activity(
    entity_type: EntityType | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(Activity)
    if entity_type:
        q = q.filter(Activity.entity_type == entity_type)
    entries = q.order_by(Activity.created_at.desc()).limit(limit).all()
    return [ActivityOut.model_validate(e, from_attributes=True) for e in entries]


@router.get("/entity/{entity_type}/{entity_id}", response_model=list[ActivityOut])
def entity_activity(
    entity_type: EntityType,
    entity_id: int,
    db: Session = Depends(get_db),
):
    entries = (
        db.query(Activity)
        .filter(Activity.entity_type == entity_type, Activity.entity_id == entity_id)
        .order_by(Activity.created_at.desc())
        .all()
    )
    return [ActivityOut.model_validate(e, from_attributes=True) for e in entries]
