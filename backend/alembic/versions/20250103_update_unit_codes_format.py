"""Update unit codes to include year for cross-year conflict prevention

Revision ID: 20250103_unit_codes
Revises: 20250103_pcr_kit
Create Date: 2025-01-03

This migration updates existing unit codes from format {DEPT}-{number} 
to format {DEPT}-{YY}-{number} to prevent cross-year conflicts.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = '20250103_unit_codes'
down_revision = '20250103_pcr_kit'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    
    # Get all units with their sample years
    query = text("""
        SELECT u.id, u.unit_code, s.year 
        FROM units u
        JOIN samples s ON u.sample_id = s.id
        WHERE u.unit_code NOT LIKE '%-%-%'
    """)
    
    result = conn.execute(query)
    units_to_update = result.fetchall()
    
    for unit_id, old_code, year in units_to_update:
        try:
            # Parse old code: {DEPT}-{number}
            parts = old_code.split('-')
            if len(parts) == 2:
                dept_code = parts[0]
                number = parts[1]
                
                # Create new code: {DEPT}-{YY}-{number}
                year_short = year % 100
                new_code = f"{dept_code}-{year_short:02d}-{number}"
                
                # Update the unit code
                update_query = text("""
                    UPDATE units 
                    SET unit_code = :new_code 
                    WHERE id = :unit_id
                """)
                conn.execute(update_query, {"new_code": new_code, "unit_id": unit_id})
                
                print(f"Updated unit {unit_id}: {old_code} -> {new_code}")
        except Exception as e:
            print(f"Error updating unit {unit_id} with code {old_code}: {e}")
    
    conn.commit()


def downgrade() -> None:
    conn = op.get_bind()
    
    # Revert unit codes from {DEPT}-{YY}-{number} back to {DEPT}-{number}
    query = text("""
        SELECT id, unit_code 
        FROM units 
        WHERE unit_code LIKE '%-%-%'
    """)
    
    result = conn.execute(query)
    units_to_revert = result.fetchall()
    
    for unit_id, old_code in units_to_revert:
        try:
            # Parse old code: {DEPT}-{YY}-{number}
            parts = old_code.split('-')
            if len(parts) == 3:
                dept_code = parts[0]
                number = parts[2]
                
                # Create new code: {DEPT}-{number}
                new_code = f"{dept_code}-{number}"
                
                # Update the unit code
                update_query = text("""
                    UPDATE units 
                    SET unit_code = :new_code 
                    WHERE id = :unit_id
                """)
                conn.execute(update_query, {"new_code": new_code, "unit_id": unit_id})
                
                print(f"Reverted unit {unit_id}: {old_code} -> {new_code}")
        except Exception as e:
            print(f"Error reverting unit {unit_id} with code {old_code}: {e}")
    
    conn.commit()
