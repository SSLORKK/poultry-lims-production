"""Add report_no column to pcr_coa table

Revision ID: 20250108_pcr_report
Revises: 20250105_coa_cols
Create Date: 2025-01-08

This migration adds:
1. report_no column (String) - stores the test report number in format P(yy)-x
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250108_pcr_report'
down_revision = '20250105_coa_cols'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if column already exists before adding
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    pcr_coa_columns = [col['name'] for col in inspector.get_columns('pcr_coa')]
    
    if 'report_no' not in pcr_coa_columns:
        op.add_column('pcr_coa', sa.Column('report_no', sa.String(20), nullable=True))
        op.create_index('ix_pcr_coa_report_no', 'pcr_coa', ['report_no'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_pcr_coa_report_no', table_name='pcr_coa')
    op.drop_column('pcr_coa', 'report_no')
