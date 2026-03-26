"""add recurring_expenses and checklists tables

Revision ID: 33f034c630c6
Revises: e7a0faac6d86
Create Date: 2026-03-26 14:46:18.669172

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '33f034c630c6'
down_revision: Union[str, None] = 'e7a0faac6d86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Checklist tables (no shared enums, safe to use op.create_table)
    op.create_table('checklist_templates',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('items', sa.Text(), server_default='[]', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('checklist_instances',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('template_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('items_state', sa.Text(), server_default='[]', nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['template_id'], ['checklist_templates.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )

    # Recurring expenses - uses existing category enum, so use raw SQL
    op.execute("CREATE TYPE expensefrequency AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL')")
    op.execute("""
        CREATE TABLE recurring_expenses (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            category category NOT NULL,
            amount NUMERIC(10,2) NOT NULL,
            frequency expensefrequency NOT NULL,
            provider VARCHAR(255),
            start_date DATE,
            renewal_date DATE,
            auto_renew BOOLEAN NOT NULL DEFAULT true,
            notes TEXT,
            active BOOLEAN NOT NULL DEFAULT true,
            contractor_id INTEGER REFERENCES contractors(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)


def downgrade() -> None:
    op.drop_table('recurring_expenses')
    op.execute("DROP TYPE IF EXISTS expensefrequency")
    op.drop_table('checklist_instances')
    op.drop_table('checklist_templates')
