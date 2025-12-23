"""restructure_sample_and_unit_tables

Revision ID: 5497462bc4de
Revises: b3cd4e270c86
Create Date: 2025-10-18 10:25:14.764269

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5497462bc4de'
down_revision: Union[str, Sequence[str], None] = 'b3cd4e270c86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop units table if it exists
    op.execute("DROP TABLE IF EXISTS units CASCADE")
    
    # Drop old samples table
    op.execute("DROP TABLE IF EXISTS samples CASCADE")
    
    # Update counters table
    op.add_column('counters', sa.Column('counter_type', sa.String(), nullable=False, server_default='sample'))
    op.alter_column('counters', 'department_id', nullable=True)
    op.execute("ALTER TABLE counters DROP CONSTRAINT IF EXISTS counters_department_id_key")
    
    # Create new samples table
    op.create_table(
        'samples',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sample_code', sa.String(), nullable=False),
        sa.Column('patient_name', sa.String(), nullable=True),
        sa.Column('patient_info', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_samples_id', 'samples', ['id'])
    op.create_index('ix_samples_sample_code', 'samples', ['sample_code'], unique=True)
    
    # Create units table
    op.create_table(
        'units',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sample_id', sa.Integer(), nullable=False),
        sa.Column('department_id', sa.Integer(), nullable=False),
        sa.Column('unit_code', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['sample_id'], ['samples.id']),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_units_id', 'units', ['id'])
    op.create_index('ix_units_unit_code', 'units', ['unit_code'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop new tables
    op.drop_table('units')
    op.drop_table('samples')
    
    # Restore counters table
    op.drop_column('counters', 'counter_type')
    op.alter_column('counters', 'department_id', nullable=False)
    op.create_unique_constraint('counters_department_id_key', 'counters', ['department_id'])
    
    # Recreate old samples table
    op.create_table(
        'samples',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sample_id', sa.String(), nullable=False),
        sa.Column('unit_ids', sa.String(), nullable=False),
        sa.Column('department_id', sa.Integer(), nullable=False),
        sa.Column('patient_name', sa.String(), nullable=True),
        sa.Column('patient_info', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.PrimaryKeyConstraint('id')
    )
