from __future__ import annotations

import logging

import requests
from fastapi import HTTPException, status

from .settings import AuthentikSettings

logger = logging.getLogger(__name__)

SUCCESS_COMPONENT = "xak-flow-redirect"
DENIED_COMPONENTS = {"ak-stage-access-denied", "ak-stage-flow-error"}
MAX_FLOW_STEPS = 8


class AuthentikClient:
    """Password verification and token issuance through Authentik."""

    def __init__(self, settings: AuthentikSettings):
        self.settings = settings

    def _unavailable(self, exc: Exception) -> HTTPException:
        logger.warning("Authentik request failed: %s", type(exc).__name__)
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable",
        )

    def _admin_request(self, method: str, path: str, **kwargs) -> requests.Response:
        headers = {
            "Authorization": f"Bearer {self.settings.api_token}",
            "Content-Type": "application/json",
        }
        try:
            return requests.request(
                method,
                f"{self.settings.domain}{path}",
                headers=headers,
                timeout=self.settings.request_timeout,
                **kwargs,
            )
        except requests.RequestException as exc:
            raise self._unavailable(exc) from exc

    def find_user_by_email(self, email: str) -> dict | None:
        response = self._admin_request(
            "GET",
            "/api/v3/core/users/",
            params={"email": email.strip().lower(), "page_size": 2},
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Authentik user lookup failed",
            )
        results = response.json().get("results") or []
        return results[0] if results else None

    def create_user(
        self,
        *,
        username: str,
        email: str,
        password: str,
        name: str = "",
        is_active: bool = True,
        role: str | None = None,
    ) -> dict:
        """Provision a user in Authentik and set their initial password."""
        payload: dict = {
            "username": username,
            "email": email,
            "name": name or username,
            "is_active": is_active,
            "path": "users",
            "type": "internal",
        }
        if role:
            payload["attributes"] = {"role": role}
        response = self._admin_request("POST", "/api/v3/core/users/", json=payload)
        if response.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not create Authentik user",
            )
        user = response.json()
        self.set_password(user["pk"], password)
        return user

    def set_password(self, user_pk: int | str, password: str) -> None:
        response = self._admin_request(
            "POST",
            f"/api/v3/core/users/{user_pk}/set_password/",
            json={"password": password},
        )
        if response.status_code not in (200, 204):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not set Authentik user password",
            )

    def update_user(self, user_pk: int | str, **fields) -> dict:
        response = self._admin_request(
            "PATCH", f"/api/v3/core/users/{user_pk}/", json=fields
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not update Authentik user",
            )
        return response.json()

    def delete_user(self, user_pk: int | str) -> None:
        response = self._admin_request("DELETE", f"/api/v3/core/users/{user_pk}/")
        if response.status_code not in (204, 404):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not delete Authentik user",
            )

    def verify_password(self, username: str, password: str) -> bool:
        """Drive an identification/password-only Authentik flow headlessly."""
        executor_url = (
            f"{self.settings.domain}/api/v3/flows/executor/"
            f"{self.settings.authentication_flow}/"
        )
        session = requests.Session()
        session.headers.update(
            {"Accept": "application/json", "Referer": self.settings.domain}
        )

        try:
            response = session.get(
                executor_url,
                params={"query": ""},
                timeout=self.settings.request_timeout,
            )
            response.raise_for_status()
            challenge = response.json()

            for _ in range(MAX_FLOW_STEPS):
                component = challenge.get("component")
                if component == SUCCESS_COMPONENT:
                    return True
                if component in DENIED_COMPONENTS or challenge.get("response_errors"):
                    return False

                if component == "ak-stage-identification":
                    body = {"component": component, "uid_field": username}
                    if challenge.get("password_fields"):
                        body["password"] = password
                elif component == "ak-stage-password":
                    body = {"component": component, "password": password}
                else:
                    raise HTTPException(
                        status_code=status.HTTP_501_NOT_IMPLEMENTED,
                        detail=(
                            f"The Authentik flow requires unsupported step "
                            f"'{component}'. Use identification and password stages."
                        ),
                    )

                csrf = session.cookies.get("authentik_csrf") or ""
                response = session.post(
                    executor_url,
                    params={"query": ""},
                    json=body,
                    headers={"X-authentik-CSRF": csrf},
                    timeout=self.settings.request_timeout,
                )
                response.raise_for_status()
                challenge = response.json()

            return challenge.get("component") == SUCCESS_COMPONENT
        except requests.RequestException as exc:
            raise self._unavailable(exc) from exc
        finally:
            session.close()

    def _app_password(self, user_pk: int | str) -> str:
        identifier = f"{self.settings.app_password_prefix}-{user_pk}"
        path = f"/api/v3/core/tokens/{identifier}/view_key/"
        response = self._admin_request("GET", path)

        if response.status_code == 404:
            created = self._admin_request(
                "POST",
                "/api/v3/core/tokens/",
                json={
                    "identifier": identifier,
                    "intent": "app_password",
                    "user": user_pk,
                    "description": "FastAPI Authentik login bridge",
                    "expiring": False,
                },
            )
            if created.status_code not in (200, 201):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Could not provision the Authentik app password",
                )
            response = self._admin_request("GET", path)

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not read the Authentik app password",
            )
        return response.json()["key"]

    def _exchange_for_token(self, username: str, app_password: str) -> dict:
        payload = {
            "grant_type": "password",
            "client_id": self.settings.client_id,
            "username": username,
            "password": app_password,
            "scope": self.settings.scopes,
        }
        if self.settings.client_secret:
            payload["client_secret"] = self.settings.client_secret

        try:
            response = requests.post(
                self.settings.token_url,
                data=payload,
                timeout=self.settings.request_timeout,
            )
        except requests.RequestException as exc:
            raise self._unavailable(exc) from exc

        if response.status_code != 200:
            logger.warning("Authentik token exchange returned %s", response.status_code)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Authentik refused to issue an access token",
            )

        token_data = response.json()
        if not token_data.get("access_token"):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Authentik did not return an access token",
            )
        return token_data

    def login(self, email: str, password: str) -> tuple[dict, dict]:
        user = self.find_user_by_email(email)
        if not user or not user.get("is_active"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if not self.verify_password(user["username"], password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        token_data = self._exchange_for_token(
            user["username"], self._app_password(user["pk"])
        )
        return token_data, user

    def roles_for_user(self, user: dict) -> list[str]:
        candidates: list = []
        attributes = user.get("attributes") or {}
        role = attributes.get("role")
        candidates.extend(role if isinstance(role, list) else [role])
        candidates.extend(user.get("groups") or [])
        return self._normalise_roles(candidates)

    def _normalise_roles(self, candidates: list) -> list[str]:
        roles: list[str] = []
        for candidate in candidates:
            if isinstance(candidate, dict):
                candidate = candidate.get("name")
            for allowed in self.settings.allowed_roles:
                if str(candidate or "").strip().lower() == allowed.lower():
                    if allowed not in roles:
                        roles.append(allowed)
                    break
        return roles
