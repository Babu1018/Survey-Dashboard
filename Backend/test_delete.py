import requests
import json

# Try to find an existing survey to delete
BASE_URL = "http://localhost:8000"

# 1. Login to get token
login_data = {"username": "admin", "password": "password123"}
res = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
if res.status_code != 200:
    print(f"Login failed: {res.text}")
    exit(1)

token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Get surveys
res = requests.get(f"{BASE_URL}/api/surveys/", headers=headers)
surveys = res.json()
if not surveys:
    print("No surveys found to delete")
else:
    # Try to delete the first one or one with "Verification" in title
    target = surveys[0]
    for s in surveys:
        if "Verification" in s["title"]:
            target = s
            break
            
    print(f"Attempting to delete survey ID {target['id']} ('{target['title']}')...")
    res = requests.delete(f"{BASE_URL}/api/surveys/{target['id']}", headers=headers)
    print(f"Response Status: {res.status_code}")
    print(f"Response Body: {res.text}")
