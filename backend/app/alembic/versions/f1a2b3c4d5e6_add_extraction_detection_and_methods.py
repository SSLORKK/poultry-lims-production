"""add extraction methods table

Revision ID: f1a2b3c4d5e6
Revises: add_extraction_detection
Create Date: 2025-11-10

"""
from alembic import op
import sqlalchemy as sa

revision = 'f1a2b3c4d5e6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Create extraction_methods table
    op.create_table(
        'extraction_methods',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_extraction_methods_id'), 'extraction_methods', ['id'], unique=False)
    op.create_index(op.f('ix_extraction_methods_name'), 'extraction_methods', ['name'], unique=True)

def downgrade() -> None:
    # Drop extraction_methods table
    op.drop_index(op.f('ix_extraction_methods_name'), table_name='extraction_methods')
    op.drop_index(op.f('ix_extraction_methods_id'), table_name='extraction_methods')
    op.drop_table('extraction_methods')
