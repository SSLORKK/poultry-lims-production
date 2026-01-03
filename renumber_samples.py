#!/usr/bin/env python3
"""
Script to renumber samples and units to remove gaps in numbering.

This script will:
1. Renumber all samples for a given year sequentially
2. Renumber all units for each department sequentially
3. Update edit history to track the changes

WARNING: This script modifies production data. Always backup before running!
"""

import sys
import os
from datetime import datetime

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.sample import Sample
from app.models.unit import Unit
from app.models.department import Department
from app.models.edit_history import EditHistory


def check_cross_department_conflicts(db, year):
    """
    Check for potential cross-department conflicts before renumbering.
    
    Args:
        db: Database session
        year: Year to check conflicts for
    
    Returns:
        List of potential conflicts found
    """
    print(f"\n{'='*60}")
    print(f"Checking for cross-department conflicts for year {year}")
    print(f"{'='*60}")
    
    conflicts = []
    
    # Get all existing unit codes for the year
    result = db.execute(text("""
        SELECT unit_code, department_id, d.code as dept_code
        FROM units u
        JOIN departments d ON u.department_id = d.id
        JOIN samples s ON u.sample_id = s.id
        WHERE s.year = :year
        ORDER BY unit_code
    """), {"year": year}).fetchall()
    
    existing_codes = {}
    for row in result:
        unit_code = row[0]
        dept_id = row[1]
        dept_code = row[2]
        
        if unit_code in existing_codes:
            conflicts.append({
                'type': 'DUPLICATE_UNIT_CODE',
                'code': unit_code,
                'dept1': existing_codes[unit_code],
                'dept2': dept_code
            })
        else:
            existing_codes[unit_code] = dept_code
    
    # Check for potential conflicts after renumbering
    departments = db.query(Department).all()
    year_short = str(year % 100).zfill(2)
    
    # Calculate what the new unit codes would be for each department
    new_codes = {}
    for dept in departments:
        units = db.query(Unit).filter(
            Unit.department_id == dept.id,
            Unit.sample.has(Sample.year == year)
        ).join(Sample).count()
        
        for i in range(1, units + 1):
            new_code = f"{dept.code}{year_short:02d}-{i}"
            
            if new_code in new_codes:
                conflicts.append({
                    'type': 'POTENTIAL_CONFLICT',
                    'code': new_code,
                    'dept1': new_codes[new_code],
                    'dept2': dept.code,
                    'note': 'Same unit code would be generated for different departments'
                })
            else:
                new_codes[new_code] = dept.code
    
    # Check if new codes would conflict with existing codes from other departments
    for new_code, dept_code in new_codes.items():
        for existing_code, existing_dept in existing_codes.items():
            if new_code == existing_code and dept_code != existing_dept:
                conflicts.append({
                    'type': 'CONFLICT_WITH_EXISTING',
                    'code': new_code,
                    'dept1': dept_code,
                    'dept2': existing_dept,
                    'note': 'New code would conflict with existing code from another department'
                })
    
    return conflicts


def renumber_samples(db, year, dry_run=True):
    """
    Renumber all samples for a given year sequentially.
    
    Args:
        db: Database session
        year: Year to renumber samples for
        dry_run: If True, only show what would be done without making changes
    """
    print(f"\n{'='*60}")
    print(f"{'DRY RUN' if dry_run else 'LIVE RUN'} - Renumbering samples for year {year}")
    print(f"{'='*60}")
    
    # Get all samples for the year, ordered by current sample code
    samples = db.query(Sample).filter(
        Sample.year == year,
        Sample.sample_code.like('SMP%')
    ).order_by(Sample.sample_code).all()
    
    if not samples:
        print(f"No samples found for year {year}")
        return
    
    print(f"Found {len(samples)} samples to renumber")
    
    year_short = str(year % 100).zfill(2)
    
    # Renumber samples sequentially
    for new_number, sample in enumerate(samples, start=1):
        old_sample_code = sample.sample_code
        new_sample_code = f"SMP{year_short:02d}-{new_number}"
        
        if old_sample_code == new_sample_code:
            print(f"  [{new_number}] {old_sample_code} - No change needed")
            continue
        
        print(f"  [{new_number}] {old_sample_code} -> {new_sample_code}")
        
        if not dry_run:
            # Record old values for edit history
            old_sample_code_val = sample.sample_code
            
            # Update sample code
            sample.sample_code = new_sample_code
            
            # Add edit history
            edit_history = EditHistory(
                sample_id=sample.id,
                unit_id=None,
                field_name="sample_code",
                old_value=old_sample_code_val,
                new_value=new_sample_code,
                changed_by="SYSTEM_RENUMBERING",
                changed_at=datetime.now()
            )
            db.add(edit_history)
    
    if not dry_run:
        db.commit()
        print(f"\n✓ Committed {len(samples)} sample renumberings")
    else:
        print(f"\n(Dry run - no changes committed)")


