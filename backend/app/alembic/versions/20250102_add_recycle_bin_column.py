"""add recycle bin original_parent_id column

Revision ID: 20250102_add_recycle_bin
Revises: 20241231_database_optimization
Create Date: 2025-01-02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250102_add_recycle_bin'
down_revision = 'add_drive_perm_enhance'
branch_labels = None
depends_on = None


def upgrade():
    # Add original_parent_id column to drive_items table
    op.add_column('drive_items', sa.Column('original_parent_id', sa.Integer(), nullable=True))
    
    # Create index for faster queries
    op.create_index('ix_drive_items_original_parent_id', 'drive_items', ['original_parent_id'])


def downgrade():
    # Remove index
    op.drop_index('ix_drive_items_original_parent_id', table_name='drive_items')
    
    # Remove column
    op.drop_column('drive_items', 'original_parent_id')
