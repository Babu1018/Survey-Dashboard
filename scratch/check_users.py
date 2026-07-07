import sqlite3
import os

db_path = os.path.join('Backend', 'survey.db')
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role FROM users;")
    rows = cursor.fetchall()
    for row in rows:
        print(row)
    conn.close()
