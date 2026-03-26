from datetime import datetime

from pydantic import BaseModel

from app.models.activity import ActivityAction, EntityType


class ActivityOut(BaseModel):
    id: int
    action: ActivityAction
    entity_type: EntityType
    entity_id: int
    entity_name: str
    details: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
