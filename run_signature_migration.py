"""
Migration script to add signature_image column to signatures table.
Run this script from the project root directory.
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import text
from app.db.session import engine

def run_migration():
    """Add signature_image column to signatures table if it doesn't exist."""
    try:
        with engine.connect() as conn:
            # Check if column already exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'signatures' AND column_name = 'signature_image'
            """))
            
            if result.fetchone() is None:
                # Column doesn't exist, add it
                conn.execute(text("""
                    ALTER TABLE signatures 
                    ADD COLUMN signature_image TEXT
                """))
                conn.commit()
                print("✓ Successfully added 'signature_image' column to signatures table.")
            else:
                print("✓ Column 'signature_image' already exists in signatures table.")
                
    except Exception as e:
        print(f"Error running migration: {e}")
        # Try SQLite syntax if PostgreSQL fails
        try:
            with engine.connect() as conn:
                conn.execute(text("""
                    ALTER TABLE signatures 
                    ADD COLUMN signature_image TEXT
                """))
                conn.commit()
                print("✓ Successfully added 'signature_image' column to signatures table.")
        except Exception as e2:
            if "duplicate column" in str(e2).lower() or "already exists" in str(e2).lower():
                print("✓ Column 'signature_image' already exists in signatures table.")
            else:
                print(f"Migration failed: {e2}")
                return False
    
    return True

if __name__ == "__main__":
    print("Running signature_image migration...")
    success = run_migration()
    if success:
        print("\nMigration completed successfully!")
    else:
        print("\nMigration failed. Please check your database connection.")
