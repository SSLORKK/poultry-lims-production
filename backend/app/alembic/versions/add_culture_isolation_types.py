"""Add culture isolation types table

Revision ID: add_culture_isolation_types
Revises: 1ff1fab5b56d
Create Date: 2025-12-08

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_culture_isolation_types'
down_revision = '1ff1fab5b56d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create culture_isolation_types table
    op.create_table(
        'culture_isolation_types',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), unique=True, index=True, nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
    )


def downgrade() -> None:
    # Drop culture_isolation_types table
    op.drop_table('culture_isolation_types')
