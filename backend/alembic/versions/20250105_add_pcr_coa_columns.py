"""Add sample_types and house_values columns to pcr_coa table

Revision ID: 20250105_coa_cols
Revises: 20260103_add_sequence_based_counters
Create Date: 2025-01-05

This migration adds:
1. sample_types column (JSON) - stores column configuration for duplicated columns
2. house_values column (JSON) - stores house values per column
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250105_coa_cols'
down_revision = '20260103_seq_counters'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if columns already exist before adding
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    pcr_coa_columns = [col['name'] for col in inspector.get_columns('pcr_coa')]
    
    if 'sample_types' not in pcr_coa_columns:
        op.add_column('pcr_coa', sa.Column('sample_types', sa.JSON(), nullable=True))
    
    if 'house_values' not in pcr_coa_columns:
        op.add_column('pcr_coa', sa.Column('house_values', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('pcr_coa', 'house_values')
    op.drop_column('pcr_coa', 'sample_types')
