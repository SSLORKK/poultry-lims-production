"""Add unit edit tracking fields

Revision ID: add_unit_edit_tracking
Revises: 
Create Date: 2024-12-21

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_unit_edit_tracking'
down_revision = 'add_tests_count'
branch_labels = None
depends_on = None


def upgrade():
    # Add edit tracking columns to units table
    op.add_column('units', sa.Column('created_at', sa.DateTime(), nullable=True))
    op.add_column('units', sa.Column('updated_at', sa.DateTime(), nullable=True))
    op.add_column('units', sa.Column('last_edited_by', sa.String(), nullable=True))


def downgrade():
    op.drop_column('units', 'last_edited_by')
    op.drop_column('units', 'updated_at')
    op.drop_column('units', 'created_at')
