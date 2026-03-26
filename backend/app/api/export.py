import csv
import io
import json
from datetime import date, datetime

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.asset import Asset
from app.models.contractor import Contractor
from app.models.document import Document
from app.models.repair import Repair
from app.models.task import Supply, Task, TaskCompletion

router = APIRouter(prefix="/api/export", tags=["export"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize(obj) -> dict:
    """Convert a SQLAlchemy model instance to a plain dict, handling dates."""
    d = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, (datetime, date)):
            val = val.isoformat()
        elif hasattr(val, "value"):  # enum
            val = val.value
        if val is not None and not isinstance(val, (str, int, float, bool)):
            val = str(val)
        d[col.name] = val
    return d


# ---------------------------------------------------------------------------
# JSON Export
# ---------------------------------------------------------------------------

@router.get("/json")
def export_json(db: Session = Depends(get_db)):
    data = {
        "version": "1.0",
        "exported_at": datetime.now().isoformat(),
        "tasks": [_serialize(t) for t in db.query(Task).all()],
        "task_completions": [_serialize(c) for c in db.query(TaskCompletion).all()],
        "assets": [_serialize(a) for a in db.query(Asset).all()],
        "contractors": [_serialize(c) for c in db.query(Contractor).all()],
        "repairs": [_serialize(r) for r in db.query(Repair).all()],
        "documents": [_serialize(d) for d in db.query(Document).all()],
        "supplies": [_serialize(s) for s in db.query(Supply).all()],
    }
    filename = f"home-maintenance-backup-{date.today().isoformat()}.json"
    content = json.dumps(data, indent=2)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# JSON Import
# ---------------------------------------------------------------------------

@router.post("/import-json")
def import_json(payload: dict, db: Session = Depends(get_db)):
    imported: dict[str, int] = {}
    skipped: dict[str, int] = {}

    # ---- Assets (match by name) ----
    existing_asset_names = {a.name for a in db.query(Asset).all()}
    asset_id_map: dict[int, int] = {}  # old_id -> new_id
    imp, skip = 0, 0
    for row in payload.get("assets", []):
        if row.get("name") in existing_asset_names:
            # Map old id to existing record
            existing = db.query(Asset).filter(Asset.name == row["name"]).first()
            if existing and row.get("id"):
                asset_id_map[row["id"]] = existing.id
            skip += 1
            continue
        old_id = row.pop("id", None)
        row.pop("created_at", None)
        row.pop("updated_at", None)
        obj = Asset(**row)
        db.add(obj)
        db.flush()
        if old_id is not None:
            asset_id_map[old_id] = obj.id
        imp += 1
    imported["assets"] = imp
    skipped["assets"] = skip

    # ---- Contractors (match by name) ----
    existing_contractor_names = {c.name for c in db.query(Contractor).all()}
    contractor_id_map: dict[int, int] = {}
    imp, skip = 0, 0
    for row in payload.get("contractors", []):
        if row.get("name") in existing_contractor_names:
            existing = db.query(Contractor).filter(Contractor.name == row["name"]).first()
            if existing and row.get("id"):
                contractor_id_map[row["id"]] = existing.id
            skip += 1
            continue
        old_id = row.pop("id", None)
        row.pop("created_at", None)
        row.pop("updated_at", None)
        obj = Contractor(**row)
        db.add(obj)
        db.flush()
        if old_id is not None:
            contractor_id_map[old_id] = obj.id
        imp += 1
    imported["contractors"] = imp
    skipped["contractors"] = skip

    # ---- Tasks (match by name) ----
    existing_task_names = {t.name for t in db.query(Task).all()}
    task_id_map: dict[int, int] = {}
    imp, skip = 0, 0
    for row in payload.get("tasks", []):
        if row.get("name") in existing_task_names:
            existing = db.query(Task).filter(Task.name == row["name"]).first()
            if existing and row.get("id"):
                task_id_map[row["id"]] = existing.id
            skip += 1
            continue
        old_id = row.pop("id", None)
        row.pop("created_at", None)
        row.pop("updated_at", None)
        row.pop("notification_channels", None)
        # Remap asset_id FK
        if row.get("asset_id") is not None:
            row["asset_id"] = asset_id_map.get(row["asset_id"])
        obj = Task(**row)
        db.add(obj)
        db.flush()
        if old_id is not None:
            task_id_map[old_id] = obj.id
        imp += 1
    imported["tasks"] = imp
    skipped["tasks"] = skip

    # ---- Task Completions (match by old id via mapping) ----
    imp, skip = 0, 0
    for row in payload.get("task_completions", []):
        old_task_id = row.get("task_id")
        new_task_id = task_id_map.get(old_task_id)
        if new_task_id is None:
            skip += 1
            continue
        row.pop("id", None)
        row.pop("notification_channels", None)
        row["task_id"] = new_task_id
        # Remap contractor_id FK
        if row.get("contractor_id") is not None:
            row["contractor_id"] = contractor_id_map.get(row["contractor_id"])
        obj = TaskCompletion(**row)
        db.add(obj)
        imp += 1
    imported["task_completions"] = imp
    skipped["task_completions"] = skip

    # ---- Repairs ----
    existing_repair_titles = {
        (r.title, str(r.reported_date)) for r in db.query(Repair).all()
    }
    repair_id_map: dict[int, int] = {}
    imp, skip = 0, 0
    for row in payload.get("repairs", []):
        key = (row.get("title"), row.get("reported_date", ""))
        if key in existing_repair_titles:
            skip += 1
            continue
        old_id = row.pop("id", None)
        row.pop("created_at", None)
        row.pop("updated_at", None)
        row.pop("notification_channels", None)
        if row.get("asset_id") is not None:
            row["asset_id"] = asset_id_map.get(row["asset_id"])
        obj = Repair(**row)
        db.add(obj)
        db.flush()
        if old_id is not None:
            repair_id_map[old_id] = obj.id
        imp += 1
    imported["repairs"] = imp
    skipped["repairs"] = skip

    # ---- Documents ----
    existing_doc_names = {d.name for d in db.query(Document).all()}
    imp, skip = 0, 0
    for row in payload.get("documents", []):
        if row.get("name") in existing_doc_names:
            skip += 1
            continue
        row.pop("id", None)
        row.pop("created_at", None)
        row.pop("updated_at", None)
        row.pop("notification_channels", None)
        if row.get("asset_id") is not None:
            row["asset_id"] = asset_id_map.get(row["asset_id"])
        if row.get("task_id") is not None:
            row["task_id"] = task_id_map.get(row["task_id"])
        if row.get("repair_id") is not None:
            row["repair_id"] = repair_id_map.get(row["repair_id"])
        obj = Document(**row)
        db.add(obj)
        imp += 1
    imported["documents"] = imp
    skipped["documents"] = skip

    # ---- Supplies ----
    existing_supply_keys = {
        (s.task_id, s.name) for s in db.query(Supply).all()
    }
    imp, skip = 0, 0
    for row in payload.get("supplies", []):
        old_task_id = row.get("task_id")
        new_task_id = task_id_map.get(old_task_id)
        if new_task_id is None:
            skip += 1
            continue
        if (new_task_id, row.get("name")) in existing_supply_keys:
            skip += 1
            continue
        row.pop("id", None)
        row.pop("created_at", None)
        row.pop("notification_channels", None)
        row["task_id"] = new_task_id
        obj = Supply(**row)
        db.add(obj)
        imp += 1
    imported["supplies"] = imp
    skipped["supplies"] = skip

    db.commit()
    return {"imported": imported, "skipped": skipped}


# ---------------------------------------------------------------------------
# CSV Exports
# ---------------------------------------------------------------------------

def _csv_response(rows: list[dict], filename: str) -> StreamingResponse:
    if not rows:
        return StreamingResponse(
            iter([""]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/csv/tasks")
def export_csv_tasks(db: Session = Depends(get_db)):
    rows = [_serialize(t) for t in db.query(Task).all()]
    return _csv_response(rows, f"tasks-{date.today().isoformat()}.csv")


@router.get("/csv/completions")
def export_csv_completions(db: Session = Depends(get_db)):
    completions = db.query(TaskCompletion).all()
    task_names = {t.id: t.name for t in db.query(Task).all()}
    rows = []
    for c in completions:
        d = _serialize(c)
        d["task_name"] = task_names.get(c.task_id, "Unknown")
        rows.append(d)
    return _csv_response(rows, f"completions-{date.today().isoformat()}.csv")


@router.get("/csv/assets")
def export_csv_assets(db: Session = Depends(get_db)):
    rows = [_serialize(a) for a in db.query(Asset).all()]
    return _csv_response(rows, f"assets-{date.today().isoformat()}.csv")


@router.get("/csv/repairs")
def export_csv_repairs(db: Session = Depends(get_db)):
    rows = [_serialize(r) for r in db.query(Repair).all()]
    return _csv_response(rows, f"repairs-{date.today().isoformat()}.csv")


# ---------------------------------------------------------------------------
# PDF / Printable HTML Report
# ---------------------------------------------------------------------------

@router.get("/pdf", response_class=HTMLResponse)
def export_pdf_report(db: Session = Depends(get_db)):
    tasks = db.query(Task).order_by(Task.name).all()
    completions = db.query(TaskCompletion).order_by(TaskCompletion.completed_at.desc()).all()
    assets = db.query(Asset).order_by(Asset.name).all()
    repairs = db.query(Repair).order_by(Repair.reported_date.desc()).all()

    total_cost = sum(
        float(c.cost) for c in completions if c.cost
    ) + sum(float(r.cost) for r in repairs if r.cost)

    gen_date = datetime.now().strftime("%B %d, %Y")

    # Build completions grouped by task
    task_names = {t.id: t.name for t in tasks}
    grouped: dict[str, list] = {}
    for c in completions:
        tname = task_names.get(c.task_id, "Unknown")
        grouped.setdefault(tname, []).append(c)

    # Asset rows
    asset_rows = ""
    for a in assets:
        age = ""
        if a.install_date:
            years = (date.today() - a.install_date).days / 365.25
            age = f"{years:.1f} yrs"
        warranty = "N/A"
        if a.warranty_expires:
            warranty = "Active" if a.warranty_expires >= date.today() else "Expired"
        asset_rows += f"""<tr>
            <td>{a.name}</td>
            <td>{a.category.value if hasattr(a.category, 'value') else a.category}</td>
            <td>{a.install_date or '—'}</td>
            <td>{age or '—'}</td>
            <td>{warranty}</td>
        </tr>"""

    # Maintenance history
    history_html = ""
    for tname, comps in sorted(grouped.items()):
        history_html += f"<h3>{tname}</h3><table><thead><tr><th>Date</th><th>Cost</th><th>Notes</th><th>Duration</th></tr></thead><tbody>"
        for c in comps:
            cdate = c.completed_at.strftime("%Y-%m-%d") if c.completed_at else "—"
            cost = f"${float(c.cost):.2f}" if c.cost else "—"
            notes = c.notes or "—"
            dur = f"{c.duration_minutes} min" if c.duration_minutes else "—"
            history_html += f"<tr><td>{cdate}</td><td>{cost}</td><td>{notes}</td><td>{dur}</td></tr>"
        history_html += "</tbody></table>"

    # Repair history
    repair_rows = ""
    for r in repairs:
        cost = f"${float(r.cost):.2f}" if r.cost else "—"
        status = r.status.value if hasattr(r.status, "value") else r.status
        repair_rows += f"""<tr>
            <td>{r.title}</td>
            <td>{r.reported_date}</td>
            <td>{r.resolved_date or '—'}</td>
            <td>{cost}</td>
            <td>{status}</td>
        </tr>"""

    # Schedule
    schedule_rows = ""
    for t in tasks:
        freq = t.frequency.value if hasattr(t.frequency, "value") else t.frequency
        schedule_rows += f"""<tr>
            <td>{t.name}</td>
            <td>{freq}</td>
            <td>{t.next_due or '—'}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Home Maintenance Report</title>
<style>
    @media print {{
        body {{ print-color-adjust: exact; -webkit-print-color-adjust: exact; }}
        .no-print {{ display: none; }}
        h2 {{ page-break-before: auto; }}
    }}
    body {{
        font-family: Georgia, "Times New Roman", serif;
        max-width: 900px;
        margin: 0 auto;
        padding: 2rem;
        background: white;
        color: #111;
        line-height: 1.6;
    }}
    h1 {{
        border-bottom: 2px solid #333;
        padding-bottom: 0.5rem;
        margin-bottom: 0.25rem;
    }}
    .subtitle {{
        color: #666;
        margin-bottom: 2rem;
        font-size: 0.9rem;
    }}
    .summary {{
        display: flex;
        gap: 2rem;
        margin-bottom: 2rem;
        padding: 1rem;
        background: #f5f5f5;
        border-radius: 6px;
    }}
    .summary div {{
        text-align: center;
    }}
    .summary .num {{
        font-size: 1.75rem;
        font-weight: bold;
        display: block;
    }}
    .summary .label {{
        font-size: 0.8rem;
        color: #666;
    }}
    h2 {{
        margin-top: 2rem;
        border-bottom: 1px solid #ccc;
        padding-bottom: 0.25rem;
    }}
    h3 {{
        margin-top: 1.5rem;
        font-size: 1rem;
        color: #333;
    }}
    table {{
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1rem;
        font-size: 0.85rem;
    }}
    th, td {{
        border: 1px solid #ccc;
        padding: 0.4rem 0.6rem;
        text-align: left;
    }}
    th {{
        background: #f0f0f0;
        font-weight: 600;
    }}
    tr:nth-child(even) {{
        background: #fafafa;
    }}
    .print-btn {{
        position: fixed;
        top: 1rem;
        right: 1rem;
        padding: 0.75rem 1.5rem;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        cursor: pointer;
    }}
    .print-btn:hover {{
        background: #2563eb;
    }}
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>

<h1>Home Maintenance Report</h1>
<p class="subtitle">Generated on {gen_date}</p>

<div class="summary">
    <div><span class="num">{len(tasks)}</span><span class="label">Tasks</span></div>
    <div><span class="num">{len(completions)}</span><span class="label">Completions</span></div>
    <div><span class="num">${total_cost:,.2f}</span><span class="label">Total Cost</span></div>
    <div><span class="num">{len(assets)}</span><span class="label">Assets</span></div>
    <div><span class="num">{len(repairs)}</span><span class="label">Repairs</span></div>
</div>

<h2>Asset Inventory</h2>
<table>
<thead><tr><th>Name</th><th>Category</th><th>Install Date</th><th>Age</th><th>Warranty</th></tr></thead>
<tbody>{asset_rows if asset_rows else '<tr><td colspan="5">No assets recorded</td></tr>'}</tbody>
</table>

<h2>Maintenance History</h2>
{history_html if history_html else '<p>No completions recorded.</p>'}

<h2>Repair History</h2>
<table>
<thead><tr><th>Title</th><th>Reported</th><th>Resolved</th><th>Cost</th><th>Status</th></tr></thead>
<tbody>{repair_rows if repair_rows else '<tr><td colspan="5">No repairs recorded</td></tr>'}</tbody>
</table>

<h2>Active Maintenance Schedule</h2>
<table>
<thead><tr><th>Task</th><th>Frequency</th><th>Next Due</th></tr></thead>
<tbody>{schedule_rows if schedule_rows else '<tr><td colspan="3">No tasks scheduled</td></tr>'}</tbody>
</table>

</body>
</html>"""

    return HTMLResponse(content=html)
