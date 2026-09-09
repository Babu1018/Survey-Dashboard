"""Creation helpers for the in-app notification feed.

Every function here is best-effort: a notification must never be the reason a
survey submission or a review decision fails, so callers wrap them and the
helpers swallow their own errors after rolling back.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select

from models.notification import Notification
from models.user import User
from models.survey import Survey, Response, UserGroup, user_survey_assignments

# How long a user has to complete a survey after it is assigned before the
# Admins are told it has lapsed.
SURVEY_VALIDITY_DAYS = 3


def _add(db: Session, user_id: int, type_: str, title: str, message: str = None,
         link: str = None, dedupe_key: str = None) -> bool:
    """Insert one notification. Returns False if it was a duplicate."""
    if user_id is None:
        return False
    if dedupe_key and db.query(Notification).filter(Notification.dedupe_key == dedupe_key).first():
        return False
    db.add(Notification(
        user_id=user_id, type=type_, title=title,
        message=message, link=link, dedupe_key=dedupe_key,
    ))
    return True


def _admin_ids(db: Session):
    return [u.id for u in db.query(User).filter(User.role == "Admin", User.is_active == True).all()]


def _managers_for_user(db: Session, user_id: int):
    """Managers who own a group this user belongs to — the people entitled to
    review that user's submissions."""
    if user_id is None:
        return []
    groups = db.query(UserGroup).join(UserGroup.users).filter(User.id == user_id).all()
    return [g.manager_id for g in groups if g.manager_id]


# ── Triggers ─────────────────────────────────────────────────────────

def notify_submission_received(db: Session, response: Response, survey: Survey):
    """A User submitted a survey -> tell the Managers who review that user."""
    try:
        who = response.respondent_email or "A user"
        for manager_id in set(_managers_for_user(db, response.user_id)):
            _add(
                db, manager_id, "submission_received",
                "New submission awaiting your review",
                f"{who} submitted \"{survey.title}\" and it is waiting for your action.",
                f"/review/{response.id}",
            )
        db.commit()
    except Exception:
        db.rollback()


def notify_review_decision(db: Session, response: Response, survey: Survey,
                           reviewer: User, status: str, comment: str = None):
    """A Manager approved or rejected a submission.

    Tells the Admins that a review happened, and tells the submitting User the
    outcome — including the reason, which is what they need to act on.
    """
    try:
        subject = response.respondent_email or "a user"

        # Admins: a Manager has put a decision up for the record.
        if reviewer.role == "Manager":
            for admin_id in _admin_ids(db):
                _add(
                    db, admin_id, "review_decision",
                    f"{reviewer.username} {status.lower()} a submission",
                    f"\"{survey.title}\" from {subject} was {status.lower()} by {reviewer.username}.",
                    f"/review/{response.id}",
                )

        # The submitting user: only a rejection needs their attention, and the
        # reason travels with it.
        if response.user_id is not None:
            if status == "Rejected":
                _add(
                    db, response.user_id, "submission_rejected",
                    f"Your submission was rejected",
                    (f"\"{survey.title}\" was rejected by {reviewer.username}."
                     + (f" Reason: {comment}" if comment else "")),
                    "/",
                )
            elif status == "Approved":
                _add(
                    db, response.user_id, "submission_approved",
                    "Your submission was approved",
                    f"\"{survey.title}\" was approved by {reviewer.username}.",
                    "/",
                )
            elif comment:
                # A decision that is neither approve nor reject but carries
                # feedback still reaches the user.
                _add(
                    db, response.user_id, "review_feedback",
                    "You have reviewer feedback",
                    f"{reviewer.username} commented on \"{survey.title}\": {comment}",
                    "/",
                )
        db.commit()
    except Exception:
        db.rollback()


def notify_survey_assigned(db: Session, user: User, survey: Survey, assigner: User):
    """A survey was assigned to a User -> tell that user."""
    try:
        _add(
            db, user.id, "survey_assigned",
            "A new survey was assigned to you",
            f"\"{survey.title}\" was assigned by {assigner.username}. "
            f"Please complete it within {SURVEY_VALIDITY_DAYS} days.",
            "/",
            dedupe_key=f"assigned:{user.id}:{survey.id}",
        )
        db.commit()
    except Exception:
        db.rollback()


def notify_submission_goal(db: Session, user: User, days: int, count: int, manager: User):
    """A Manager set a submission goal for a user -> tell that user."""
    try:
        _add(
            db, user.id, "goal_set",
            "Your manager set a new submission goal",
            f"{manager.username} wants you to complete {count} "
            f"submission{'s' if count != 1 else ''} within {days} day{'s' if days != 1 else ''}.",
            "/",
        )
        db.commit()
    except Exception:
        db.rollback()


def sweep_overdue_assignments(db: Session):
    """Raise an Admin notification for every assignment that has passed its
    validity window without the user submitting anything for that survey.

    Runs lazily whenever an Admin opens their notifications. The dedupe key is
    per (user, survey), so each lapsed assignment is reported exactly once no
    matter how often this runs.
    """
    try:
        cutoff = datetime.utcnow() - timedelta(days=SURVEY_VALIDITY_DAYS)
        admin_ids = _admin_ids(db)
        if not admin_ids:
            return

        rows = db.execute(
            select(
                user_survey_assignments.c.user_id,
                user_survey_assignments.c.survey_id,
                user_survey_assignments.c.assigned_at,
            )
        ).all()

        created = False
        for user_id, survey_id, assigned_at in rows:
            if assigned_at is None or assigned_at > cutoff:
                continue

            submitted = db.query(Response).filter(
                Response.user_id == user_id,
                Response.survey_id == survey_id,
            ).first()
            if submitted:
                continue

            user = db.query(User).filter(User.id == user_id).first()
            survey = db.query(Survey).filter(Survey.id == survey_id).first()
            if not user or not survey:
                continue

            for admin_id in admin_ids:
                if _add(
                    db, admin_id, "survey_overdue",
                    "A survey passed its validity period",
                    f"{user.username} has not completed \"{survey.title}\" within "
                    f"{SURVEY_VALIDITY_DAYS} days of it being assigned.",
                    f"/users/{user.id}",
                    dedupe_key=f"overdue:{admin_id}:{user_id}:{survey_id}",
                ):
                    created = True

        if created:
            db.commit()
    except Exception:
        db.rollback()
