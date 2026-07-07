import requests
import json

base_url = "http://localhost:8000"

# First login to get token
login_data = {"username": "admin", "password": "adminpassword"}
response = requests.post(f"{base_url}/api/auth/login", data=login_data)
if response.status_code == 200:
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Try creating survey with new category
    survey_data = {
        "title": "Test New Category",
        "description": "testing",
        "category": "My Brand New Category"
    }
    
    res = requests.post(f"{base_url}/api/surveys/", headers=headers, json=survey_data)
    print("Create Survey Response:", res.status_code, res.text)
else:
    print("Login failed", response.text)
