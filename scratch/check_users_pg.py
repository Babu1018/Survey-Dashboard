import sys
import os

# Add Backend directory to path
sys.path.append(os.path.join(os.getcwd(), 'Backend'))

from database import SessionLocal
from models.user import User

db = SessionLocal()
try:
    users = db.query(User).all()
    for user in users:
        print(f"ID: {user.id}, Username: {user.username}, Role: {user.role}")
finally:
    db.close()
