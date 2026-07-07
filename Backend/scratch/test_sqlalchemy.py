import sys
sys.path.append('.')
from database import SessionLocal
from models.user import User  # IMPORT THIS!
from models.survey import Survey, Question, QuestionOption

def test_insert():
    db = SessionLocal()
    try:
        question = Question(
            survey_id=13,
            question_text="Test",
            question_type="radio",
            media_type="none",
            media_url="",
            required=True,
            order=0
        )
        db.add(question)
        db.flush()
        
        opt = {"option_text": "Opt 1", "next_question": None, "media_url": ""}
        option = QuestionOption(
            question_id=question.id,
            option_text=opt.get("option_text", ""),
            next_question=opt.get("next_question"),
            media_url=opt.get("media_url"),
            order=0
        )
        db.add(option)
        db.commit()
        print("Success")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_insert()
