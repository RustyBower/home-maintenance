import os
import re
import shutil
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import Document, DocumentType
from app.schemas.document import DocumentCreate, DocumentCreateFromUrl, DocumentOut, DocumentUpdate

MAX_DOWNLOAD_SIZE = 50 * 1024 * 1024  # 50 MB

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = Path(os.environ.get("DOCUMENT_STORAGE_PATH", "./uploads"))


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
    # Clean up uploaded file if present
    if doc.file_path:
        file_dir = UPLOAD_DIR / str(doc.id)
        if file_dir.exists():
            shutil.rmtree(file_dir)
    db.delete(doc)
    db.commit()


def _derive_filename_from_response(response: httpx.Response, url: str) -> str:
    """Derive a filename from Content-Disposition header, URL path, or fallback."""
    # Try Content-Disposition header first
    cd = response.headers.get("content-disposition", "")
    if cd:
        match = re.search(r'filename[*]?=["\']?([^"\';]+)', cd)
        if match:
            name = match.group(1).strip()
            if name:
                return unquote(name)

    # Try URL path
    parsed = urlparse(url)
    path = unquote(parsed.path).rstrip("/")
    if path:
        basename = path.split("/")[-1]
        if basename and "." in basename:
            return basename

    return "download"


async def _download_from_url(doc_id: int, url: str) -> tuple[str, int, str]:
    """Download a file from a URL and return (file_path, file_size, mime_type)."""
    doc_dir = UPLOAD_DIR / str(doc_id)
    os.makedirs(doc_dir, exist_ok=True)

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()

                # Check content-length if available
                content_length = response.headers.get("content-length")
                if content_length and int(content_length) > MAX_DOWNLOAD_SIZE:
                    raise HTTPException(413, f"File too large (>{MAX_DOWNLOAD_SIZE // (1024*1024)}MB)")

                filename = _derive_filename_from_response(response, url)
                dest = doc_dir / filename
                mime_type = response.headers.get("content-type", "application/octet-stream")
                # Strip charset or params from content-type
                if ";" in mime_type:
                    mime_type = mime_type.split(";")[0].strip()

                total = 0
                with open(dest, "wb") as f:
                    async for chunk in response.aiter_bytes(8192):
                        total += len(chunk)
                        if total > MAX_DOWNLOAD_SIZE:
                            f.close()
                            dest.unlink(missing_ok=True)
                            raise HTTPException(413, f"File too large (>{MAX_DOWNLOAD_SIZE // (1024*1024)}MB)")
                        f.write(chunk)

        file_size = dest.stat().st_size
        return str(dest), file_size, mime_type

    except httpx.HTTPStatusError as exc:
        raise HTTPException(502, f"Remote server returned {exc.response.status_code}")
    except httpx.TimeoutException:
        raise HTTPException(504, "Timeout downloading from URL")
    except httpx.RequestError as exc:
        raise HTTPException(502, f"Failed to download from URL: {exc}")


@router.post("/create-from-url", response_model=DocumentOut, status_code=201)
async def create_document_from_url(data: DocumentCreateFromUrl, db: Session = Depends(get_db)):
    """Create a document and download the file from a URL in one step."""
    doc_name = data.name
    if not doc_name:
        # Derive name from URL
        parsed = urlparse(data.url)
        path = unquote(parsed.path).rstrip("/")
        if path:
            basename = path.split("/")[-1]
            if basename:
                doc_name = basename
        if not doc_name:
            doc_name = parsed.netloc or "Downloaded Document"

    doc = Document(
        name=doc_name,
        doc_type=data.doc_type,
        url=data.url,
        asset_id=data.asset_id,
        task_id=data.task_id,
        repair_id=data.repair_id,
        notes=data.notes,
        expiry_date=data.expiry_date,
    )
    db.add(doc)
    db.flush()

    file_path, file_size, mime_type = await _download_from_url(doc.id, data.url)
    doc.file_path = file_path
    doc.file_size = file_size
    doc.mime_type = mime_type

    db.commit()
    db.refresh(doc)
    return document_to_out(doc)


def _save_upload(doc_id: int, file: UploadFile) -> tuple[str, int, str]:
    """Save an uploaded file and return (file_path, file_size, mime_type)."""
    doc_dir = UPLOAD_DIR / str(doc_id)
    os.makedirs(doc_dir, exist_ok=True)

    filename = file.filename or "upload"
    dest = doc_dir / filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = dest.stat().st_size
    mime_type = file.content_type or "application/octet-stream"
    return str(dest), file_size, mime_type


@router.post("/upload", response_model=DocumentOut, status_code=201)
def upload_document(
    file: UploadFile = File(...),
    name: str | None = Form(None),
    doc_type: DocumentType = Form(DocumentType.OTHER),
    asset_id: int | None = Form(None),
    task_id: int | None = Form(None),
    repair_id: int | None = Form(None),
    notes: str | None = Form(None),
    expiry_date: date | None = Form(None),
    db: Session = Depends(get_db),
):
    doc_name = name or file.filename or "Uploaded File"
    doc = Document(
        name=doc_name,
        doc_type=doc_type,
        asset_id=asset_id,
        task_id=task_id,
        repair_id=repair_id,
        notes=notes,
        expiry_date=expiry_date,
    )
    db.add(doc)
    db.flush()  # get the id

    file_path, file_size, mime_type = _save_upload(doc.id, file)
    doc.file_path = file_path
    doc.file_size = file_size
    doc.mime_type = mime_type

    db.commit()
    db.refresh(doc)
    return document_to_out(doc)


@router.get("/{document_id}/file")
def serve_document_file(document_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if not doc.file_path:
        raise HTTPException(404, "No file attached to this document")

    file_path = Path(doc.file_path)
    if not file_path.exists():
        raise HTTPException(404, "File not found on disk")

    return FileResponse(
        path=str(file_path),
        media_type=doc.mime_type or "application/octet-stream",
        filename=file_path.name,
    )


@router.post("/{document_id}/upload", response_model=DocumentOut)
def upload_file_to_document(
    document_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    # Delete old file if replacing
    if doc.file_path:
        old_dir = UPLOAD_DIR / str(doc.id)
        if old_dir.exists():
            shutil.rmtree(old_dir)

    file_path, file_size, mime_type = _save_upload(doc.id, file)
    doc.file_path = file_path
    doc.file_size = file_size
    doc.mime_type = mime_type

    db.commit()
    db.refresh(doc)
    return document_to_out(doc)


@router.post("/{document_id}/download-url", response_model=DocumentOut)
async def download_document_url(document_id: int, db: Session = Depends(get_db)):
    """Download the file from the document's URL and save it locally."""
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    if not doc.url:
        raise HTTPException(400, "Document has no URL to download from")

    # Clean up old file if replacing
    if doc.file_path:
        old_dir = UPLOAD_DIR / str(doc.id)
        if old_dir.exists():
            shutil.rmtree(old_dir)

    file_path, file_size, mime_type = await _download_from_url(doc.id, doc.url)
    doc.file_path = file_path
    doc.file_size = file_size
    doc.mime_type = mime_type

    db.commit()
    db.refresh(doc)
    return document_to_out(doc)
