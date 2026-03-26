from datetime import date

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.asset import Asset
from app.models.task import Category
from app.schemas.asset import AssetCreate, AssetOut, AssetUpdate, AssetWithTasks
from app.schemas.task import TaskOut
from app.api.tasks import task_to_out

router = APIRouter(prefix="/api/assets", tags=["assets"])


def compute_asset_fields(asset: Asset, schema: AssetOut) -> AssetOut:
    today = date.today()

    # age_years
    if asset.install_date:
        delta = today - asset.install_date
        schema.age_years = round(delta.days / 365.25, 1)
    else:
        schema.age_years = None

    # warranty_status
    if asset.warranty_expires:
        schema.warranty_status = "active" if asset.warranty_expires >= today else "expired"
    else:
        schema.warranty_status = "unknown"

    # replacement_estimate
    if asset.install_date and asset.expected_lifespan_years:
        schema.replacement_estimate = asset.install_date + relativedelta(
            years=asset.expected_lifespan_years
        )
    else:
        schema.replacement_estimate = None

    return schema


def asset_to_out(asset: Asset) -> AssetOut:
    data = AssetOut.model_validate(asset, from_attributes=True)
    return compute_asset_fields(asset, data)


def asset_to_out_with_tasks(asset: Asset) -> AssetWithTasks:
    data = AssetWithTasks.model_validate(asset, from_attributes=True)
    compute_asset_fields(asset, data)
    data.tasks = [task_to_out(t) for t in asset.tasks]
    return data


@router.get("", response_model=list[AssetOut])
def list_assets(
    category: Category | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Asset)
    if category:
        q = q.filter(Asset.category == category)
    assets = q.order_by(Asset.name).all()
    return [asset_to_out(a) for a in assets]


@router.get("/{asset_id}", response_model=AssetWithTasks)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    return asset_to_out_with_tasks(asset)


@router.post("", response_model=AssetOut, status_code=201)
def create_asset(data: AssetCreate, db: Session = Depends(get_db)):
    asset = Asset(**data.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset_to_out(asset)


@router.patch("/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: int, data: AssetUpdate, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    db.commit()
    db.refresh(asset)
    return asset_to_out(asset)


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    db.delete(asset)
    db.commit()
