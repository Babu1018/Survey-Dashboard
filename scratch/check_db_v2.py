import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Explicitly load .env from the Backend directory
env_path = os.path.join(os.path.dirname(__file__), "..", "Backend", ".env")
load_dotenv(env_path)

db_url = os.getenv("DATABASE_URL")
print(f"Connecting to: {db_url}")

if not db_url:
    print("Error: DATABASE_URL not found in .env")
    exit(1)

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("Connected successfully!")
        
        # Check tables
        res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        tables = [row[0] for row in res]
        print(f"Tables index: {tables}")
        
        for table in tables:
            print(f"\nScanning table: {table}")
            try:
                # Get column info
                res = conn.execute(text(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'"))
                for col in res:
                    print(f"  - {col[0]} ({col[1]})")
                
                # Try to select one row
                res = conn.execute(text(f"SELECT * FROM \"{table}\" LIMIT 1"))
                row = res.fetchone()
                print(f"  Sample row: {row}")
            except Exception as e:
                print(f"  Error reading table {table}: {e}")

except Exception as e:
    print(f"Connection Error: {e}")
