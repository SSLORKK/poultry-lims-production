"""Add kit_type column to pcr_data table

Revision ID: 20250103_pcr_kit
Revises: 20241231_add_cols
Create Date: 2025-01-03

This migration adds:
1. kit_type column to pcr_data table to fix sample creation error
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250103_pcr_kit'
down_revision = '20241231_add_cols'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if column already exists before adding
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    pcr_data_columns = [col['name'] for col in inspector.get_columns('pcr_data')]
    
    if 'kit_type' not in pcr_data_columns:
        op.add_column('pcr_data', sa.Column('kit_type', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('pcr_data', 'kit_type')
