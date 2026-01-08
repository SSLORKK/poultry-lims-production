"""Merge multiple heads into single chain

Revision ID: 20250108_merge
Revises: 20250102_add_recycle_bin, add_user_security_fields
Create Date: 2025-01-08

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250108_merge'
down_revision = ('20250102_add_recycle_bin', 'add_user_security_fields')
branch_labels = None
depends_on = None


def upgrade():
    # Merge migration - no schema changes needed
    pass


def downgrade():
    # Merge migration - no schema changes needed
    pass
