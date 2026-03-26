import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.checklist import ChecklistInstance, ChecklistTemplate
from app.schemas.checklist import (
    InstanceCreate,
    InstanceOut,
    InstanceUpdate,
    TemplateCreate,
    TemplateOut,
    TemplateUpdate,
)

router = APIRouter(prefix="/api/checklists", tags=["checklists"])

# ---------------------------------------------------------------------------
# Default templates — seeded on first GET if table is empty
# ---------------------------------------------------------------------------

DEFAULT_TEMPLATES = [
    {
        "name": "Leaving for Vacation",
        "description": "Everything to do before leaving the house for an extended trip.",
        "items": [
            {"name": "Lower thermostat", "description": None, "order": 0},
            {"name": "Stop mail / hold packages", "description": None, "order": 1},
            {"name": "Set timers on lights", "description": None, "order": 2},
            {"name": "Unplug appliances", "description": None, "order": 3},
            {"name": "Lock all doors and windows", "description": None, "order": 4},
            {"name": "Turn off water main", "description": None, "order": 5},
            {"name": "Empty fridge perishables", "description": None, "order": 6},
            {"name": "Take out trash", "description": None, "order": 7},
        ],
    },
    {
        "name": "Pre-Winter Checklist",
        "description": "Prepare the house for cold weather.",
        "items": [
            {"name": "Winterize exterior hoses", "description": "Disconnect, drain, and store garden hoses", "order": 0},
            {"name": "Check furnace filter", "description": "Replace if dirty", "order": 1},
            {"name": "Reverse ceiling fans", "description": "Set to clockwise for winter", "order": 2},
            {"name": "Check weather stripping", "description": "Doors and windows", "order": 3},
            {"name": "Stock ice melt", "description": None, "order": 4},
            {"name": "Check sump pump", "description": "Pour water in pit to test", "order": 5},
            {"name": "Insulate exposed pipes", "description": None, "order": 6},
            {"name": "Check smoke detectors", "description": "Test and replace batteries", "order": 7},
        ],
    },
    {
        "name": "Spring Opening",
        "description": "Get the house ready for warmer weather.",
        "items": [
            {"name": "Check A/C system", "description": "Run a test cycle, replace filter", "order": 0},
            {"name": "Clean gutters", "description": None, "order": 1},
            {"name": "Inspect roof", "description": "Look for missing shingles or damage", "order": 2},
            {"name": "Check exterior caulking", "description": "Windows, doors, siding joints", "order": 3},
            {"name": "Service lawn mower", "description": "Oil, blade, spark plug", "order": 4},
            {"name": "Turn on irrigation system", "description": "Check for leaks", "order": 5},
            {"name": "Check exterior faucets", "description": "Test for freeze damage", "order": 6},
            {"name": "Fertilize lawn", "description": None, "order": 7},
        ],
    },
    {
        "name": "Hosting / Party Prep",
        "description": "Prepare the house for guests.",
        "items": [
            {"name": "Deep clean bathrooms", "description": None, "order": 0},
            {"name": "Stock supplies", "description": "Paper towels, toilet paper, soap, trash bags", "order": 1},
            {"name": "Check guest room", "description": "Fresh linens, clear space", "order": 2},
            {"name": "Clean kitchen", "description": "Counters, appliances, floors", "order": 3},
            {"name": "Prep outdoor space", "description": "Sweep patio, set up seating", "order": 4},
            {"name": "Check lighting", "description": "Replace burnt-out bulbs", "order": 5},
            {"name": "Test smoke detectors", "description": None, "order": 6},
        ],
    },
]


def _seed_defaults(db: Session) -> None:
    """Create default templates if table is empty. Idempotent."""
    count = db.query(ChecklistTemplate).count()
    if count > 0:
        return
    for tpl in DEFAULT_TEMPLATES:
        template = ChecklistTemplate(
            name=tpl["name"],
            description=tpl["description"],
            items=json.dumps(tpl["items"]),
        )
        db.add(template)
    db.commit()


def _template_to_out(template: ChecklistTemplate) -> TemplateOut:
    items = json.loads(template.items) if isinstance(template.items, str) else template.items
    return TemplateOut(
        id=template.id,
        name=template.name,
        description=template.description,
        items=items,
        created_at=template.created_at,
        updated_at=template.updated_at,
    )


def _instance_to_out(instance: ChecklistInstance) -> InstanceOut:
    items_state = json.loads(instance.items_state) if isinstance(instance.items_state, str) else instance.items_state
    checked = sum(1 for item in items_state if item.get("checked"))
    total = len(items_state)
    template_name = instance.template.name if instance.template else None
    return InstanceOut(
        id=instance.id,
        template_id=instance.template_id,
        name=instance.name,
        started_at=instance.started_at,
        completed_at=instance.completed_at,
        items_state=items_state,
        notes=instance.notes,
        template_name=template_name,
        checked_count=checked,
        total_count=total,
    )


# ---------------------------------------------------------------------------
# Template endpoints
# ---------------------------------------------------------------------------