def renumber_units(db, year, dry_run=True):
    """
    Renumber all units for a given year and department sequentially.
    
    Args:
        db: Database session
        year: Year to renumber units for
        dry_run: If True, only show what would be done without making changes
    """
    print(f"\n{'='*60}")
    print(f"{'DRY RUN' if dry_run else 'LIVE RUN'} - Renumbering units for year {year}")
    print(f"{'='*60}")
    
    # Get all departments
    departments = db.query(Department).all()
    
    year_short = str(year % 100).zfill(2)
    total_units_renumbered = 0
    
    for dept in departments:
        # Get all units for this department and year, ordered by current unit code
        units = db.query(Unit).filter(
            Unit.department_id == dept.id,
            Unit.sample.has(Sample.year == year),
            Unit.unit_code.like(f'{dept.code}%')
        ).join(Sample).order_by(Unit.unit_code).all()
        
        if not units:
            continue
        
        print(f"\nDepartment: {dept.code} ({dept.name}) - {len(units)} units")
        
        # Renumber units sequentially
        for new_number, unit in enumerate(units, start=1):
            old_unit_code = unit.unit_code
            new_unit_code = f"{dept.code}{year_short:02d}-{new_number}"
            
            if old_unit_code == new_unit_code:
                print(f"  [{new_number}] {old_unit_code} - No change needed")
                continue
            
            print(f"  [{new_number}] {old_unit_code} -> {new_unit_code}")
            total_units_renumbered += 1
            
            if not dry_run:
                # Record old values for edit history
                old_unit_code_val = unit.unit_code
                
                # Update unit code
                unit.unit_code = new_unit_code
                
                # Add edit history
                edit_history = EditHistory(
                    sample_id=unit.sample_id,
                    unit_id=unit.id,
                    field_name="unit_code",
                    old_value=old_unit_code_val,
                    new_value=new_unit_code,
                    changed_by="SYSTEM_RENUMBERING",
                    changed_at=datetime.now()
                )
                db.add(edit_history)
    
    if not dry_run and total_units_renumbered > 0:
        db.commit()
        print(f"\n✓ Committed {total_units_renumbered} unit renumberings")
    else:
        print(f"\n(Dry run - no changes committed)")


