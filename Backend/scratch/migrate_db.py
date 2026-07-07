import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def migrate():
    with engine.connect() as conn:
        try:
            conn.execute(text('ALTER TABLE question_options ADD COLUMN next_question INTEGER;'))
            print("Added next_question column")
        except Exception as e:
            print(f"Error adding next_question: {e}")
            
        try:
            conn.execute(text('ALTER TABLE question_options ADD COLUMN media_url VARCHAR(1000);'))
            print("Added media_url column")
        except Exception as e:
            print(f"Error adding media_url: {e}")
            
        conn.commit()

if __name__ == "__main__":
    migrate()
