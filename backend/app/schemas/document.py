from datetime import date, datetime

from pydantic import BaseModel, computed_field

from app.models.document import DocumentType


class DocumentOut(BaseModel):
    id: int
    name: str
    doc_type: DocumentType
    url: str | None
    file_path: str | None
    file_size: int | None
    mime_type: str | None
    asset_id: int | None
    task_id: int | None
    repair_id: int | None
    notes: str | None
    expiry_date: date | None
    created_at: datetime
    updated_at: datetime
    expiry_status: str = "unknown"

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def file_url(self) -> str | None:
        if self.file_path:
            return f"/api/documents/{self.id}/file"
        return None


class DocumentCreate(BaseModel):
    name: str
    doc_type: DocumentType
    url: str | None = None
    asset_id: int | None = None
    task_id: int | None = None
    repair_id: int | None = None
    notes: str | None = None
    expiry_date: date | None = None


class DocumentUpdate(BaseModel):
    name: str | None = None
    doc_type: DocumentType | None = None
    url: str | None = None
    asset_id: int | None = None
    task_id: int | None = None
    repair_id: int | None = None
    notes: str | None = None
    expiry_date: date | None = None
