"""Add technician_name to serology_data

Revision ID: add_tech_serology
Revises: add_tests_count
Create Date: 2024-12-31

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_tech_serology'
down_revision = 'add_hidden_indexes_mic'
branch_labels = None
depends_on = None


def upgrade():
    # Add technician_name column to serology_data table
    op.add_column('serology_data', sa.Column('technician_name', sa.String(), nullable=True))


def downgrade():
    op.drop_column('serology_data', 'technician_name')
