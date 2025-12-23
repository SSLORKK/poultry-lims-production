"""Add signature_image column to signatures table

Revision ID: a1b2c3d4e5f6
Revises: 902aff2801fa
Create Date: 2024-12-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'add_drive_items_table'
branch_labels = None
depends_on = None


def upgrade():
    # Add signature_image column to signatures table
    op.add_column('signatures', sa.Column('signature_image', sa.String(), nullable=True))


def downgrade():
    # Remove signature_image column from signatures table
    op.drop_column('signatures', 'signature_image')
