from sqlalchemy.orm import Session

from app.models.activity import Activity, ActivityAction, EntityType


def log_activity(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: int,
    entity_name: str,
    details: str | None = None,
) -> None:
    entry = Activity(
        action=ActivityAction(action),
        entity_type=EntityType(entity_type),
        entity_id=entity_id,
        entity_name=entity_name,
        details=details,
    )
    db.add(entry)
    db.commit()
