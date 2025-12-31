"""Add missing columns to test data and COA tables

Revision ID: 20241231_add_cols
Revises: 20241231_db_opt
Create Date: 2024-12-31

This migration adds:
1. created_at, updated_at columns to pcr_data, serology_data, microbiology_data
2. created_at, updated_at columns to pcr_coa
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '20241231_add_cols'
down_revision = '20241231_db_opt'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ===========================================
    # 1. PCR_DATA - Add timestamps
    # ===========================================
    op.add_column('pcr_data', sa.Column('created_at', sa.DateTime(), nullable=True))
    op.add_column('pcr_data', sa.Column('updated_at', sa.DateTime(), nullable=True))
    
    # Set default values for existing rows
    op.execute("UPDATE pcr_data SET created_at = NOW(), updated_at = NOW() WHERE created_at IS NULL")
    
    # ===========================================
    # 2. SEROLOGY_DATA - Add timestamps
    # ===========================================
    op.add_column('serology_data', sa.Column('created_at', sa.DateTime(), nullable=True))
    op.add_column('serology_data', sa.Column('updated_at', sa.DateTime(), nullable=True))
    
    # Set default values for existing rows
    op.execute("UPDATE serology_data SET created_at = NOW(), updated_at = NOW() WHERE created_at IS NULL")
    
    # ===========================================
    # 3. MICROBIOLOGY_DATA - Add timestamps
    # ===========================================
    op.add_column('microbiology_data', sa.Column('created_at', sa.DateTime(), nullable=True))
    op.add_column('microbiology_data', sa.Column('updated_at', sa.DateTime(), nullable=True))
    
    # Set default values for existing rows
    op.execute("UPDATE microbiology_data SET created_at = NOW(), updated_at = NOW() WHERE created_at IS NULL")
    
    # ===========================================
    # 4. PCR_COA - Add timestamps if not exist
    # ===========================================
    # Check if columns exist before adding
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    pcr_coa_columns = [col['name'] for col in inspector.get_columns('pcr_coa')]
    
    if 'created_at' not in pcr_coa_columns:
        op.add_column('pcr_coa', sa.Column('created_at', sa.DateTime(), nullable=True))
        op.execute("UPDATE pcr_coa SET created_at = NOW() WHERE created_at IS NULL")
    
    if 'updated_at' not in pcr_coa_columns:
        op.add_column('pcr_coa', sa.Column('updated_at', sa.DateTime(), nullable=True))
        op.execute("UPDATE pcr_coa SET updated_at = NOW() WHERE updated_at IS NULL")


def downgrade() -> None:
    # Drop columns in reverse order
    op.drop_column('pcr_coa', 'updated_at')
    op.drop_column('pcr_coa', 'created_at')
    op.drop_column('microbiology_data', 'updated_at')
    op.drop_column('microbiology_data', 'created_at')
    op.drop_column('serology_data', 'updated_at')
    op.drop_column('serology_data', 'created_at')
    op.drop_column('pcr_data', 'updated_at')
    op.drop_column('pcr_data', 'created_at')
