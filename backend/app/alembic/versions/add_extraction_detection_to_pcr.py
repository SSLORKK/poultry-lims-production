"""add extraction and detection to pcr

Revision ID: add_extraction_detection
Revises: 9c0de2b30db8
Create Date: 2025-11-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_extraction_detection'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add extraction and detection columns to pcr_data table
    op.add_column('pcr_data', sa.Column('extraction', sa.Integer(), nullable=True))
    op.add_column('pcr_data', sa.Column('detection', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove extraction and detection columns from pcr_data table
    op.drop_column('pcr_data', 'detection')
    op.drop_column('pcr_data', 'extraction')
