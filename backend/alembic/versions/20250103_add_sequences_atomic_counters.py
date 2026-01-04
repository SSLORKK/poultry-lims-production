"""Add database sequences for atomic counter operations

Revision ID: 20250103_sequences
Revises: 20250103_update_unit_codes_format
Create Date: 2025-01-03

This migration:
1. Creates PostgreSQL sequences for sample codes (per year)
2. Creates PostgreSQL sequences for unit codes (per department per year)
3. Adds unique indexes on sample_code and unit_code for constraint enforcement
4. Initializes sequences from current max values
"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '20250103_sequences'
down_revision = '20250103_update_unit_codes_format'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    current_year = datetime.now().year
    
    # Create sequences for current year and next year (for year transition)
    for year in [current_year - 1, current_year, current_year + 1]:
        year_short = year % 100
        
        # =====================================================================
        # SAMPLE CODE SEQUENCE
        # =====================================================================
        seq_name = f"sample_code_seq_{year}"
        
        # Get current max sample number for this year
        result = conn.execute(sa.text("""
            SELECT COALESCE(MAX(CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER)), 0)
            FROM samples 
            WHERE year = :year AND sample_code LIKE 'SMP%'
        """), {"year": year}).fetchone()
        
        start_value = (result[0] or 0) + 1
        
        # Create sequence if not exists
        conn.execute(sa.text(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = '{seq_name}') THEN
                    CREATE SEQUENCE {seq_name} START WITH {start_value} INCREMENT BY 1 NO MAXVALUE NO CYCLE;
                ELSE
                    -- Sequence exists, ensure it's at least at the current max
                    PERFORM setval('{seq_name}', GREATEST(nextval('{seq_name}') - 1, {start_value - 1}), true);
                END IF;
            END $$;
        """))
        
        print(f"  ✓ Created/updated sequence {seq_name} starting at {start_value}")
        
        # =====================================================================
        # UNIT CODE SEQUENCES (per department)
        # =====================================================================
        # Get all departments
        departments = conn.execute(sa.text("SELECT id, code FROM departments")).fetchall()
        
        for dept_id, dept_code in departments:
            unit_seq_name = f"unit_code_seq_{dept_code.lower()}_{year}"
            
            # Get current max unit number for this department and year
            # Handle multiple unit code formats
            result = conn.execute(sa.text("""
                SELECT COALESCE(MAX(
                    CASE 
                        WHEN unit_code LIKE :pattern_new THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                        WHEN unit_code LIKE :pattern_old THEN CAST(SPLIT_PART(unit_code, '-', 3) AS INTEGER)
                        WHEN unit_code LIKE :pattern_oldest THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                        ELSE 0
                    END
                ), 0)
                FROM units u
                JOIN samples s ON u.sample_id = s.id
                WHERE u.department_id = :dept_id AND s.year = :year
            """), {
                "dept_id": dept_id,
                "year": year,
                "pattern_new": f"{dept_code}{year_short:02d}-%",
                "pattern_old": f"{dept_code}-{year_short:02d}-%",
                "pattern_oldest": f"{dept_code}-%"
            }).fetchone()
            
            unit_start_value = (result[0] or 0) + 1
            
            # Create sequence if not exists
            conn.execute(sa.text(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = '{unit_seq_name}') THEN
                        CREATE SEQUENCE {unit_seq_name} START WITH {unit_start_value} INCREMENT BY 1 NO MAXVALUE NO CYCLE;
                    ELSE
                        PERFORM setval('{unit_seq_name}', GREATEST(nextval('{unit_seq_name}') - 1, {unit_start_value - 1}), true);
                    END IF;
                END $$;
            """))
            
            print(f"  ✓ Created/updated sequence {unit_seq_name} starting at {unit_start_value}")
    
    # =========================================================================
    # ADD UNIQUE INDEXES (if not exist) - Critical for constraint enforcement
    # =========================================================================
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_samples_sample_code_unique') THEN
                CREATE UNIQUE INDEX idx_samples_sample_code_unique ON samples(sample_code);
            END IF;
        END $$;
    """))
    print("  ✓ Ensured unique index on samples.sample_code")
    
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_units_unit_code_unique') THEN
                CREATE UNIQUE INDEX idx_units_unit_code_unique ON units(unit_code);
            END IF;
        END $$;
    """))
    print("  ✓ Ensured unique index on units.unit_code")
    
    # =========================================================================
    # ADD PERFORMANCE INDEXES for sample code number extraction
    # =========================================================================
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_samples_year_code') THEN
                CREATE INDEX idx_samples_year_code ON samples(year, sample_code);
            END IF;
        END $$;
    """))
    print("  ✓ Added performance index on samples(year, sample_code)")
    
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_units_dept_code') THEN
                CREATE INDEX idx_units_dept_code ON units(department_id, unit_code);
            END IF;
        END $$;
    """))
    print("  ✓ Added performance index on units(department_id, unit_code)")


def downgrade():
    conn = op.get_bind()
    current_year = datetime.now().year
    
    # Drop sequences
    for year in [current_year - 1, current_year, current_year + 1]:
        seq_name = f"sample_code_seq_{year}"
        conn.execute(sa.text(f"DROP SEQUENCE IF EXISTS {seq_name}"))
        
        # Get all departments
        departments = conn.execute(sa.text("SELECT code FROM departments")).fetchall()
        for (dept_code,) in departments:
            unit_seq_name = f"unit_code_seq_{dept_code.lower()}_{year}"
            conn.execute(sa.text(f"DROP SEQUENCE IF EXISTS {unit_seq_name}"))
    
    # Drop indexes (optional - keep for safety)
    # conn.execute(sa.text("DROP INDEX IF EXISTS idx_samples_sample_code_unique"))
    # conn.execute(sa.text("DROP INDEX IF EXISTS idx_units_unit_code_unique"))
