"""Add sequence-based counters for gap-proof sample codes

Revision ID: 20260103_seq_counters
Revises: 20250103_add_unique_constraints
Create Date: 2026-01-03

This migration adds:
1. PostgreSQL sequences for sample and unit numbers
2. A reserved_codes table to track codes that are "in-flight" but not yet committed
3. Functions to manage code generation atomically
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '20260103_seq_counters'
down_revision = '20250103_unique'
branch_labels = None
depends_on = None

current_year = datetime.now().year

def upgrade():
    # Create reserved_codes table to track in-flight codes
    op.create_table(
        'reserved_codes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code_type', sa.String(50), nullable=False),  # 'sample' or 'unit'
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('department_id', sa.Integer(), sa.ForeignKey('departments.id'), nullable=True),
        sa.Column('reserved_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),  # Auto-expire after 5 minutes
        sa.Column('session_id', sa.String(100), nullable=True),  # Track which session reserved it
    )
    
    op.create_index('ix_reserved_codes_code', 'reserved_codes', ['code'])
    op.create_index('ix_reserved_codes_expires', 'reserved_codes', ['expires_at'])
    op.create_index('ix_reserved_codes_type_year', 'reserved_codes', ['code_type', 'year'])
    
    # Create a function to get next available sample number (finds gaps)
    op.execute("""
        CREATE OR REPLACE FUNCTION get_next_sample_number(p_year INTEGER)
        RETURNS INTEGER AS $$
        DECLARE
            v_next_num INTEGER;
            v_year_short TEXT;
        BEGIN
            v_year_short := LPAD((p_year % 100)::TEXT, 2, '0');
            
            -- Find the first gap in sample numbers, or next after max
            -- Exclude reserved codes that haven't expired
            WITH all_nums AS (
                -- Existing samples
                SELECT CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER) as num
                FROM samples
                WHERE year = p_year AND sample_code LIKE 'SMP%'
                UNION
                -- Reserved but not yet committed
                SELECT CAST(SPLIT_PART(code, '-', 2) AS INTEGER) as num
                FROM reserved_codes
                WHERE code_type = 'sample' 
                  AND year = p_year 
                  AND expires_at > NOW()
            ),
            gaps AS (
                -- Check if 1 is available
                SELECT 1 as gap_num 
                WHERE NOT EXISTS (SELECT 1 FROM all_nums WHERE num = 1)
                UNION ALL
                -- Find gaps in sequence
                SELECT num + 1 
                FROM all_nums n 
                WHERE NOT EXISTS (SELECT 1 FROM all_nums WHERE num = n.num + 1)
                  AND num < (SELECT COALESCE(MAX(num), 0) FROM all_nums)
                UNION ALL
                -- Next after max
                SELECT COALESCE(MAX(num), 0) + 1 FROM all_nums
            )
            SELECT MIN(gap_num) INTO v_next_num FROM gaps;
            
            RETURN COALESCE(v_next_num, 1);
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create a function to reserve a sample code
    op.execute("""
        CREATE OR REPLACE FUNCTION reserve_sample_code(p_year INTEGER, p_session_id TEXT DEFAULT NULL)
        RETURNS TEXT AS $$
        DECLARE
            v_next_num INTEGER;
            v_code TEXT;
            v_year_short TEXT;
        BEGIN
            v_year_short := LPAD((p_year % 100)::TEXT, 2, '0');
            
            -- Get next available number
            v_next_num := get_next_sample_number(p_year);
            v_code := 'SMP' || v_year_short || '-' || v_next_num;
            
            -- Reserve the code (expires in 5 minutes)
            INSERT INTO reserved_codes (code_type, code, year, reserved_at, expires_at, session_id)
            VALUES ('sample', v_code, p_year, NOW(), NOW() + INTERVAL '5 minutes', p_session_id)
            ON CONFLICT (code) DO NOTHING;
            
            -- If insert failed due to conflict, recursively try next
            IF NOT FOUND THEN
                RETURN reserve_sample_code(p_year, p_session_id);
            END IF;
            
            RETURN v_code;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create a function to confirm a reserved code (called after successful insert)
    op.execute("""
        CREATE OR REPLACE FUNCTION confirm_sample_code(p_code TEXT)
        RETURNS VOID AS $$
        BEGIN
            -- Remove from reserved_codes since it's now in samples table
            DELETE FROM reserved_codes WHERE code = p_code;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create a function to release an expired reservation
    op.execute("""
        CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
        RETURNS INTEGER AS $$
        DECLARE
            v_count INTEGER;
        BEGIN
            DELETE FROM reserved_codes WHERE expires_at < NOW();
            GET DIAGNOSTICS v_count = ROW_COUNT;
            RETURN v_count;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Create similar functions for unit codes
    op.execute("""
        CREATE OR REPLACE FUNCTION get_next_unit_number(p_dept_id INTEGER, p_year INTEGER)
        RETURNS INTEGER AS $$
        DECLARE
            v_next_num INTEGER;
            v_dept_code TEXT;
            v_year_short TEXT;
            v_pattern TEXT;
        BEGIN
            -- Get department code
            SELECT code INTO v_dept_code FROM departments WHERE id = p_dept_id;
            IF v_dept_code IS NULL THEN
                RETURN 1;
            END IF;
            
            v_year_short := LPAD((p_year % 100)::TEXT, 2, '0');
            v_pattern := v_dept_code || v_year_short || '-%';
            
            -- Find the first gap in unit numbers, or next after max
            WITH all_nums AS (
                -- Existing units
                SELECT CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER) as num
                FROM units
                WHERE department_id = p_dept_id 
                  AND unit_code LIKE v_pattern
                UNION
                -- Reserved but not yet committed
                SELECT CAST(SPLIT_PART(code, '-', 2) AS INTEGER) as num
                FROM reserved_codes
                WHERE code_type = 'unit' 
                  AND department_id = p_dept_id
                  AND year = p_year 
                  AND expires_at > NOW()
            ),
            gaps AS (
                SELECT 1 as gap_num 
                WHERE NOT EXISTS (SELECT 1 FROM all_nums WHERE num = 1)
                UNION ALL
                SELECT num + 1 
                FROM all_nums n 
                WHERE NOT EXISTS (SELECT 1 FROM all_nums WHERE num = n.num + 1)
                  AND num < (SELECT COALESCE(MAX(num), 0) FROM all_nums)
                UNION ALL
                SELECT COALESCE(MAX(num), 0) + 1 FROM all_nums
            )
            SELECT MIN(gap_num) INTO v_next_num FROM gaps;
            
            RETURN COALESCE(v_next_num, 1);
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    op.execute("""
        CREATE OR REPLACE FUNCTION reserve_unit_code(p_dept_id INTEGER, p_year INTEGER, p_session_id TEXT DEFAULT NULL)
        RETURNS TEXT AS $$
        DECLARE
            v_next_num INTEGER;
            v_code TEXT;
            v_dept_code TEXT;
            v_year_short TEXT;
        BEGIN
            -- Get department code
            SELECT code INTO v_dept_code FROM departments WHERE id = p_dept_id;
            IF v_dept_code IS NULL THEN
                RETURN NULL;
            END IF;
            
            v_year_short := LPAD((p_year % 100)::TEXT, 2, '0');
            
            -- Get next available number
            v_next_num := get_next_unit_number(p_dept_id, p_year);
            v_code := v_dept_code || v_year_short || '-' || v_next_num;
            
            -- Reserve the code (expires in 5 minutes)
            INSERT INTO reserved_codes (code_type, code, year, department_id, reserved_at, expires_at, session_id)
            VALUES ('unit', v_code, p_year, p_dept_id, NOW(), NOW() + INTERVAL '5 minutes', p_session_id)
            ON CONFLICT (code) DO NOTHING;
            
            -- If insert failed due to conflict, recursively try next
            IF NOT FOUND THEN
                RETURN reserve_unit_code(p_dept_id, p_year, p_session_id);
            END IF;
            
            RETURN v_code;
        END;
        $$ LANGUAGE plpgsql;
    """)


def downgrade():
    op.execute("DROP FUNCTION IF EXISTS reserve_unit_code(INTEGER, INTEGER, TEXT)")
    op.execute("DROP FUNCTION IF EXISTS get_next_unit_number(INTEGER, INTEGER)")
    op.execute("DROP FUNCTION IF EXISTS cleanup_expired_reservations()")
    op.execute("DROP FUNCTION IF EXISTS confirm_sample_code(TEXT)")
    op.execute("DROP FUNCTION IF EXISTS reserve_sample_code(INTEGER, TEXT)")
    op.execute("DROP FUNCTION IF EXISTS get_next_sample_number(INTEGER)")
    op.drop_table('reserved_codes')
