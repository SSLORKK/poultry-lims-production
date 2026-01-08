"""Add hidden_diseases column to pcr_coa table

Revision ID: 20250108_hidden_diseases
Revises: 20250108_pcr_report
Create Date: 2025-01-08

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250108_hidden_diseases'
down_revision = '20250108_pcr_report'
branch_labels = None
depends_on = None


def upgrade():
    # Add hidden_diseases JSON column to pcr_coa table
    op.add_column('pcr_coa', sa.Column('hidden_diseases', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('pcr_coa', 'hidden_diseases')
