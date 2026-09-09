"""Keeps Authentik user accounts in sync with the local User table.

The local `users` table stays the source of truth for app data (surveys,
groups, assignments) - see routers/users.py. These helpers mirror
create/update/delete onto the Authentik instance configured via
AUTHENTIK_* env vars so the same account can also log in through
/api/auth/authentik/login. If Authentik isn't configured, or a sync call
fails (e.g. the Authentik server is down), these are no-ops that only log a
warning - they never block a local user operation from succeeding.
"""
from __future__ import annotations

import logging

from authentik_auth import AuthentikClient, AuthentikSettings, ConfigurationError

logger = logging.getLogger(__name__)

_client: AuthentikClient | None = None
_attempted = False


def get_client() -> AuthentikClient | None:
    global _client, _attempted
    if not _attempted:
        _attempted = True
        try:
            _client = AuthentikClient(AuthentikSettings.from_env())
        except ConfigurationError:
            _client = None
    return _client


def sync_create_user(user, password: str) -> None:
    client = get_client()
    if not client or not user.email:
        return
    try:
        existing = client.find_user_by_email(user.email)
        if existing:
            # Never touch username/name on an existing Authentik account -
            # it may be an account (e.g. akadmin) that predates this app's
            # local user and already has its own identity there. Only the
            # role attribute, active flag, and password are ours to manage.
            client.update_user(
                existing["pk"],
                is_active=user.is_active,
                attributes={**(existing.get("attributes") or {}), "role": user.role},
            )
            client.set_password(existing["pk"], password)
        else:
            client.create_user(
                username=user.username,
                email=user.email,
                name=user.username,
                password=password,
                is_active=user.is_active,
                role=user.role,
            )
    except Exception:
        logger.warning("Authentik sync (create) failed for user %s", user.username, exc_info=True)


def sync_update_user(user, password: str | None = None) -> None:
    client = get_client()
    if not client or not user.email:
        return
    try:
        existing = client.find_user_by_email(user.email)
        if not existing:
            return
        client.update_user(
            existing["pk"],
            is_active=user.is_active,
            attributes={**(existing.get("attributes") or {}), "role": user.role},
        )
        if password:
            client.set_password(existing["pk"], password)
    except Exception:
        logger.warning("Authentik sync (update) failed for user %s", user.username, exc_info=True)


def sync_delete_user(user) -> None:
    client = get_client()
    if not client or not user.email:
        return
    try:
        existing = client.find_user_by_email(user.email)
        if existing:
            client.delete_user(existing["pk"])
    except Exception:
        logger.warning("Authentik sync (delete) failed for user %s", user.username, exc_info=True)
