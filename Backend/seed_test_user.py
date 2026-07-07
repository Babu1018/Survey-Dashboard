from sqlalchemy.orm import Session
from database import SessionLocal
from models.user import User
from models.survey import Survey
from auth_utils import get_password_hash

def seed_test_user():
    db = SessionLocal()
    try:
        # 1. Create User
        username = "testuser"
        password = "password123"
        
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f"Creating user '{username}'...")
            user = User(
                username=username,
                password_hash=get_password_hash(password),
                role="User",
                is_first_login=False # Skip change password for testing
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"User '{username}' created.")
        else:
            print(f"User '{username}' already exists.")
            user.is_first_login = False
            db.commit()

        # 2. Assign Survey ID 34
        survey_id = 34
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        
        if survey:
            if survey not in user.assigned_surveys:
                print(f"Assigning survey '{survey.title}' to user '{username}'...")
                user.assigned_surveys.append(survey)
                db.commit()
                print("Survey assigned.")
            else:
                print(f"Survey '{survey.title}' already assigned to user '{username}'.")
        else:
            print(f"Survey ID {survey_id} not found.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_test_user()