def sync_counters(db, year):
    """
    Sync the counter tables with the actual highest sample/unit numbers.
    
    Args:
        db: Database session
        year: Year to sync counters for
    """
    print(f"\n{'='*60}")
    print(f"Syncing counters for year {year}")
    print(f"{'='*60}")
    
    # Get highest sample number
    result = db.execute(text("""
        SELECT MAX(CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER)) as max_num
        FROM samples
        WHERE year = :year AND sample_code LIKE 'SMP%'
    """), {"year": year}).fetchone()
    
    max_sample_num = result[0] if result and result[0] else 0
    print(f"Highest sample number: {max_sample_num}")
    
    # Update sample counter
    db.execute(text("""
        UPDATE counters
        SET current_value = :max_num
        WHERE counter_type = 'sample' AND year = :year
    """), {"max_num": max_sample_num, "year": year})
    
    # Get highest unit numbers per department
    departments = db.query(Department).all()
    year_short = str(year % 100).zfill(2)
    
    for dept in departments:
        result = db.execute(text("""
            SELECT MAX(
                CASE 
                    WHEN unit_code LIKE :pattern_new THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                    WHEN unit_code LIKE :pattern_old THEN CAST(SPLIT_PART(unit_code, '-', 3) AS INTEGER)
                    WHEN unit_code LIKE :pattern_oldest THEN CAST(SPLIT_PART(unit_code, '-', 2) AS INTEGER)
                    ELSE 0
                END
            ) as max_num
            FROM units
            WHERE department_id = :dept_id AND (
                unit_code LIKE :pattern_new OR unit_code LIKE :pattern_old OR unit_code LIKE :pattern_oldest
            )
        """), {
            "dept_id": dept.id,
            "pattern_new": f"{dept.code}{year_short}-%",
            "pattern_old": f"{dept.code}-%{year_short}-%",
            "pattern_oldest": f"{dept.code}-%"
        }).fetchone()
        
        max_unit_num = result[0] if result and result[0] else 0
        print(f"Department {dept.code}: Highest unit number: {max_unit_num}")
        
        db.execute(text("""
            UPDATE counters
            SET current_value = :max_num
            WHERE counter_type = 'unit' AND department_id = :dept_id AND year = :year
        """), {"max_num": max_unit_num, "dept_id": dept.id, "year": year})
    
    db.commit()
    print("\n✓ Counters synced")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Renumber samples and units to remove gaps in numbering"
    )
    parser.add_argument(
        "--year",
        type=int,
        required=True,
        help="Year to renumber (e.g., 2026)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Actually perform the renumbering (DANGEROUS!)"
    )
    parser.add_argument(
        "--sync-counters",
        action="store_true",
        help="Sync counter tables after renumbering"
    )
    
    args = parser.parse_args()
    
    # Safety check: require --live flag to make actual changes
    if not args.dry_run and not args.live:
        print("ERROR: You must specify either --dry-run or --live")
        print("Use --dry-run to see what would be done without making changes")
        print("Use --live to actually perform the renumbering")
        sys.exit(1)
    
    dry_run = args.dry_run
    
    if not dry_run:
        print("\n" + "="*60)
        print("WARNING: LIVE RUN - This will modify production data!")
        print("="*60)
        response = input("Type 'YES' to continue: ")
        if response != 'YES':
            print("Aborted")
            sys.exit(0)
    
    # Create database connection
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # Check for cross-department conflicts first
        conflicts = check_cross_department_conflicts(db, args.year)
        
        if conflicts:
            print(f"\n{'='*60}")
            print(f"⚠️  FOUND {len(conflicts)} CONFLICT(S)")
            print(f"{'='*60}\n")
            
            for i, conflict in enumerate(conflicts, 1):
                print(f"[{i}] {conflict['type']}: {conflict['code']}")
                print(f"    Department 1: {conflict['dept1']}")
                print(f"    Department 2: {conflict['dept2']}")
                if 'note' in conflict:
                    print(f"    Note: {conflict['note']}")
                print()
            
            if not dry_run:
                print("ERROR: Cannot proceed with renumbering due to conflicts!")
                print("Please resolve the conflicts before running the script.")
                sys.exit(1)
            else:
                print("WARNING: Conflicts detected. Review the conflicts above before proceeding.")
                response = input("Continue with dry run? (y/N): ")
                if response.lower() != 'y':
                    print("Aborted")
                    sys.exit(0)
        else:
            print("\n✓ No cross-department conflicts detected")
        
        # Renumber samples
        renumber_samples(db, args.year, dry_run=dry_run)
        
        # Renumber units
        renumber_units(db, args.year, dry_run=dry_run)
        
        # Sync counters if requested
        if args.sync_counters and not dry_run:
            sync_counters(db, args.year)
        
        print(f"\n{'='*60}")
        print(f"{'DRY RUN COMPLETED' if dry_run else 'RENUMBERING COMPLETED'}")
        print(f"{'='*60}")
        
    except Exception as e:
        print(f"\nERROR: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
