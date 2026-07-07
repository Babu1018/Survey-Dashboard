import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")
print(f"Connecting to: {db_url}")

try:
    engine = create_engine(db_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tables: {tables}")
    
    for table in tables:
        columns = inspector.get_columns(table)
        print(f"\nTable: {table}")
        for col in columns:
            print(f"  - {col['name']} ({col['type']})")
except Exception as e:
    print(f"Error: {e}")
