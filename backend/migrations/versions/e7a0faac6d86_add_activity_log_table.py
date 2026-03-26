"""add activity log table

Revision ID: e7a0faac6d86
Revises: 6adab6941c42
Create Date: 2026-03-26 14:43:01.103154

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e7a0faac6d86'
down_revision: Union[str, None] = '6adab6941c42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


activityaction_enum = postgresql.ENUM(
    'created', 'updated', 'completed', 'snoozed', 'deleted', 'status_changed',
    name='activityaction', create_type=False,
)
entitytype_enum = postgresql.ENUM(
    'task', 'asset', 'repair', 'contractor', 'document', 'supply',
    name='entitytype', create_type=False,
)


def upgrade() -> None:
    activityaction_enum.create(op.get_bind(), checkfirst=True)
    entitytype_enum.create(op.get_bind(), checkfirst=True)
    op.create_table('activity_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('action', activityaction_enum, nullable=False),
        sa.Column('entity_type', entitytype_enum, nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('entity_name', sa.String(length=255), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('activity_log')
    activityaction_enum.drop(op.get_bind(), checkfirst=True)
    entitytype_enum.drop(op.get_bind(), checkfirst=True)
