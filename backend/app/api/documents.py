from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import Document, DocumentType
from app.schemas.document import DocumentCreate, DocumentOut, DocumentUpdate

router = APIRouter(prefix="/api/documents", tags=["documents"])


def compute_expiry_status(doc: Document) -> str:
    if not doc.expiry_date:
        return "unknown"
    today = date.today()
    if doc.expiry_date < today:
        return "expired"
    if doc.expiry_date <= today + timedelta(days=30):
        return "expiring_soon"
    return "active"


def document_to_out(doc: Document) -> DocumentOut:
    data = DocumentOut.model_validate(doc, from_attributes=True)
    data.expiry_status = compute_expiry_status(doc)
    return data


@router.get("", response_model=list[DocumentOut])
def list_documents(
    doc_type: DocumentType | None = None,
    asset_id: int | None = None,
    task_id: int | None = None,
    repair_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Document)
    if doc_type:
        q = q.filter(Document.doc_type == doc_type)
    if asset_id is not None:
        q = q.filter(Document.asset_id == asset_id)
    if task_id is not None:
        q = q.filter(Document.task_id == task_id)
    if repair_id is not None:
        q = q.filter(Document.repair_id == repair_id)
    docs = q.order_by(Document.name).all()
    return [document_to_out(d) for d in docs]


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return document_to_out(doc)


@router.post("", response_model=DocumentOut, status_code=201)
def create_document(data: DocumentCreate, db: Session = Depends(get_db)):
    doc = Document(**data.model_dump())
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return document_to_out(doc)


@router.patch("/{document_id}", response_model=DocumentOut)
def update_document(document_id: int, data: DocumentUpdate, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)
    db.commit()
    db.refresh(doc)
    return document_to_out(doc)


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    db.delete(doc)
    db.commit()
