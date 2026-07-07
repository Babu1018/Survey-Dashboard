import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def fix_foreign_keys():
    with engine.connect() as conn:
        print("Fixing foreign keys for survey_assignments...")
        # Get constraint name for survey_id in survey_assignments
        res = conn.execute(text("""
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'survey_assignments'::regclass 
            AND confrelid = 'surveys'::regclass;
        """))
        for row in res:
            conname = row[0]
            print(f"Dropping and recreating constraint {conname} with CASCADE...")
            conn.execute(text(f"ALTER TABLE survey_assignments DROP CONSTRAINT {conname}"))
            conn.execute(text(f"ALTER TABLE survey_assignments ADD CONSTRAINT {conname} FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE"))
            conn.commit()

        print("\nFixing foreign keys for user_survey_assignments...")
        res = conn.execute(text("""
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'user_survey_assignments'::regclass 
            AND confrelid = 'surveys'::regclass;
        """))
        for row in res:
            conname = row[0]
            print(f"Dropping and recreating constraint {conname} with CASCADE...")
            conn.execute(text(f"ALTER TABLE user_survey_assignments DROP CONSTRAINT {conname}"))
            conn.execute(text(f"ALTER TABLE user_survey_assignments ADD CONSTRAINT {conname} FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE"))
            conn.commit()
            
        print("\nFixing foreign keys for questions (survey_id)...")
        res = conn.execute(text("""
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'questions'::regclass 
            AND confrelid = 'surveys'::regclass;
        """))
        for row in res:
            conname = row[0]
            print(f"Dropping and recreating constraint {conname} with CASCADE...")
            conn.execute(text(f"ALTER TABLE questions DROP CONSTRAINT {conname}"))
            conn.execute(text(f"ALTER TABLE questions ADD CONSTRAINT {conname} FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE"))
            conn.commit()

        print("\nFixing foreign keys for responses (survey_id)...")
        res = conn.execute(text("""
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'responses'::regclass 
            AND confrelid = 'surveys'::regclass;
        """))
        for row in res:
            conname = row[0]
            print(f"Dropping and recreating constraint {conname} with CASCADE...")
            conn.execute(text(f"ALTER TABLE responses DROP CONSTRAINT {conname}"))
            conn.execute(text(f"ALTER TABLE responses ADD CONSTRAINT {conname} FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE"))
            conn.commit()

if __name__ == "__main__":
    fix_foreign_keys()
    print("\nForeign key fixes complete.")
