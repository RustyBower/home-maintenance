"""add repairs table

Revision ID: 609643f94469
Revises: cdcc0ca1186c
Create Date: 2026-03-25 20:11:02.610501

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '609643f94469'
down_revision: Union[str, None] = 'cdcc0ca1186c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create new enum types
    op.execute("CREATE TYPE repairstatus AS ENUM ('REPORTED', 'IN_PROGRESS', 'RESOLVED')")
    op.execute("CREATE TYPE severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EMERGENCY')")

    op.execute("""
        CREATE TABLE repairs (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            diagnosis TEXT,
            resolution TEXT,
            category category NOT NULL,
            asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
            contractor_name VARCHAR(255),
            cost NUMERIC(10,2),
            reported_date DATE NOT NULL,
            resolved_date DATE,
            status repairstatus NOT NULL DEFAULT 'REPORTED',
            severity severity NOT NULL DEFAULT 'MEDIUM',
            photo_url VARCHAR(500),
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)


def downgrade() -> None:
    op.drop_table('repairs')
    op.execute("DROP TYPE IF EXISTS severity")
    op.execute("DROP TYPE IF EXISTS repairstatus")
