import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def migrate():
    with engine.connect() as conn:
        print("Starting migration...")
        try:
            conn.execute(text('ALTER TABLE questions ADD COLUMN rating_max INTEGER DEFAULT 5;'))
            print("Added rating_max column")
        except Exception as e:
            print(f"Error adding rating_max: {e}")
            
        try:
            conn.execute(text('ALTER TABLE questions ADD COLUMN low_label VARCHAR(100);'))
            print("Added low_label column")
        except Exception as e:
            print(f"Error adding low_label: {e}")

        try:
            conn.execute(text('ALTER TABLE questions ADD COLUMN high_label VARCHAR(100);'))
            print("Added high_label column")
        except Exception as e:
            print(f"Error adding high_label: {e}")
            
        conn.commit()
        print("Migration completed.")

if __name__ == "__main__":
    migrate()
