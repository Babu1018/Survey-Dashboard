import requests
import json
import logging

logging.basicConfig(level=logging.INFO)

API_URL = "http://127.0.0.1:8000"

def test_update():
    login_data = {
        "username": "admin",
        "password": "password123"
    }
    resp = requests.post(f"{API_URL}/api/auth/login", json=login_data)
    if resp.status_code != 200:
        logging.error(f"Login failed: {resp.text}")
        return
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get surveys
    resp = requests.get(f"{API_URL}/api/surveys/", headers=headers)
    surveys = resp.json()
    if not surveys:
        logging.info("No surveys to test.")
        return
    survey_id = surveys[0]["id"]
    logging.info(f"Testing on survey {survey_id}")

    # 3. Test clearQuestions
    resp = requests.delete(f"{API_URL}/api/surveys/{survey_id}/questions", headers=headers)
    logging.info(f"Clear questions: {resp.status_code} {resp.text}")

    # 4. Test addQuestions
    q_data = [{
        "question_text": "Test Q",
        "question_type": "radio",
        "options": [
            {"option_text": "Opt 1", "next_question": None, "media_url": ""}
        ],
        "order": 0
    }]
    resp = requests.post(f"{API_URL}/api/surveys/{survey_id}/questions", json=q_data, headers=headers)
    logging.info(f"Add questions: {resp.status_code} {resp.text}")

if __name__ == "__main__":
    test_update()
