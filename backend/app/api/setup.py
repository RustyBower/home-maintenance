from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.tasks import compute_next_due
from app.database import get_db
from app.models.task import Category, Frequency, Priority, Season, Task

router = APIRouter(prefix="/api/setup", tags=["setup"])

# Each feature maps to a list of tasks that get created when enabled
FEATURE_TASKS: dict[str, list[dict]] = {
    "core": [
        # These are universal — every home should have them
        {"name": "Check/replace HVAC air filters", "description": "Inspect air filters; replace if dirty. Check all returns.", "category": Category.HVAC, "frequency": Frequency.MONTHLY, "priority": Priority.P1, "estimated_minutes": 15},
        {"name": "Test smoke & CO detectors", "description": "Press test button on every smoke and CO detector in the house.", "category": Category.SAFETY, "frequency": Frequency.MONTHLY, "priority": Priority.P1, "estimated_minutes": 10},
        {"name": "Inspect fire extinguishers", "description": "Confirm pressure gauge is in the green zone and pin/seal is intact.", "category": Category.SAFETY, "frequency": Frequency.MONTHLY, "priority": Priority.P1, "estimated_minutes": 5},
        {"name": "Test GFCI outlets", "description": "Press test/reset on all GFCI outlets (kitchen, bath, garage, exterior).", "category": Category.ELECTRICAL, "frequency": Frequency.MONTHLY, "priority": Priority.P1, "estimated_minutes": 10},
        {"name": "Clean range hood filter", "description": "Soak range hood filter in degreasing solution. Grease buildup is a fire hazard.", "category": Category.APPLIANCES, "frequency": Frequency.MONTHLY, "priority": Priority.P2, "estimated_minutes": 20},
        {"name": "Vacuum refrigerator coils", "description": "Vacuum coils underneath/behind the fridge to maintain efficiency.", "category": Category.APPLIANCES, "frequency": Frequency.QUARTERLY, "priority": Priority.P2, "estimated_minutes": 15},
        {"name": "Clean dryer vent & lint ductwork", "description": "Clean lint from the entire vent run, not just the trap. Lint buildup is a fire hazard.", "category": Category.APPLIANCES, "frequency": Frequency.QUARTERLY, "priority": Priority.P1, "estimated_minutes": 30},
        {"name": "Check washing machine hoses", "description": "Inspect supply hoses for bulges, cracks, or leaking. Replace every 3-5 years.", "category": Category.APPLIANCES, "frequency": Frequency.QUARTERLY, "priority": Priority.P2, "estimated_minutes": 5},
        {"name": "Clean bathroom exhaust fans", "description": "Remove covers, vacuum dust and lint from fans and housing.", "category": Category.HVAC, "frequency": Frequency.QUARTERLY, "priority": Priority.P3, "estimated_minutes": 20},
        {"name": "Treat drains with enzyme cleaner", "description": "Use enzyme-based drain cleaner in all drains to prevent buildup.", "category": Category.PLUMBING, "frequency": Frequency.QUARTERLY, "priority": Priority.P3, "estimated_minutes": 15},
        {"name": "Replace smoke detector batteries", "description": "Replace batteries in all smoke detectors, even hardwired units. Replace units every 10 years.", "category": Category.SAFETY, "frequency": Frequency.ANNUAL, "priority": Priority.P1, "estimated_minutes": 30},
        {"name": "Replace CO detector batteries", "description": "Replace batteries in all CO detectors. Replace units every 5-7 years.", "category": Category.SAFETY, "frequency": Frequency.ANNUAL, "priority": Priority.P1, "estimated_minutes": 20},
        {"name": "Deep-clean major appliances", "description": "Dishwasher (clean filter, run cleaner), washing machine (clean gasket, run cleaner), fridge (drip pan, water filter).", "category": Category.APPLIANCES, "frequency": Frequency.ANNUAL, "priority": Priority.P3, "estimated_minutes": 90},
        {"name": "Visual inspect electrical panel", "description": "Look for scorch marks, corrosion, or overheating signs. Schedule electrician if anything abnormal.", "category": Category.ELECTRICAL, "frequency": Frequency.ANNUAL, "priority": Priority.P1, "estimated_minutes": 10},
    ],
    "hvac_pro": [
        {"name": "Schedule professional A/C tune-up", "description": "Technician checks refrigerant, cleans coils, inspects electrical before cooling season.", "category": Category.HVAC, "frequency": Frequency.SEASONAL, "season": Season.SPRING, "priority": Priority.P1, "estimated_minutes": 15},
        {"name": "Schedule professional furnace tune-up", "description": "Technician inspects heat exchanger, burners, ignition, and safety controls before heating season.", "category": Category.HVAC, "frequency": Frequency.SEASONAL, "season": Season.FALL, "priority": Priority.P1, "estimated_minutes": 15},
        {"name": "Reverse ceiling fan direction", "description": "Switch to clockwise for winter — pushes warm air down from ceiling.", "category": Category.HVAC, "frequency": Frequency.SEASONAL, "season": Season.FALL, "priority": Priority.P3, "estimated_minutes": 10},
    ],
    "plumbing": [
        {"name": "Run water in unused fixtures", "description": "Run taps and flush toilets in guest baths to prevent P-trap dry-out and sewer gas.", "category": Category.PLUMBING, "frequency": Frequency.MONTHLY, "priority": Priority.P2, "estimated_minutes": 10},
        {"name": "Test water heater pressure relief valve", "description": "Lift the T&P valve lever briefly — water should flow freely and stop when released.", "category": Category.PLUMBING, "frequency": Frequency.QUARTERLY, "priority": Priority.P1, "estimated_minutes": 10},
        {"name": "Full water heater drain & flush", "description": "Completely drain and refill water heater to remove sediment buildup.", "category": Category.PLUMBING, "frequency": Frequency.ANNUAL, "priority": Priority.P1, "estimated_minutes": 45},
        {"name": "Inspect water heater anode rod", "description": "Check anode rod for corrosion. Replace every 3-5 years to prevent tank corrosion.", "category": Category.PLUMBING, "frequency": Frequency.ANNUAL, "priority": Priority.P2, "estimated_minutes": 30},
        {"name": "Exercise all shut-off valves", "description": "Open/close main water shut-off and individual fixture valves so they don't seize.", "category": Category.PLUMBING, "frequency": Frequency.ANNUAL, "priority": Priority.P2, "estimated_minutes": 30},
    ],
    "exterior": [
        {"name": "Clean gutters & downspouts (spring)", "description": "Remove debris, flush with hose, verify downspouts direct water away from foundation.", "category": Category.EXTERIOR, "frequency": Frequency.SEASONAL, "season": Season.SPRING, "priority": Priority.P1, "estimated_minutes": 90},
        {"name": "Inspect roof", "description": "Check for missing, cracked, or curling shingles. Inspect flashing around vents and chimney.", "category": Category.EXTERIOR, "frequency": Frequency.SEASONAL, "season": Season.SPRING, "priority": Priority.P1, "estimated_minutes": 30},
        {"name": "Power wash exterior surfaces", "description": "Power wash siding, deck, patio, driveway, and walkways.", "category": Category.EXTERIOR, "frequency": Frequency.SEASONAL, "season": Season.SPRING, "priority": Priority.P3, "estimated_minutes": 180},
        {"name": "Inspect & repair exterior caulking", "description": "Check caulking around windows, doors, siding joints, and where utilities enter the house.", "category": Category.EXTERIOR, "frequency": Frequency.SEASONAL, "season": Season.SPRING, "priority": Priority.P2, "estimated_minutes": 60},
        {"name": "Clean gutters & downspouts (fall)", "description": "Clean gutters after leaves have fallen. Check downspout flow.", "category": Category.EXTERIOR, "frequency": Frequency.SEASONAL, "season": Season.FALL, "priority": Priority.P1, "estimated_minutes": 90},
        {"name": "Caulk & seal exterior gaps", "description": "Seal gaps around windows, doors, and foundation to prevent cold air and pest entry.", "category": Category.EXTERIOR, "frequency": Frequency.SEASONAL, "season": Season.FALL, "priority": Priority.P2, "estimated_minutes": 60},
        {"name": "Inspect foundation for cracks", "description": "Walk perimeter and inspect foundation. Hairline cracks are normal; horizontal or >1/4in cracks need a pro.", "category": Category.EXTERIOR, "frequency": Frequency.ANNUAL, "priority": Priority.P1, "estimated_minutes": 20},
        {"name": "Inspect attic insulation & ventilation", "description": "Check insulation coverage and R-value. Ensure soffit and ridge vents are unblocked.", "category": Category.EXTERIOR, "frequency": Frequency.ANNUAL, "priority": Priority.P2, "estimated_minutes": 30},
    ],
    "lawn": [
        {"name": "Trim trees & shrubs away from house", "description": "Maintain 3+ feet clearance from siding and roof. Branches invite pests and cause damage.", "category": Category.OUTDOOR, "frequency": Frequency.SEASONAL, "season": Season.SPRING, "priority": Priority.P2, "estimated_minutes": 120},
        {"name": "Service lawn mower", "description": "Change oil, sharpen blades, replace spark plug, replace air filter.", "category": Category.OUTDOOR, "frequency": Frequency.SEASONAL, "season": Season.SPRING, "priority": Priority.P2, "estimated_minutes": 60},
        {"name": "Winterize lawn equipment", "description": "Stabilize fuel or drain, clean, and store mower, trimmer, and related equipment.", "category": Category.OUTDOOR, "frequency": Frequency.SEASONAL, "season": Season.FALL, "priority": Priority.P2, "estimated_minutes": 45},
        {"name": "Aerate & overseed lawn", "description": "Core aerate and overseed cool-season grass. Fall is ideal timing.", "category": Category.OUTDOOR, "frequency": Frequency.SEASONAL, "season": Season.FALL, "priority": Priority.P3, "estimated_minutes": 120},
    ],
    "snow_equipment": [
        {"name": "Summerize snow equipment", "description": "Stabilize fuel or drain, clean, and store snow blower and related equipment.", "category": Category.OUTDOOR, "frequency": Frequency.SEASONAL, "season": Season.SPRING, "priority": Priority.P2, "estimated_minutes": 45},
    ],
    "outdoor_faucets": [
        {"name": "Check exterior faucets for freeze damage", "description": "Turn on all outdoor faucets and hose bibs; check for leaks from winter freeze damage.", "category": Category.PLUMBING, "frequency": Frequency.SEASONAL, "season": Season.SPRING, "priority": Priority.P1, "estimated_minutes": 15},
        {"name": "Blow out & winterize outdoor hoses/faucets", "description": "Disconnect hoses, close interior shut-off valves, open hose bibs to drain.", "category": Category.PLUMBING, "frequency": Frequency.SEASONAL, "season": Season.FALL, "priority": Priority.P1, "estimated_minutes": 30},
    ],
    "irrigation": [
        {"name": "Start up irrigation system", "description": "Turn on irrigation, check for broken heads, adjust coverage, check timer settings.", "category": Category.OUTDOOR, "frequency": Frequency.SEASONAL, "season": Season.SPRING, "priority": Priority.P2, "estimated_minutes": 20},
        {"name": "Winterize irrigation system", "description": "Blow out irrigation lines. Shut off supply valve.", "category": Category.OUTDOOR, "frequency": Frequency.SEASONAL, "season": Season.FALL, "priority": Priority.P1, "estimated_minutes": 20},
    ],
    "hot_tub": [
        {"name": "Hot tub water test & chemical balance", "description": "Test pH, alkalinity, and sanitizer levels. Adjust as needed.", "category": Category.HOT_TUB, "frequency": Frequency.WEEKLY, "priority": Priority.P2, "estimated_minutes": 15},
        {"name": "Hot tub filter rinse", "description": "Remove and rinse filter cartridge with garden hose.", "category": Category.HOT_TUB, "frequency": Frequency.MONTHLY, "priority": Priority.P2, "estimated_minutes": 10},
        {"name": "Hot tub deep clean & filter soak", "description": "Deep clean hot tub shell, soak filter cartridge in cleaning solution overnight.", "category": Category.HOT_TUB, "frequency": Frequency.QUARTERLY, "priority": Priority.P2, "estimated_minutes": 60},
    ],
    "pool": [
        {"name": "Pool water test & chemical balance", "description": "Test pH, chlorine, alkalinity, and CYA. Adjust as needed.", "category": Category.OTHER, "frequency": Frequency.WEEKLY, "priority": Priority.P2, "estimated_minutes": 15},
        {"name": "Clean pool skimmer baskets", "description": "Empty skimmer and pump baskets. Check for debris.", "category": Category.OTHER, "frequency": Frequency.WEEKLY, "priority": Priority.P2, "estimated_minutes": 10},
        {"name": "Vacuum & brush pool", "description": "Brush walls, vacuum floor, clean tile line.", "category": Category.OTHER, "frequency": Frequency.MONTHLY, "priority": Priority.P2, "estimated_minutes": 45},
        {"name": "Backwash pool filter", "description": "Backwash or clean pool filter per manufacturer specs.", "category": Category.OTHER, "frequency": Frequency.MONTHLY, "priority": Priority.P2, "estimated_minutes": 15},
        {"name": "Open pool for season", "description": "Remove cover, reconnect equipment, shock, balance chemistry.", "category": Category.OTHER, "frequency": Frequency.SEASONAL, "season": Season.SPRING, "priority": Priority.P1, "estimated_minutes": 180},
        {"name": "Close pool for season", "description": "Lower water level, blow out lines, add winterizing chemicals, install cover.", "category": Category.OTHER, "frequency": Frequency.SEASONAL, "season": Season.FALL, "priority": Priority.P1, "estimated_minutes": 180},
    ],
    "gas_fireplace": [
        {"name": "Inspect gas fireplace & chimney", "description": "Annual inspection of gas fireplace. Check pilot, thermocouple, glass, venting, and chimney cap.", "category": Category.HVAC, "frequency": Frequency.SEASONAL, "season": Season.FALL, "priority": Priority.P1, "estimated_minutes": 30},
    ],
    "wood_fireplace": [
        {"name": "Schedule chimney sweep", "description": "Professional chimney sweep and inspection. Required annually for wood-burning fireplaces.", "category": Category.HVAC, "frequency": Frequency.SEASONAL, "season": Season.FALL, "priority": Priority.P1, "estimated_minutes": 15},
        {"name": "Inspect firebox and damper", "description": "Check firebox for cracks, damper operation, and creosote buildup.", "category": Category.HVAC, "frequency": Frequency.SEASONAL, "season": Season.FALL, "priority": Priority.P1, "estimated_minutes": 15},
    ],
    "garage": [
        {"name": "Inspect garage door hardware", "description": "Check springs, cables, and rollers. Lubricate tracks and hinges. Test auto-reverse and balance.", "category": Category.GARAGE, "frequency": Frequency.ANNUAL, "priority": Priority.P2, "estimated_minutes": 30},
    ],
    "pest_control": [
        {"name": "Schedule pest / termite inspection", "description": "Annual professional inspection for termites and other pests.", "category": Category.PEST, "frequency": Frequency.SEASONAL, "season": Season.SPRING, "priority": Priority.P2, "estimated_minutes": 15},
    ],
    "septic": [
        {"name": "Inspect septic system", "description": "Annual visual inspection of septic tank, drain field, and distribution box.", "category": Category.PLUMBING, "frequency": Frequency.ANNUAL, "priority": Priority.P1, "estimated_minutes": 30},
        {"name": "Pump septic tank", "description": "Professional septic tank pumping. Typically every 3-5 years depending on household size.", "category": Category.PLUMBING, "frequency": Frequency.BIANNUAL, "priority": Priority.P1, "estimated_minutes": 15},
    ],
    "sump_pump": [
        {"name": "Test sump pump", "description": "Pour water into the pit, confirm pump activates and drains properly. Check backup battery.", "category": Category.PLUMBING, "frequency": Frequency.QUARTERLY, "priority": Priority.P1, "estimated_minutes": 10},
    ],
    "water_softener": [
        {"name": "Check water softener salt level", "description": "Inspect salt level and refill as needed. Check for salt bridges.", "category": Category.PLUMBING, "frequency": Frequency.MONTHLY, "priority": Priority.P2, "estimated_minutes": 5},
    ],
}

