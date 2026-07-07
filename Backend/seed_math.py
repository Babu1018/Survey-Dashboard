import requests
import json

base_url = "http://localhost:8000"

# First login to get token
login_data = {"username": "admin", "password": "password123"}
response = requests.post(f"{base_url}/api/auth/login", json=login_data)

if response.status_code == 200:
    token = response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # 1. Create the Survey
    survey_payload = {
        "title": "Mastering Multiplication",
        "description": "A comprehensive 20-question multiplication assessment with tiered logic and rich media.",
        "category": "Mathematics"
    }
    
    survey_res = requests.post(f"{base_url}/api/surveys/", headers=headers, json=survey_payload)
    if survey_res.status_code != 200:
        print("Failed to create survey", survey_res.text)
        exit()
        
    survey_id = survey_res.json().get("id")
    print(f"Created Survey ID: {survey_id}")
    
    # 2. Define 20 Questions
    # We'll use order 0 to 19.
    # Question Types: radio (for dropdown simulation), multiple_choice, checkbox, text, rating.
    # Tiered Logic: 
    # - If Q1 (2x2) is wrong, go to a "Remedial" question (Q3).
    # - If Q1 is right, go to Q2 (Level 2).
    
    questions = []
    
    # Q1: Intro (Image)
    questions.append({
        "question_text": "What is 2 x 2?",
        "question_type": "radio",
        "media_type": "image",
        "media_url": "https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?auto=format&fit=crop&q=80&w=1000",
        "required": True,
        "order": 0,
        "options": [
            {"option_text": "4", "order": 0, "next_question": 1}, # Correct -> Q2
            {"option_text": "5", "order": 1, "next_question": 2}, # Wrong -> Q3 (Remedial)
            {"option_text": "6", "order": 2, "next_question": 2}  # Wrong -> Q3 (Remedial)
        ]
    })
    
    # Q2: Level 2 (Video)
    questions.append({
        "question_text": "Watch this video and answer: What is 5 x 5?",
        "question_type": "select", # I'll add this type to frontend
        "media_type": "video",
        "media_url": "https://www.youtube.com/watch?v=VZ9mv6T3Wv8",
        "required": True,
        "order": 1,
        "options": [
            {"option_text": "25", "order": 0, "next_question": 3}, # -> Q4
            {"option_text": "30", "order": 1, "next_question": 3}
        ]
    })
    
    # Q3: Remedial (Audio)
    questions.append({
        "question_text": "Listen to the hint and try again: What is 2 + 2?",
        "question_type": "radio",
        "media_type": "audio",
        "media_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        "required": True,
        "order": 2,
        "options": [
            {"option_text": "4", "order": 0, "next_question": 1}, # -> Back to Q2
            {"option_text": "3", "order": 1, "next_question": 2}  # Stay in Remedial loop or go forward? Let's go to Q4
        ]
    })
    
    # Add more questions to reach 20
    for i in range(3, 20):
        questions.append({
            "question_text": f"What is {i} x {i}?",
            "question_type": "radio" if i % 2 == 0 else "select",
            "required": True,
            "order": i,
            "options": [
                {"option_text": str(i*i), "order": 0},
                {"option_text": str(i*i + 5), "order": 1},
                {"option_text": str(i*i - 5), "order": 2}
            ]
        })
        
    # 3. Add Questions to Survey
    q_res = requests.post(f"{base_url}/api/surveys/{survey_id}/questions", headers=headers, json=questions)
    if q_res.status_code == 200:
        print("20 Questions added successfully with tiered logic and media!")
    else:
        print("Failed to add questions", q_res.text)

else:
    print("Login failed", response.text)
