"""Add pathogenic fungi & mold table

Revision ID: add_pathogenic_fungi_mold
Revises: add_culture_isolation_types
Create Date: 2025-12-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_pathogenic_fungi_mold'
down_revision = 'add_culture_isolation_types'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create pathogenic_fungi_mold table
    op.create_table(
        'pathogenic_fungi_mold',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), unique=True, index=True, nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
    )


def downgrade() -> None:
    # Drop pathogenic_fungi_mold table
    op.drop_table('pathogenic_fungi_mold')
