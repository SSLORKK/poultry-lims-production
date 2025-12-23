"""
Database initialization script to create tables and add default admin user
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash

def init_database():
    """Create all tables and add default admin user"""
    print("Creating database tables...")
    
    # Import all models to register them with Base
    from app.models import (
        user, department, unit, sample, counter, 
        dropdown_data, pcr_data, serology_data, 
        microbiology_data
    )
    from app.models import pcr_coa as pcr_coa_model
    from app.models import microbiology_coa as microbiology_coa_model
    from app.models.department import Department
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created successfully")
    
    # Create default admin user and departments
    db = SessionLocal()
    try:
        # Check if admin user already exists
        existing_admin = db.query(User).filter(User.username == "sslork").first()
        if existing_admin:
            print("✓ Admin user already exists")
        else:
            # Create admin user
            hashed_password = get_password_hash("sslork634827@@##")
            admin_user = User(
                username="sslork",
                hashed_password=hashed_password,
                full_name="System Administrator",
                role=UserRole.admin
            )
            db.add(admin_user)
            db.commit()
            print("✓ Admin user created successfully")
            print("\n" + "="*50)
            print("Default Admin Credentials:")
            print("  Username: sslork")
            print("  Password: sslork634827@@##")
            print("  Role: admin")
            print("="*50 + "\n")
            print("⚠️  IMPORTANT: Please change the admin password after first login!")
        
        # Create default departments
        default_departments = [
            {"name": "PCR", "code": "PCR"},
            {"name": "Serology", "code": "SER"},
            {"name": "Microbiology", "code": "MIC"}
        ]
        
        for dept_data in default_departments:
            existing_dept = db.query(Department).filter(Department.code == dept_data["code"]).first()
            if not existing_dept:
                new_dept = Department(name=dept_data["name"], code=dept_data["code"])
                db.add(new_dept)
                print(f"✓ Created department: {dept_data['name']} ({dept_data['code']})")
            else:
                print(f"✓ Department already exists: {dept_data['name']} ({dept_data['code']})")
        
        db.commit()
        print("✓ Default departments initialized")
        
    except Exception as e:
        print(f"✗ Error during initialization: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_database()
