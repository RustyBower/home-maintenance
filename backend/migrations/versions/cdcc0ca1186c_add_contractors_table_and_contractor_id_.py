"""add contractors table and contractor_id to task_completions

Revision ID: cdcc0ca1186c
Revises: 9069eaeed352
Create Date: 2026-03-25 19:58:54.209811

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'cdcc0ca1186c'
down_revision: Union[str, None] = '9069eaeed352'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Reference the existing category enum type - do not recreate it
category_enum = postgresql.ENUM(
    'HVAC', 'PLUMBING', 'ELECTRICAL', 'EXTERIOR', 'OUTDOOR',
    'APPLIANCES', 'SAFETY', 'HOT_TUB', 'GARAGE', 'PEST', 'OTHER',
    name='category', create_type=False,
)


def upgrade() -> None:
    op.create_table('contractors',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('specialty', category_enum, nullable=False),
    sa.Column('phone', sa.String(length=50), nullable=True),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('website', sa.String(length=500), nullable=True),
    sa.Column('address', sa.Text(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('rating', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.add_column('task_completions', sa.Column('contractor_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_task_completions_contractor_id', 'task_completions', 'contractors', ['contractor_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_task_completions_contractor_id', 'task_completions', type_='foreignkey')
    op.drop_column('task_completions', 'contractor_id')
    op.drop_table('contractors')
