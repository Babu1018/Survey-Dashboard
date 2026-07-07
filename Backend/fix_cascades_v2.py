import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

def fix_all_foreign_keys():
    targets = [
        ('survey_assignments', 'surveys', 'survey_id'),
        ('user_survey_assignments', 'surveys', 'survey_id'),
        ('questions', 'surveys', 'survey_id'),
        ('responses', 'surveys', 'survey_id'),
        ('question_options', 'questions', 'question_id'),
        ('answers', 'responses', 'response_id'),
        ('answers', 'questions', 'question_id'),
        ('survey_assignments', 'user_groups', 'group_id'),
        ('user_group_membership', 'user_groups', 'group_id'),
        ('user_group_membership', 'users', 'user_id')
    ]

    with engine.connect() as conn:
        for table, ref_table, col in targets:
            print(f"Fixing foreign key {table}({col}) -> {ref_table}(id)...")
            res = conn.execute(text(f"""
                SELECT conname 
                FROM pg_constraint 
                WHERE conrelid = '{table}'::regclass 
                AND confrelid = '{ref_table}'::regclass;
            """))
            for row in res:
                conname = row[0]
                print(f"  Dropping and recreating constraint {conname} with CASCADE...")
                conn.execute(text(f"ALTER TABLE {table} DROP CONSTRAINT {conname}"))
                conn.execute(text(f"ALTER TABLE {table} ADD CONSTRAINT {conname} FOREIGN KEY ({col}) REFERENCES {ref_table}(id) ON DELETE CASCADE"))
                conn.commit()
            print("  Done.")

if __name__ == "__main__":
    fix_all_foreign_keys()
    print("\nAll foreign key fixes complete.")
