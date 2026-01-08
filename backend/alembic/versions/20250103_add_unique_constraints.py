"""Add unique constraints for sample_code and unit_code

Revision ID: 20250103_unique
Revises: 20250103_update_unit_codes_format
Create Date: 2025-01-03

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250103_unique'
down_revision = '20250103_unit_codes'
branch_labels = None
depends_on = None


def upgrade():
    # Add unique constraint on sample_code
    op.create_unique_constraint('uq_samples_sample_code', 'samples', ['sample_code'])
    
    # Add unique constraint on unit_code
    op.create_unique_constraint('uq_units_unit_code', 'units', ['unit_code'])


def downgrade():
    # Remove unique constraints
    op.drop_constraint('uq_samples_sample_code', 'samples', type_='unique')
    op.drop_constraint('uq_units_unit_code', 'units', type_='unique')
