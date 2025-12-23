#!/usr/bin/env python3
"""
Simple script to run the culture_isolation_types migration
"""
import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from alembic.config import Config
    from alembic import command
    
    # Configure alembic
    config = Config("alembic.ini")
    
    # Run the migration
    print("Running migration to add culture_isolation_types table...")
    command.upgrade(config, "head")
    print("Migration completed successfully!")
    
except Exception as e:
    print(f"Error running migration: {e}")
    print("\nAlternative: You may need to run this manually:")
    print("1. Connect to your database directly")
    print("2. Run this SQL:")
    print("""
    CREATE TABLE culture_isolation_types (
        id INTEGER PRIMARY KEY,
        name VARCHAR UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE
    );
    """)
