"""
Run Sequence Migration
======================
Applies the database sequences for atomic counter operations.

Usage:
    python run_sequence_migration.py

This script:
1. Creates PostgreSQL sequences for sample and unit codes
2. Initializes sequences from current max values
3. Adds unique indexes for constraint enforcement
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime
from sqlalchemy import text
from app.db.session import SessionLocal, engine


def run_migration():
    """Run the sequence migration manually"""
    print("\n" + "=" * 70)
    print("    POULTRY LIMS - SEQUENCE MIGRATION")
    print("    Creating Atomic Counter Sequences")
    print("=" * 70)
    print(f"\nStarted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    conn = engine.connect()
    trans = conn.begin()
    
    try:
        current_year = datetime.now().year
        
        # Create sequences for current year, previous year, and next year
        for year in [current_year - 1, current_year, current_year + 1]:
            year_short = year % 100
            
            # =====================================================================
            # SAMPLE CODE SEQUENCE
            # =====================================================================
            seq_name = f"sample_code_seq_{year}"
            
            # Get current max sample number for this year
            result = conn.execute(text("""
                SELECT COALESCE(MAX(CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER)), 0)
                FROM samples 
                WHERE year = :year AND sample_code LIKE 'SMP%'
            """), {"year": year}).fetchone()
            
            start_value = (result[0] or 0) + 1
            
            # Drop and recreate sequence to ensure correct value
            conn.execute(text(f"DROP SEQUENCE IF EXISTS {seq_name}"))
            conn.execute(text(f"""
                CREATE SEQUENCE {seq_name} 
                START WITH {start_value} 
                INCREMENT BY 1 
                NO MAXVALUE 
                NO CYCLE
            """))
            
            print(f"  ✓ Created sequence {seq_name} starting at {start_value}")
            
            # =====================================================================
            # UNIT CODE SEQUENCES (per department)
            # =====================================================================
            departments = conn.execute(text("SELECT id, code FROM departments")).fetchall()
            
            for dept_id, dept_code in departments:
                unit_seq_name = f"unit_code_seq_{dept_code.lower()}_{year}"
                
                # Get current max unit number for this department and year
                result = conn.execute(text("""
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
                
                # Drop and recreate sequence
                conn.execute(text(f"DROP SEQUENCE IF EXISTS {unit_seq_name}"))
                conn.execute(text(f"""
                    CREATE SEQUENCE {unit_seq_name} 
                    START WITH {unit_start_value} 
                    INCREMENT BY 1 
                    NO MAXVALUE 
                    NO CYCLE
                """))
                
                print(f"  ✓ Created sequence {unit_seq_name} starting at {unit_start_value}")
        
        # =========================================================================
        # ADD UNIQUE INDEXES
        # =========================================================================
        print("\n[Creating Unique Indexes]")
        
        # Check if unique index exists on samples.sample_code
        result = conn.execute(text("""
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_samples_sample_code_unique'
        """)).fetchone()
        
        if not result:
            conn.execute(text("""
                CREATE UNIQUE INDEX idx_samples_sample_code_unique ON samples(sample_code)
            """))
            print("  ✓ Created unique index on samples.sample_code")
        else:
            print("  ✓ Unique index on samples.sample_code already exists")
        
        # Check if unique index exists on units.unit_code
        result = conn.execute(text("""
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_units_unit_code_unique'
        """)).fetchone()
        
        if not result:
            conn.execute(text("""
                CREATE UNIQUE INDEX idx_units_unit_code_unique ON units(unit_code)
            """))
            print("  ✓ Created unique index on units.unit_code")
        else:
            print("  ✓ Unique index on units.unit_code already exists")
        
        # =========================================================================
        # ADD PERFORMANCE INDEXES
        # =========================================================================
        print("\n[Creating Performance Indexes]")
        
        result = conn.execute(text("""
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_samples_year_code'
        """)).fetchone()
        
        if not result:
            conn.execute(text("""
                CREATE INDEX idx_samples_year_code ON samples(year, sample_code)
            """))
            print("  ✓ Created index on samples(year, sample_code)")
        else:
            print("  ✓ Index on samples(year, sample_code) already exists")
        
        result = conn.execute(text("""
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_units_dept_code'
        """)).fetchone()
        
        if not result:
            conn.execute(text("""
                CREATE INDEX idx_units_dept_code ON units(department_id, unit_code)
            """))
            print("  ✓ Created index on units(department_id, unit_code)")
        else:
            print("  ✓ Index on units(department_id, unit_code) already exists")
        
        trans.commit()
        
        print("\n" + "=" * 70)
        print("✓ MIGRATION COMPLETED SUCCESSFULLY")
        print("=" * 70)
        print("\nThe counter system now uses PostgreSQL sequences for atomic operations.")
        print("Benefits:")
        print("  - Zero race conditions (NEXTVAL is atomic)")
        print("  - O(1) time complexity (no table scans)")
        print("  - Works across multiple processes/workers")
        print("  - Unique indexes enforce constraints at database level")
        
    except Exception as e:
        trans.rollback()
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        conn.close()
    
    print(f"\nFinished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")


def verify_sequences():
    """Verify that sequences are working correctly"""
    print("\n[Verifying Sequences]")
    
    db = SessionLocal()
    try:
        current_year = datetime.now().year
        
        # Test sample sequence
        seq_name = f"sample_code_seq_{current_year}"
        result = db.execute(text(f"SELECT last_value FROM {seq_name}")).fetchone()
        print(f"  Sample sequence ({seq_name}): current value = {result[0]}")
        
        # Test getting next value (this will increment!)
        # result = db.execute(text(f"SELECT nextval('{seq_name}')")).fetchone()
        # print(f"  Next sample number would be: {result[0]}")
        
        # Test unit sequences
        departments = db.execute(text("SELECT code FROM departments")).fetchall()
        for (dept_code,) in departments:
            unit_seq_name = f"unit_code_seq_{dept_code.lower()}_{current_year}"
            try:
                result = db.execute(text(f"SELECT last_value FROM {unit_seq_name}")).fetchone()
                print(f"  Unit sequence ({unit_seq_name}): current value = {result[0]}")
            except Exception as e:
                print(f"  Unit sequence ({unit_seq_name}): not found or error - {e}")
        
        print("\n✓ Sequence verification completed")
        
    except Exception as e:
        print(f"\n✗ Verification failed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Run sequence migration for atomic counters')
    parser.add_argument('--verify-only', action='store_true', help='Only verify existing sequences')
    
    args = parser.parse_args()
    
    if args.verify_only:
        verify_sequences()
    else:
        run_migration()
        verify_sequences()
