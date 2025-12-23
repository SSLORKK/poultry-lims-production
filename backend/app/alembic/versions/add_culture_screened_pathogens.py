"""Add culture screened pathogens table

Revision ID: add_culture_screened_pathogens
Revises: add_pathogenic_fungi_mold
Create Date: 2025-12-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_culture_screened_pathogens'
down_revision = 'add_pathogenic_fungi_mold'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create culture_screened_pathogens table
    op.create_table(
        'culture_screened_pathogens',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(), unique=True, index=True, nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
    )


def downgrade() -> None:
    # Drop culture_screened_pathogens table
    op.drop_table('culture_screened_pathogens')