FEATURES_META = [
    {"id": "core", "label": "Core Home (HVAC, safety, appliances)", "description": "Essential tasks every home needs", "default": True, "locked": True},
    {"id": "hvac_pro", "label": "Professional HVAC Service", "description": "Spring A/C and fall furnace tune-ups", "default": True},
    {"id": "plumbing", "label": "Water Heater & Plumbing", "description": "Water heater maintenance, shut-off valve exercise", "default": True},
    {"id": "exterior", "label": "Exterior & Roof", "description": "Gutters, roof, caulking, foundation, attic", "default": True},
    {"id": "lawn", "label": "Lawn & Landscaping", "description": "Mower service, tree trimming, aeration", "default": True},
    {"id": "snow_equipment", "label": "Snow Blower / Snow Equipment", "description": "Seasonal storage and prep", "default": False},
    {"id": "outdoor_faucets", "label": "Outdoor Faucets / Hose Bibs", "description": "Winterize and check for freeze damage", "default": True},
    {"id": "irrigation", "label": "Irrigation / Sprinkler System", "description": "Spring startup and fall blowout", "default": False},
    {"id": "hot_tub", "label": "Hot Tub / Spa", "description": "Weekly water testing, monthly filter, quarterly deep clean", "default": False},
    {"id": "pool", "label": "Swimming Pool", "description": "Water chemistry, cleaning, seasonal open/close", "default": False},
    {"id": "gas_fireplace", "label": "Gas Fireplace", "description": "Annual inspection", "default": False},
    {"id": "wood_fireplace", "label": "Wood-Burning Fireplace", "description": "Chimney sweep and firebox inspection", "default": False},
    {"id": "garage", "label": "Garage Door", "description": "Hardware inspection and lubrication", "default": True},
    {"id": "pest_control", "label": "Pest / Termite Control", "description": "Annual professional inspection", "default": True},
    {"id": "septic", "label": "Septic System", "description": "Inspection and pumping", "default": False},
    {"id": "sump_pump", "label": "Sump Pump", "description": "Quarterly testing", "default": False},
    {"id": "water_softener", "label": "Water Softener", "description": "Monthly salt level check", "default": False},
]


@router.get("/features")
def get_features():
    """Return available home features with their task counts."""
    return [
        {
            **meta,
            "task_count": len(FEATURE_TASKS.get(meta["id"], [])),
        }
        for meta in FEATURES_META
    ]


@router.post("/populate")
def populate_tasks(features: list[str], db: Session = Depends(get_db)):
    """Create tasks for the selected home features."""
    existing_names = {t.name for t in db.query(Task.name).all()}
    created = 0
    skipped = 0

    for feature_id in features:
        tasks = FEATURE_TASKS.get(feature_id, [])
        for task_data in tasks:
            if task_data["name"] in existing_names:
                skipped += 1
                continue
            task = Task(**task_data)
            task.next_due = compute_next_due(task)
            db.add(task)
            existing_names.add(task_data["name"])
            created += 1

    db.commit()
    return {"created": created, "skipped": skipped}


@router.get("/status")
def setup_status(db: Session = Depends(get_db)):
    """Check if setup has been completed (i.e., tasks exist)."""
    count = db.query(Task).count()
    return {"has_tasks": count > 0, "task_count": count}
