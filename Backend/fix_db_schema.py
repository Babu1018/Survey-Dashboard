import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not set")
    exit(1)

engine = create_engine(DATABASE_URL)

def check_and_add_columns():
    with engine.connect() as conn:
        # Check questions table
        print("Checking 'questions' table...")
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='questions'"))
        columns = [row[0] for row in res]
        print(f"Current columns in 'questions': {columns}")

        needed_questions = [
            ("scale", "VARCHAR(100)"),
            ("score_threshold", "INTEGER"),
            ("threshold_next_question", "INTEGER"),
            ("rating_max", "INTEGER DEFAULT 5"),
            ("low_label", "VARCHAR(100)"),
            ("high_label", "VARCHAR(100)")
        ]

        for col, col_type in needed_questions:
            if col not in columns:
                print(f"Adding column '{col}' to 'questions'...")
                conn.execute(text(f"ALTER TABLE questions ADD COLUMN {col} {col_type}"))
                conn.commit()
                print(f"Column '{col}' added.")

        # Check question_options table
        print("\nChecking 'question_options' table...")
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='question_options'"))
        columns = [row[0] for row in res]
        print(f"Current columns in 'question_options': {columns}")

        needed_options = [
            ("next_question", "INTEGER"),
            ("score", "INTEGER DEFAULT 0"),
            ("is_red_flag", "BOOLEAN DEFAULT FALSE"),
            ("media_url", "VARCHAR(1000)")
        ]

        for col, col_type in needed_options:
            if col not in columns:
                print(f"Adding column '{col}' to 'question_options'...")
                conn.execute(text(f"ALTER TABLE question_options ADD COLUMN {col} {col_type}"))
                conn.commit()
                print(f"Column '{col}' added.")

        # Check responses table
        print("\nChecking 'responses' table...")
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='responses'"))
        columns = [row[0] for row in res]
        print(f"Current columns in 'responses': {columns}")

        if 'status' not in columns:
            print("Adding column 'status' to 'responses'...")
            conn.execute(text("ALTER TABLE responses ADD COLUMN status VARCHAR(50) DEFAULT 'Pending'"))
            conn.commit()
            print("Column 'status' added.")

if __name__ == "__main__":
    check_and_add_columns()
    print("\nDatabase schema check and update complete.")
