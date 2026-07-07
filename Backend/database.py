import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Use Postgres from .env
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    raise ValueError("DATABASE_URL not set in environment variables. PostgreSQL is required.")

engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    # This will create tables if they don't exist
    from models.survey import Base as SurveyBase
    from models.user import User
    from auth_utils import get_password_hash
    
    SurveyBase.metadata.create_all(bind=engine)
    
    # Seed ADMIN user if table is empty
    db = SessionLocal()
    try:
        admin_exists = db.query(User).filter(User.username == "admin").first()
        if not admin_exists:
            print("Seeding default admin user...")
            admin_user = User(
                username="admin",
                password_hash=get_password_hash("password123"),
                role="Admin",
                is_first_login=False
            )
            db.add(admin_user)
            db.commit()
            print("admin user created successfully.")
    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()
