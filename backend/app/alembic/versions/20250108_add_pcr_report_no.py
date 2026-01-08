"""Add report_no column to pcr_coa table

Revision ID: 20250108_pcr_report
Revises: 20250108_merge
Create Date: 2025-01-08

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250108_pcr_report'
down_revision = '20250108_merge'
branch_labels = None
depends_on = None


def upgrade():
    # Add report_no column to pcr_coa table
    op.add_column('pcr_coa', sa.Column('report_no', sa.String(20), nullable=True, unique=True))


def downgrade():
    op.drop_column('pcr_coa', 'report_no')
