import requests
import json

BASE_URL = "http://localhost:8000/api"

def seed_data():
    surveys = [
        {
            "title": "Quantum Neural Network Latency",
            "description": "Analyzing inference delays in distributed QNN models.",
            "category": "AI",
            "is_active": True
        },
        {
            "title": "React 19 Server Components Feed",
            "description": "Developer experience with new server-side patterns.",
            "category": "Developer",
            "is_active": True
        },
        {
            "title": "K8s Cluster Edge Optimization",
            "description": "Monitoring resource allocation on edge nodes.",
            "category": "DevOps",
            "is_active": True
        }
    ]

    for survey in surveys:
        try:
            resp = requests.post(f"{BASE_URL}/surveys/", json=survey)
            if resp.status_code == 200:
                s = resp.json()
                print(f"Created: {s['title']}")
                # Add a dummy question
                q = [{
                    "question_text": "Is the system stable?",
                    "question_type": "boolean",
                    "required": True,
                    "options": []
                }]
                requests.post(f"{BASE_URL}/surveys/{s['id']}/questions", json=q)
        except Exception as e:
            print(f"Error seeding {survey['title']}: {e}")

if __name__ == "__main__":
    seed_data()