@router.get("/templates", response_model=list[TemplateOut])
def list_templates(db: Session = Depends(get_db)):
    _seed_defaults(db)
    templates = db.query(ChecklistTemplate).order_by(ChecklistTemplate.name).all()
    return [_template_to_out(t) for t in templates]


@router.get("/templates/{template_id}", response_model=TemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.get(ChecklistTemplate, template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    return _template_to_out(template)


@router.post("/templates", response_model=TemplateOut, status_code=201)
def create_template(data: TemplateCreate, db: Session = Depends(get_db)):
    # Ensure items have sequential order
    items = [
        {"name": item.name, "description": item.description, "order": idx}
        for idx, item in enumerate(data.items)
    ]
    template = ChecklistTemplate(
        name=data.name,
        description=data.description,
        items=json.dumps(items),
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return _template_to_out(template)


@router.patch("/templates/{template_id}", response_model=TemplateOut)
def update_template(template_id: int, data: TemplateUpdate, db: Session = Depends(get_db)):
    template = db.get(ChecklistTemplate, template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    if data.name is not None:
        template.name = data.name
    if data.description is not None:
        template.description = data.description
    if data.items is not None:
        items = [
            {"name": item.name, "description": item.description, "order": idx}
            for idx, item in enumerate(data.items)
        ]
        template.items = json.dumps(items)
    db.commit()
    db.refresh(template)
    return _template_to_out(template)


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.get(ChecklistTemplate, template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    db.delete(template)
    db.commit()


# ---------------------------------------------------------------------------
# Instance endpoints
# ---------------------------------------------------------------------------


@router.post("/templates/{template_id}/start", response_model=InstanceOut, status_code=201)
def start_checklist(template_id: int, data: InstanceCreate | None = None, db: Session = Depends(get_db)):
    template = db.get(ChecklistTemplate, template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    items = json.loads(template.items) if isinstance(template.items, str) else template.items
    items_state = [
        {
            "name": item["name"],
            "description": item.get("description"),
            "order": item.get("order", idx),
            "checked": False,
            "checked_at": None,
        }
        for idx, item in enumerate(items)
    ]
    name = (data.name if data and data.name else template.name)
    instance = ChecklistInstance(
        template_id=template.id,
        name=name,
        items_state=json.dumps(items_state),
    )
    db.add(instance)
    db.commit()
    db.refresh(instance)
    return _instance_to_out(instance)


@router.get("/instances", response_model=list[InstanceOut])
def list_instances(
    status: str | None = Query(None, pattern="^(active|completed)$"),
    db: Session = Depends(get_db),
):
    q = db.query(ChecklistInstance)
    if status == "active":
        q = q.filter(ChecklistInstance.completed_at.is_(None))
    elif status == "completed":
        q = q.filter(ChecklistInstance.completed_at.isnot(None))
    instances = q.order_by(ChecklistInstance.started_at.desc()).all()
    return [_instance_to_out(i) for i in instances]


@router.get("/instances/{instance_id}", response_model=InstanceOut)
def get_instance(instance_id: int, db: Session = Depends(get_db)):
    instance = db.get(ChecklistInstance, instance_id)
    if not instance:
        raise HTTPException(404, "Checklist instance not found")
    return _instance_to_out(instance)


@router.patch("/instances/{instance_id}", response_model=InstanceOut)
def update_instance(instance_id: int, data: InstanceUpdate, db: Session = Depends(get_db)):
    instance = db.get(ChecklistInstance, instance_id)
    if not instance:
        raise HTTPException(404, "Checklist instance not found")
    if data.name is not None:
        instance.name = data.name
    if data.notes is not None:
        instance.notes = data.notes
    db.commit()
    db.refresh(instance)
    return _instance_to_out(instance)


@router.post("/instances/{instance_id}/toggle/{item_index}", response_model=InstanceOut)
def toggle_item(instance_id: int, item_index: int, db: Session = Depends(get_db)):
    instance = db.get(ChecklistInstance, instance_id)
    if not instance:
        raise HTTPException(404, "Checklist instance not found")
    items_state = json.loads(instance.items_state) if isinstance(instance.items_state, str) else instance.items_state
    if item_index < 0 or item_index >= len(items_state):
        raise HTTPException(400, "Item index out of range")

    item = items_state[item_index]
    if item.get("checked"):
        item["checked"] = False
        item["checked_at"] = None
    else:
        item["checked"] = True
        item["checked_at"] = datetime.now(timezone.utc).isoformat()

    instance.items_state = json.dumps(items_state)

    # Auto-set or clear completed_at
    all_checked = all(i.get("checked") for i in items_state)
    if all_checked and not instance.completed_at:
        instance.completed_at = datetime.now(timezone.utc)
    elif not all_checked and instance.completed_at:
        instance.completed_at = None

    db.commit()
    db.refresh(instance)
    return _instance_to_out(instance)


@router.delete("/instances/{instance_id}", status_code=204)
def delete_instance(instance_id: int, db: Session = Depends(get_db)):
    instance = db.get(ChecklistInstance, instance_id)
    if not instance:
        raise HTTPException(404, "Checklist instance not found")
    db.delete(instance)
    db.commit()
