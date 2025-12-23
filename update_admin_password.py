"""
Update admin user password
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))

from backend.app.db.session import SessionLocal
from backend.app.models.user import User
from backend.app.core.security import get_password_hash


def update_admin_password():
    """Update the admin user's password"""
    db = SessionLocal()
    try:
        # Find the sslork user
        admin = db.query(User).filter(User.username == "sslork").first()
        
        if admin:
            print(f"Found user: {admin.username}")
            # Update password
            new_password = "sslork634827@@##"
            admin.hashed_password = get_password_hash(new_password)
            db.commit()
            print(f"✓ Password updated successfully for user: {admin.username}")
            print(f"  New password: {new_password}")
        else:
            print("✗ User 'sslork' not found!")
            print("Creating new admin user...")
            
            hashed_password = get_password_hash("sslork634827@@##")
            from backend.app.models.user import UserRole
            admin_user = User(
                username="sslork",
                email="sslork@lims.local",
                hashed_password=hashed_password,
                full_name="System Administrator",
                role=UserRole.admin
            )
            db.add(admin_user)
            db.commit()
            print("✓ Admin user created successfully")
            
    except Exception as e:
        print(f"✗ Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    update_admin_password()
