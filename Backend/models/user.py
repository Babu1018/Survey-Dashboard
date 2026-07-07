from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
from models.survey import user_survey_assignments

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="User")  # Admin, Manager, User
    is_first_login = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Direct assignments
    assigned_surveys = relationship("Survey", secondary=user_survey_assignments, back_populates="assigned_users")
    
    # Group assignments
    groups = relationship("UserGroup", secondary="user_group_membership", back_populates="users")

    @property
    def all_assigned_surveys(self):
        surveys = list(self.assigned_surveys)
        for group in self.groups:
            surveys.extend(group.surveys)
        # return unique surveys by id
        unique_surveys = []
        seen_ids = set()
        for s in surveys:
            if s.id not in seen_ids:
                unique_surveys.append(s)
                seen_ids.add(s.id)
        return unique_surveys


