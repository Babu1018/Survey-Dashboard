from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Index
from sqlalchemy.sql import func
from database import Base


class Notification(Base):
    """A message addressed to one account, shown in the bell menu.

    user_id is a loose reference with no FK constraint, matching LoginLog, so
    deleting an account never blocks on leftover notifications.
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)

    # Machine-readable kind, used by the frontend to pick an icon/tone.
    # One of: submission_received, submission_rejected, submission_approved,
    # review_decision, survey_assigned, survey_overdue, goal_set.
    type = Column(String(50), nullable=False)

    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)

    # Frontend route to open when the notification is clicked.
    link = Column(String(300), nullable=True)

    is_read = Column(Boolean, default=False, nullable=False)

    # Set only for notifications that a repeating sweep could otherwise raise
    # more than once (the overdue-survey check). Unique, so a second insert
    # for the same fact is rejected rather than duplicated.
    dedupe_key = Column(String(200), nullable=True, unique=True)

    created_at = Column(DateTime, server_default=func.now(), index=True)

    # Deleting a swept notification cannot simply drop the row: the sweep would
    # see the dedupe_key free and raise the same notice again on the next fetch.
    # Rows carrying a dedupe_key are tombstoned here instead, which hides them
    # from the feed while keeping the key claimed.
    dismissed_at = Column(DateTime, nullable=True)


Index("ix_notifications_user_unread", Notification.user_id, Notification.is_read)
