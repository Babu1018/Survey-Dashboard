from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

# Association table for Survey <-> UserGroup
survey_assignments = Table(
    "survey_assignments",
    Base.metadata,
    Column("survey_id", Integer, ForeignKey("surveys.id"), primary_key=True),
    Column("group_id", Integer, ForeignKey("user_groups.id"), primary_key=True)
)

# Association table for User <-> UserGroup
user_group_membership = Table(
    "user_group_membership",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("group_id", Integer, ForeignKey("user_groups.id"), primary_key=True)
)

# Association table for Survey <-> User (Direct Assignment)
user_survey_assignments = Table(
    "user_survey_assignments",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("survey_id", Integer, ForeignKey("surveys.id"), primary_key=True)
)


class Survey(Base):
    __tablename__ = "surveys"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), index=True)
    description = Column(Text, nullable=True)
    category = Column(String(50), default="Developer")  # AI, Developer, DevOps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)

    questions = relationship("Question", back_populates="survey", cascade="all, delete-orphan")
    responses = relationship("Response", back_populates="survey", cascade="all, delete-orphan")
    assigned_groups = relationship("UserGroup", secondary=survey_assignments, back_populates="surveys")
    assigned_users = relationship("User", secondary=user_survey_assignments, back_populates="assigned_surveys")



class UserGroup(Base):
    __tablename__ = "user_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    surveys = relationship("Survey", secondary=survey_assignments, back_populates="assigned_groups")
    users = relationship("User", secondary=user_group_membership, back_populates="groups")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("surveys.id"), index=True)
    question_text = Column(String(500))
    question_type = Column(String(50))  # text, multiple_choice, rating, boolean, checkbox, radio
    media_type = Column(String(20), default="none")  # none, image, video, audio
    media_url = Column(String(1000), nullable=True)
    required = Column(Boolean, default=True)
    order = Column(Integer)
    rating_max = Column(Integer, default=5)
    low_label = Column(String(100), nullable=True)
    high_label = Column(String(100), nullable=True)
    scale = Column(String(100), nullable=True)  # Depression, Anxiety, etc.
    score_threshold = Column(Integer, nullable=True)
    threshold_next_question = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    survey = relationship("Survey", back_populates="questions")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")


class QuestionOption(Base):
    __tablename__ = "question_options"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), index=True)
    option_text = Column(String(255))
    order = Column(Integer)
    next_question = Column(Integer, nullable=True)
    score = Column(Integer, default=0)
    is_red_flag = Column(Boolean, default=False)
    media_url = Column(String(1000), nullable=True)

    question = relationship("Question", back_populates="options")


class Response(Base):
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("surveys.id"), index=True)
    respondent_email = Column(String(255), nullable=True)
    completed_at = Column(DateTime, server_default=func.now())
    is_completed = Column(Boolean, default=False)
    status = Column(String(50), default="Pending")  # Pending, Reviewed, Intervention Triggered, Resolved

    survey = relationship("Survey", back_populates="responses")
    answers = relationship("Answer", back_populates="response", cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    response_id = Column(Integer, ForeignKey("responses.id"), index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), index=True)
    answer_text = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    response = relationship("Response", back_populates="answers")
    question = relationship("Question", back_populates="answers")
