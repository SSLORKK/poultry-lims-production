"""add_poultry_fields_and_department_data_tables

Revision ID: ad311e378314
Revises: 5497462bc4de
Create Date: 2025-10-18 11:02:10.731831

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ad311e378314'
down_revision: Union[str, Sequence[str], None] = '5497462bc4de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    
    # Add new poultry-specific fields to samples table
    op.add_column('samples', sa.Column('date_received', sa.Date(), nullable=True))
    op.add_column('samples', sa.Column('company', sa.String(), nullable=True))
    op.add_column('samples', sa.Column('farm', sa.String(), nullable=True))
    op.add_column('samples', sa.Column('cycle', sa.String(), nullable=True))
    op.add_column('samples', sa.Column('flock', sa.String(), nullable=True))
    op.add_column('samples', sa.Column('house', sa.String(), nullable=True))
    op.add_column('samples', sa.Column('age', sa.Integer(), nullable=True))
    op.add_column('samples', sa.Column('source', sa.String(), nullable=True))
    op.add_column('samples', sa.Column('sample_type', sa.String(), nullable=True))
    op.add_column('samples', sa.Column('samples_number', sa.Integer(), nullable=True, server_default='1'))
    op.add_column('samples', sa.Column('notes', sa.Text(), nullable=True))
    op.add_column('samples', sa.Column('status', sa.String(), nullable=True, server_default='pending'))
    op.add_column('samples', sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now()))
    
    # Remove old patient fields
    op.drop_column('samples', 'patient_name')
    op.drop_column('samples', 'patient_info')
    
    # Create PCR data table
    op.create_table(
        'pcr_data',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sample_id', sa.Integer(), nullable=False),
        sa.Column('diseases_list', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('kit_type', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['sample_id'], ['samples.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sample_id')
    )
    op.create_index(op.f('ix_pcr_data_id'), 'pcr_data', ['id'], unique=False)
    
    # Create Serology data table
    op.create_table(
        'serology_data',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sample_id', sa.Integer(), nullable=False),
        sa.Column('diseases_list', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('kit_type', sa.String(), nullable=True),
        sa.Column('number_of_wells', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['sample_id'], ['samples.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sample_id')
    )
    op.create_index(op.f('ix_serology_data_id'), 'serology_data', ['id'], unique=False)
    
    # Create Microbiology data table
    op.create_table(
        'microbiology_data',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sample_id', sa.Integer(), nullable=False),
        sa.Column('diseases_list', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('batch_no', sa.String(), nullable=True),
        sa.Column('fumigation', sa.String(), nullable=True),
        sa.Column('index_list', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['sample_id'], ['samples.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sample_id')
    )
    op.create_index(op.f('ix_microbiology_data_id'), 'microbiology_data', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    
    # Drop department data tables
    op.drop_index(op.f('ix_microbiology_data_id'), table_name='microbiology_data')
    op.drop_table('microbiology_data')
    op.drop_index(op.f('ix_serology_data_id'), table_name='serology_data')
    op.drop_table('serology_data')
    op.drop_index(op.f('ix_pcr_data_id'), table_name='pcr_data')
    op.drop_table('pcr_data')
    
    # Add back patient fields
    op.add_column('samples', sa.Column('patient_info', sa.String(), nullable=True))
    op.add_column('samples', sa.Column('patient_name', sa.String(), nullable=True))
    
    # Remove poultry fields
    op.drop_column('samples', 'updated_at')
    op.drop_column('samples', 'status')
    op.drop_column('samples', 'notes')
    op.drop_column('samples', 'samples_number')
    op.drop_column('samples', 'sample_type')
    op.drop_column('samples', 'source')
    op.drop_column('samples', 'age')
    op.drop_column('samples', 'house')
    op.drop_column('samples', 'flock')
    op.drop_column('samples', 'cycle')
    op.drop_column('samples', 'farm')
    op.drop_column('samples', 'company')
    op.drop_column('samples', 'date_received')
