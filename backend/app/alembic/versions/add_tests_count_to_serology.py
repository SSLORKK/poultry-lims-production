"""add tests_count to serology

Revision ID: add_tests_count
Revises: add_culture_isolation_types
Create Date: 2025-12-09

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_tests_count'
down_revision = 'add_culture_screened_pathogens'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add tests_count column to serology_data table
    op.add_column('serology_data', sa.Column('tests_count', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove tests_count column from serology_data table
    op.drop_column('serology_data', 'tests_count')
