"""add documents table

Revision ID: 4c14e12040dd
Revises: 7fe3b69d2024
Create Date: 2026-03-26 12:32:47.011909

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c14e12040dd'
down_revision: Union[str, None] = '7fe3b69d2024'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE documenttype AS ENUM ('WARRANTY', 'MANUAL', 'PERMIT', 'INSPECTION', 'INSURANCE', 'RECEIPT', 'OTHER')")

    op.execute("""
        CREATE TABLE documents (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            doc_type documenttype NOT NULL,
            url VARCHAR(500) NOT NULL,
            asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
            task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
            repair_id INTEGER REFERENCES repairs(id) ON DELETE SET NULL,
            notes TEXT,
            expiry_date DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)


def downgrade() -> None:
    op.drop_table('documents')
    op.execute("DROP TYPE IF EXISTS documenttype")
