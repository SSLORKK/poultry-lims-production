"""Database optimization - indexes, SerologyCOA, data types

Revision ID: 20241231_db_opt
Revises: 
Create Date: 2024-12-31

This migration includes:
1. Add missing indexes to user_permissions, edit_history, counters
2. Create SerologyCOA table (was missing)
3. Add composite indexes for performance optimization
4. Fix data type inconsistencies
5. Add indexes to Drive, Sample, Unit models
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite


# revision identifiers, used by Alembic.
revision = '20241231_db_opt'
down_revision = 'add_drive_permissions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ===========================================
    # 1. CREATE NEW SEROLOGY_COAS TABLE
    # ===========================================
    op.create_table(
        'serology_coas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('unit_id', sa.Integer(), nullable=False),
        sa.Column('test_results', sa.JSON(), nullable=True),
        sa.Column('well_data', sa.JSON(), nullable=True),
        sa.Column('test_report_numbers', sa.JSON(), nullable=True),
        sa.Column('test_methods', sa.JSON(), nullable=True),
        sa.Column('kit_types', sa.JSON(), nullable=True),
        sa.Column('date_tested', sa.Date(), nullable=True),
        sa.Column('tested_by', sa.String(length=255), nullable=True),
        sa.Column('reviewed_by', sa.String(length=255), nullable=True),
        sa.Column('lab_supervisor', sa.String(length=255), nullable=True),
        sa.Column('lab_manager', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True, default='draft'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['unit_id'], ['units.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('unit_id')
    )
    op.create_index('ix_serology_coas_id', 'serology_coas', ['id'], unique=False)
    op.create_index('ix_serology_coas_unit_id', 'serology_coas', ['unit_id'], unique=True)
    
    # ===========================================
    # 2. USER_PERMISSIONS INDEXES
    # ===========================================
    # Add individual indexes
    op.create_index('ix_user_permissions_user_id', 'user_permissions', ['user_id'], unique=False, if_not_exists=True)
    op.create_index('ix_user_permissions_screen_name', 'user_permissions', ['screen_name'], unique=False, if_not_exists=True)
    # Add composite index
    op.create_index('ix_user_permissions_user_screen', 'user_permissions', ['user_id', 'screen_name'], unique=False, if_not_exists=True)
    
    # ===========================================
    # 3. EDIT_HISTORY INDEXES
    # ===========================================
    op.create_index('ix_edit_history_field_name', 'edit_history', ['field_name'], unique=False, if_not_exists=True)
    op.create_index('ix_edit_history_edited_by', 'edit_history', ['edited_by'], unique=False, if_not_exists=True)
    op.create_index('ix_edit_history_edited_at', 'edit_history', ['edited_at'], unique=False, if_not_exists=True)
    # Composite indexes
    op.create_index('ix_edit_history_entity', 'edit_history', ['entity_type', 'entity_id'], unique=False, if_not_exists=True)
    op.create_index('ix_edit_history_time_range', 'edit_history', ['edited_at', 'entity_type'], unique=False, if_not_exists=True)
    
    # ===========================================
    # 4. COUNTERS INDEXES
    # ===========================================
    op.create_index('ix_counters_counter_type', 'counters', ['counter_type'], unique=False, if_not_exists=True)
    op.create_index('ix_counters_department_id', 'counters', ['department_id'], unique=False, if_not_exists=True)
    op.create_index('ix_counters_year', 'counters', ['year'], unique=False, if_not_exists=True)
    # Composite index
    op.create_index('ix_counters_type_dept_year', 'counters', ['counter_type', 'department_id', 'year'], unique=False, if_not_exists=True)
    
    # ===========================================
    # 5. SAMPLES INDEXES
    # ===========================================
    op.create_index('ix_samples_date_received', 'samples', ['date_received'], unique=False, if_not_exists=True)
    op.create_index('ix_samples_company', 'samples', ['company'], unique=False, if_not_exists=True)
    op.create_index('ix_samples_farm', 'samples', ['farm'], unique=False, if_not_exists=True)
    op.create_index('ix_samples_status', 'samples', ['status'], unique=False, if_not_exists=True)
    op.create_index('ix_samples_created_at', 'samples', ['created_at'], unique=False, if_not_exists=True)
    # Composite indexes
    op.create_index('ix_samples_company_farm', 'samples', ['company', 'farm'], unique=False, if_not_exists=True)
    op.create_index('ix_samples_date_status', 'samples', ['date_received', 'status'], unique=False, if_not_exists=True)
    op.create_index('ix_samples_year_status', 'samples', ['year', 'status'], unique=False, if_not_exists=True)
    
    # ===========================================
    # 6. UNITS INDEXES
    # ===========================================
    op.create_index('ix_units_sample_id', 'units', ['sample_id'], unique=False, if_not_exists=True)
    op.create_index('ix_units_department_id', 'units', ['department_id'], unique=False, if_not_exists=True)
    op.create_index('ix_units_coa_status', 'units', ['coa_status'], unique=False, if_not_exists=True)
    op.create_index('ix_units_created_at', 'units', ['created_at'], unique=False, if_not_exists=True)
    # Composite indexes
    op.create_index('ix_units_sample_dept', 'units', ['sample_id', 'department_id'], unique=False, if_not_exists=True)
    op.create_index('ix_units_coa_status_dept', 'units', ['coa_status', 'department_id'], unique=False, if_not_exists=True)
    
    # ===========================================
    # 7. TEST DATA INDEXES (pcr_data, serology_data, microbiology_data)
    # ===========================================
    op.create_index('ix_pcr_data_unit_id', 'pcr_data', ['unit_id'], unique=True, if_not_exists=True)
    op.create_index('ix_serology_data_unit_id', 'serology_data', ['unit_id'], unique=True, if_not_exists=True)
    op.create_index('ix_microbiology_data_unit_id', 'microbiology_data', ['unit_id'], unique=True, if_not_exists=True)
    
    # ===========================================
    # 8. COA TABLES INDEXES
    # ===========================================
    op.create_index('ix_pcr_coa_unit_id', 'pcr_coa', ['unit_id'], unique=True, if_not_exists=True)
    op.create_index('ix_pcr_coa_date_tested', 'pcr_coa', ['date_tested'], unique=False, if_not_exists=True)
    op.create_index('ix_pcr_coa_status', 'pcr_coa', ['status'], unique=False, if_not_exists=True)
    op.create_index('ix_pcr_coa_status_date', 'pcr_coa', ['status', 'date_tested'], unique=False, if_not_exists=True)
    
    op.create_index('ix_microbiology_coas_unit_id', 'microbiology_coas', ['unit_id'], unique=True, if_not_exists=True)
    op.create_index('ix_microbiology_coas_date_tested', 'microbiology_coas', ['date_tested'], unique=False, if_not_exists=True)
    op.create_index('ix_microbiology_coas_status', 'microbiology_coas', ['status'], unique=False, if_not_exists=True)
    op.create_index('ix_microbiology_coas_created_at', 'microbiology_coas', ['created_at'], unique=False, if_not_exists=True)
    op.create_index('ix_microbiology_coas_status_date', 'microbiology_coas', ['status', 'date_tested'], unique=False, if_not_exists=True)
    
    # ===========================================
    # 9. DRIVE_ITEMS INDEXES
    # ===========================================
    op.create_index('ix_drive_items_name', 'drive_items', ['name'], unique=False, if_not_exists=True)
    op.create_index('ix_drive_items_type', 'drive_items', ['type'], unique=False, if_not_exists=True)
    op.create_index('ix_drive_items_mime_type', 'drive_items', ['mime_type'], unique=False, if_not_exists=True)
    op.create_index('ix_drive_items_created_by', 'drive_items', ['created_by'], unique=False, if_not_exists=True)
    op.create_index('ix_drive_items_is_public', 'drive_items', ['is_public'], unique=False, if_not_exists=True)
    # Composite indexes
    op.create_index('ix_drive_items_parent_deleted', 'drive_items', ['parent_id', 'is_deleted'], unique=False, if_not_exists=True)
    op.create_index('ix_drive_items_parent_type', 'drive_items', ['parent_id', 'type'], unique=False, if_not_exists=True)
    op.create_index('ix_drive_items_name_search', 'drive_items', ['name', 'is_deleted'], unique=False, if_not_exists=True)


def downgrade() -> None:
    # Drop serology_coas table
    op.drop_index('ix_serology_coas_unit_id', table_name='serology_coas')
    op.drop_index('ix_serology_coas_id', table_name='serology_coas')
    op.drop_table('serology_coas')
    
    # Drop user_permissions indexes
    op.drop_index('ix_user_permissions_user_screen', table_name='user_permissions', if_exists=True)
    op.drop_index('ix_user_permissions_screen_name', table_name='user_permissions', if_exists=True)
    op.drop_index('ix_user_permissions_user_id', table_name='user_permissions', if_exists=True)
    
    # Drop edit_history indexes
    op.drop_index('ix_edit_history_time_range', table_name='edit_history', if_exists=True)
    op.drop_index('ix_edit_history_entity', table_name='edit_history', if_exists=True)
    op.drop_index('ix_edit_history_edited_at', table_name='edit_history', if_exists=True)
    op.drop_index('ix_edit_history_edited_by', table_name='edit_history', if_exists=True)
    op.drop_index('ix_edit_history_field_name', table_name='edit_history', if_exists=True)
    
    # Drop counters indexes
    op.drop_index('ix_counters_type_dept_year', table_name='counters', if_exists=True)
    op.drop_index('ix_counters_year', table_name='counters', if_exists=True)
    op.drop_index('ix_counters_department_id', table_name='counters', if_exists=True)
    op.drop_index('ix_counters_counter_type', table_name='counters', if_exists=True)
    
    # Drop samples indexes
    op.drop_index('ix_samples_year_status', table_name='samples', if_exists=True)
    op.drop_index('ix_samples_date_status', table_name='samples', if_exists=True)
    op.drop_index('ix_samples_company_farm', table_name='samples', if_exists=True)
    op.drop_index('ix_samples_created_at', table_name='samples', if_exists=True)
    op.drop_index('ix_samples_status', table_name='samples', if_exists=True)
    op.drop_index('ix_samples_farm', table_name='samples', if_exists=True)
    op.drop_index('ix_samples_company', table_name='samples', if_exists=True)
    op.drop_index('ix_samples_date_received', table_name='samples', if_exists=True)
    
    # Drop units indexes
    op.drop_index('ix_units_coa_status_dept', table_name='units', if_exists=True)
    op.drop_index('ix_units_sample_dept', table_name='units', if_exists=True)
    op.drop_index('ix_units_created_at', table_name='units', if_exists=True)
    op.drop_index('ix_units_coa_status', table_name='units', if_exists=True)
    op.drop_index('ix_units_department_id', table_name='units', if_exists=True)
    op.drop_index('ix_units_sample_id', table_name='units', if_exists=True)
    
    # Drop test data indexes
    op.drop_index('ix_pcr_data_unit_id', table_name='pcr_data', if_exists=True)
    op.drop_index('ix_serology_data_unit_id', table_name='serology_data', if_exists=True)
    op.drop_index('ix_microbiology_data_unit_id', table_name='microbiology_data', if_exists=True)
    
    # Drop COA indexes
    op.drop_index('ix_pcr_coa_status_date', table_name='pcr_coa', if_exists=True)
    op.drop_index('ix_pcr_coa_status', table_name='pcr_coa', if_exists=True)
    op.drop_index('ix_pcr_coa_date_tested', table_name='pcr_coa', if_exists=True)
    op.drop_index('ix_pcr_coa_unit_id', table_name='pcr_coa', if_exists=True)
    
    op.drop_index('ix_microbiology_coas_status_date', table_name='microbiology_coas', if_exists=True)
    op.drop_index('ix_microbiology_coas_created_at', table_name='microbiology_coas', if_exists=True)
    op.drop_index('ix_microbiology_coas_status', table_name='microbiology_coas', if_exists=True)
    op.drop_index('ix_microbiology_coas_date_tested', table_name='microbiology_coas', if_exists=True)
    op.drop_index('ix_microbiology_coas_unit_id', table_name='microbiology_coas', if_exists=True)
    
    # Drop drive_items indexes
    op.drop_index('ix_drive_items_name_search', table_name='drive_items', if_exists=True)
    op.drop_index('ix_drive_items_parent_type', table_name='drive_items', if_exists=True)
    op.drop_index('ix_drive_items_parent_deleted', table_name='drive_items', if_exists=True)
    op.drop_index('ix_drive_items_is_public', table_name='drive_items', if_exists=True)
    op.drop_index('ix_drive_items_created_by', table_name='drive_items', if_exists=True)
    op.drop_index('ix_drive_items_mime_type', table_name='drive_items', if_exists=True)
    op.drop_index('ix_drive_items_type', table_name='drive_items', if_exists=True)
    op.drop_index('ix_drive_items_name', table_name='drive_items', if_exists=True)
