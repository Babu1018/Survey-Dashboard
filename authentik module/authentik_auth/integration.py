from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .client import AuthentikClient
from .schemas import LoginRequest, LoginResponse, UserInfo
from .security import TokenVerifier
from .settings import AuthentikSettings


class AuthentikAuth:
    """Drop-in Authentik routes and authorization dependencies for FastAPI."""

    def __init__(
        self,
        settings: AuthentikSettings,
        *,
        prefix: str = "/auth",
        tags: list[str] | None = None,
    ):
        self.settings = settings
        self.client = AuthentikClient(settings)
        self.verifier = TokenVerifier(settings)
        self._bearer = HTTPBearer()
        self.router = APIRouter(prefix=prefix, tags=tags or ["Authentication"])
        self._register_routes()

    def _user_info(self, payload: dict, user: dict | None = None) -> UserInfo:
        user = user or {}
        roles = self.verifier.roles(payload) or self.client.roles_for_user(user)
        subject = str(payload.get("sub") or user.get("pk") or "")
        return UserInfo(
            subject=subject,
            email=str(payload.get("email") or user.get("email") or ""),
            username=str(
                payload.get("preferred_username") or user.get("username") or ""
            ),
            name=str(payload.get("name") or user.get("name") or ""),
            roles=roles,
        )

    def _register_routes(self) -> None:
        @self.router.post("/login", response_model=LoginResponse)
        def login(request: LoginRequest) -> LoginResponse:
            token_data, user = self.client.login(str(request.email), request.password)
            access_token = token_data["access_token"]
            payload = self.verifier.decode(access_token)
            return LoginResponse(
                access_token=access_token,
                refresh_token=token_data.get("refresh_token"),
                token_type=token_data.get("token_type") or "Bearer",
                expires_in=token_data.get("expires_in"),
                user=self._user_info(payload, user),
            )

        @self.router.get("/me", response_model=UserInfo)
        def me(payload: dict = Depends(self.current_user)) -> UserInfo:
            return self._user_info(payload)

    def current_user(
        self,
        credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    ) -> dict:
        """FastAPI dependency that returns verified access-token claims."""
        return self.verifier.decode(credentials.credentials)

    def require_roles(self, *allowed_roles: str) -> Callable:
        """Build a FastAPI dependency requiring any one of the supplied roles."""
        allowed = {
            configured
            for configured in self.settings.allowed_roles
            if any(configured.lower() == role.lower() for role in allowed_roles)
        }
        if not allowed:
            raise ValueError("At least one configured role is required")

        def dependency(
            credentials: HTTPAuthorizationCredentials = Depends(self._bearer),
        ) -> dict:
            payload = self.verifier.decode(credentials.credentials)
            if not set(self.verifier.roles(payload)).intersection(allowed):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Requires one of these roles: {', '.join(sorted(allowed))}",
                )
            return payload

        return dependency
