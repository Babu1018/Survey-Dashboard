from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey, Table
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
    Column("survey_id", Integer, ForeignKey("surveys.id"), primary_key=True),
    # When the assignment was made. The survey validity window is measured
    # from here, so the Admin can be told when one lapses uncompleted.
    Column("assigned_at", DateTime, server_default=func.now())
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
    # The Manager responsible for reviewing/approving this group's submissions.
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    surveys = relationship("Survey", secondary=survey_assignments, back_populates="assigned_groups")
    users = relationship("User", secondary=user_group_membership, back_populates="groups")
    manager = relationship("User", foreign_keys=[manager_id], back_populates="managed_groups")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("surveys.id"), index=True)
    question_text = Column(String(500))
    question_type = Column(String(50))  # text, multiple_choice, rating, boolean, checkbox, radio
    media_type = Column(String(20), default="none")  # none, image, video, audio
    media_url = Column(String(1000), nullable=True)
    # Multiple attachments (image/audio), as JSON: [{"url": ..., "type": "image"|"audio"}, ...].
    # media_type/media_url above still mirror the first item, so any reader
    # that only knows the single-media pair keeps working unchanged.
    media_items = Column(Text, nullable=True)
    required = Column(Boolean, default=True)
    order = Column(Integer)
    rating_max = Column(Integer, default=5)
    low_label = Column(String(100), nullable=True)
    high_label = Column(String(100), nullable=True)
    # How a 'rating' question is drawn: number | star | emoji | bar | word.
    # The stored answer is always the 1-based position on the scale whatever
    # the style, so scoring and reporting stay comparable across styles.
    rating_style = Column(String(20), default="number")
    # Word-scale captions as a JSON array, e.g. ["Very Bad", ..., "Very Good"].
    # Its length defines the scale when rating_style is 'word'.
    rating_labels = Column(Text, nullable=True)
    # 'file_upload' questions: comma-separated families the respondent may
    # attach (image, document, video, audio) and the per-file size ceiling.
    allowed_file_types = Column(String(255), nullable=True)
    max_file_size_mb = Column(Integer, default=10)
    # 'matrix' questions: JSON arrays of the row statements and the shared
    # column choices, plus whether each row takes many answers (checkbox
    # grid) rather than one (radio grid).
    matrix_rows = Column(Text, nullable=True)
    matrix_columns = Column(Text, nullable=True)
    matrix_multi = Column(Boolean, default=False)
    scale = Column(String(100), nullable=True)  # Depression, Anxiety, etc.
    score_threshold = Column(Integer, nullable=True)
    # Score-Based Routing rules as JSON: [{"min": <points>, "target": <0-based
    # question index, or -1 for end of survey>}, ...]. Each rule means "score
    # is at least min"; the highest matching min wins. When absent,
    # score_threshold + threshold_next_question below are read as a single
    # legacy rule, so surveys authored before multiple rules existed still work.
    score_rules = Column(Text, nullable=True)
    threshold_next_question = Column(Integer, nullable=True)
    backward_question = Column(Integer, nullable=True)
    tier = Column(Integer, default=1)
    parent_question_key = Column(String(100), nullable=True)
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
    media_type = Column(String(20), nullable=True)  # image, audio
    media_items = Column(Text, nullable=True)  # JSON: [{"url": ..., "type": "image"|"audio"}, ...]
    emoji = Column(String(16), nullable=True)

    question = relationship("Question", back_populates="options")


class Response(Base):
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey("surveys.id"), index=True)
    respondent_email = Column(String(255), nullable=True)
    # Loose reference (no FK) — mirrors LoginLog.user_id in models/user.py, so
    # a submission's history survives the submitting account being deleted.
    user_id = Column(Integer, nullable=True, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    completed_at = Column(DateTime, server_default=func.now())
    is_completed = Column(Boolean, default=False)
    status = Column(String(50), default="Pending")  # Pending, Reviewed, Intervention Triggered, Resolved
    manager_comment = Column(Text, nullable=True)
    # Snapshot (not a FK) — mirrors respondent_email, so the review trail
    # survives the reviewing account being deleted later.
    reviewed_by_username = Column(String(150), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    survey = relationship("Survey", back_populates="responses")
    answers = relationship("Answer", back_populates="response", cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    response_id = Column(Integer, ForeignKey("responses.id"), index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), index=True)
    answer_text = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    # Per-answer review. A Manager approves or declines each answer in a
    # submission individually; Response.status stays the roll-up for the
    # submission as a whole.
    status = Column(String(50), default="Pending")  # Pending, Approved, Rejected
    review_note = Column(Text, nullable=True)
    reviewed_by_username = Column(String(150), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    response = relationship("Response", back_populates="answers")
    question = relationship("Question", back_populates="answers")
