from datetime import datetime

from pydantic import BaseModel


class ChecklistItemSchema(BaseModel):
    name: str
    description: str | None = None
    order: int


class ChecklistItemStateSchema(BaseModel):
    name: str
    description: str | None = None
    order: int
    checked: bool = False
    checked_at: str | None = None


# --- Template schemas ---


class TemplateCreate(BaseModel):
    name: str
    description: str | None = None
    items: list[ChecklistItemSchema] = []


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    items: list[ChecklistItemSchema] | None = None


class TemplateOut(BaseModel):
    id: int
    name: str
    description: str | None
    items: list[ChecklistItemSchema]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Instance schemas ---


class InstanceCreate(BaseModel):
    name: str | None = None  # override template name


class InstanceUpdate(BaseModel):
    name: str | None = None
    notes: str | None = None


class InstanceOut(BaseModel):
    id: int
    template_id: int | None
    name: str
    started_at: datetime
    completed_at: datetime | None
    items_state: list[ChecklistItemStateSchema]
    notes: str | None
    template_name: str | None = None
    checked_count: int = 0
    total_count: int = 0

    model_config = {"from_attributes": True}
