import requests
import json

BASE_URL = "http://localhost:8000"

# 1. Login
login_data = {"username": "admin", "password": "password123"}
res = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# 2. Create a dummy survey in a new category
cat_name = "To_Be_Deleted"
survey_data = {
    "title": "Temp Survey",
    "category": cat_name,
    "description": "test",
    "is_active": True
}
res = requests.post(f"{BASE_URL}/api/surveys/", headers=headers, json=survey_data)
survey_id = res.json()["id"]
print(f"Created survey {survey_id} in category '{cat_name}'")

# 3. Bulk delete by category
print(f"Attempting bulk delete for category '{cat_name}'...")
res = requests.post(f"{BASE_URL}/api/surveys/bulk-delete", headers=headers, json={"category": cat_name})
print(f"Response Status: {res.status_code}")
print(f"Response Body: {res.text}")

# 4. Verify
res = requests.get(f"{BASE_URL}/api/surveys/", headers=headers)
surveys = res.json()
exists = any(s["category"] == cat_name for s in surveys)
print(f"Category '{cat_name}' exists after deletion? {exists}")
