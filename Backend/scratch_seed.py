from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models.user import User
from auth_utils import get_password_hash

def seed_manual():
    db = SessionLocal()
    try:
        # Check if table exists (should be created by init_db already, but just in case)
        from models.user import Base
        Base.metadata.create_all(bind=engine)
        
        admin_user = db.query(User).filter(User.username == "admin").first()
        if admin_user:
            print(f"User 'admin' already exists. Updating password to 'password123' and resetting first login...")
            admin_user.password_hash = get_password_hash("password123")
            admin_user.is_first_login = True
            db.commit()
            print("Admin user reset successfully.")
        else:
            print("Creating 'admin' user...")
            new_user = User(
                username="admin",
                password_hash=get_password_hash("password123"),
                role="Admin",
                is_first_login=True
            )
            db.add(new_user)
            db.commit()
            print("'admin' user created successfully with password 'password123'.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_manual()
