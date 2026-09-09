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
    from models.notification import Notification  # noqa: F401 — registers the table
    from auth_utils import get_password_hash
    
    SurveyBase.metadata.create_all(bind=engine)
    
    # Seed ADMIN user if table is empty
    db = SessionLocal()
    try:
        from sqlalchemy import text
        # Perform dynamic schema migration for tier and parent_question_key
        try:
            db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1;"))
            db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS parent_question_key VARCHAR(100);"))
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;"))
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code_hash VARCHAR(255);"))
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;"))
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20) UNIQUE;"))
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain VARCHAR(255);"))
            db.execute(text("ALTER TABLE responses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;"))
            db.execute(text("ALTER TABLE responses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;"))
            db.execute(text("ALTER TABLE question_options ADD COLUMN IF NOT EXISTS media_type VARCHAR(20);"))
            db.execute(text("ALTER TABLE question_options ADD COLUMN IF NOT EXISTS emoji VARCHAR(16);"))
            db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS backward_question INTEGER;"))
            db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS score_rules TEXT;"))
            db.execute(text("ALTER TABLE responses ADD COLUMN IF NOT EXISTS user_id INTEGER;"))
            db.execute(text("ALTER TABLE user_groups ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id);"))
            db.execute(text("ALTER TABLE responses ADD COLUMN IF NOT EXISTS manager_comment TEXT;"))
            db.execute(text("ALTER TABLE responses ADD COLUMN IF NOT EXISTS reviewed_by_username VARCHAR(150);"))
            db.execute(text("ALTER TABLE responses ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;"))
            db.execute(text("ALTER TABLE answers ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending';"))
            db.execute(text("ALTER TABLE answers ADD COLUMN IF NOT EXISTS review_note TEXT;"))
            db.execute(text("ALTER TABLE answers ADD COLUMN IF NOT EXISTS reviewed_by_username VARCHAR(150);"))
            db.execute(text("ALTER TABLE answers ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;"))
            db.execute(text("ALTER TABLE user_survey_assignments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP DEFAULT NOW();"))
            db.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP;"))
            db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS media_items TEXT;"))
            db.execute(text("ALTER TABLE question_options ADD COLUMN IF NOT EXISTS media_items TEXT;"))
            # Rating styles, media-upload answers and matrix/grid questions.
            db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS rating_style VARCHAR(20) DEFAULT 'number';"))
            db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS rating_labels TEXT;"))
            db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS allowed_file_types VARCHAR(255);"))
            db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS max_file_size_mb INTEGER DEFAULT 10;"))
            db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS matrix_rows TEXT;"))
            db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS matrix_columns TEXT;"))
            db.execute(text("ALTER TABLE questions ADD COLUMN IF NOT EXISTS matrix_multi BOOLEAN DEFAULT FALSE;"))
            db.commit()
            print("Database migration check completed: tier and parent_question_key verified.")
        except Exception as migration_error:
            db.rollback()
            print(f"Migration error: {migration_error}")

        admin_exists = db.query(User).filter(User.username == "admin").first()
        if not admin_exists:
            print("Seeding default admin user...")
            admin_user = User(
                username="admin",
                password_hash=get_password_hash("password123"),
                password_plain="password123",
                role="Admin",
                is_first_login=False
            )
            db.add(admin_user)
            db.commit()
            print("admin user created successfully.")

        # Update existing users who don't have password_plain set
        from sqlalchemy import or_
        users_without_plain = db.query(User).filter(or_(User.password_plain == None, User.password_plain == "")).all()
        for u in users_without_plain:
            u.password_plain = "password123"
            u.password_hash = get_password_hash("password123")
        if users_without_plain:
            db.commit()
            print(f"Populated plain password for {len(users_without_plain)} users.")

    except Exception as e:
        print(f"Error seeding database: {e}")
    finally:
        db.close()
