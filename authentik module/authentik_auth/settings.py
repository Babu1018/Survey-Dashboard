from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


class ConfigurationError(RuntimeError):
    """Raised when required Authentik configuration is missing."""


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ConfigurationError(f"{name} is required")
    return value


@dataclass(frozen=True)
class AuthentikSettings:
    domain: str
    issuer: str
    audience: str
    client_id: str
    client_secret: str
    api_token: str
    authentication_flow: str
    token_url: str
    jwks_url: str
    scopes: str
    app_password_prefix: str
    allowed_roles: tuple[str, ...]
    request_timeout: int = 20

    @classmethod
    def from_env(cls, env_file: str | Path | None = None) -> "AuthentikSettings":
        if env_file is not None:
            load_dotenv(dotenv_path=env_file, override=False)
        else:
            load_dotenv(override=False)

        domain = _required("AUTHENTIK_DOMAIN").rstrip("/")
        application = os.getenv("AUTHENTIK_APPLICATION", "").strip()
        client_id = _required("AUTHENTIK_CLIENT_ID")
        issuer = os.getenv("AUTHENTIK_ISSUER", "").strip()
        if not issuer and application:
            issuer = f"{domain}/application/o/{application}/"
        if not issuer:
            raise ConfigurationError(
                "AUTHENTIK_ISSUER or AUTHENTIK_APPLICATION is required"
            )
        issuer = issuer.rstrip("/") + "/"

        roles = tuple(
            role.strip()
            for role in os.getenv(
                "AUTHENTIK_ALLOWED_ROLES", "Admin,Employee,Guest"
            ).split(",")
            if role.strip()
        )
        if not roles:
            raise ConfigurationError("AUTHENTIK_ALLOWED_ROLES cannot be empty")

        return cls(
            domain=domain,
            issuer=issuer,
            audience=os.getenv("AUTHENTIK_AUDIENCE", "").strip() or client_id,
            client_id=client_id,
            client_secret=os.getenv("AUTHENTIK_CLIENT_SECRET", "").strip(),
            api_token=_required("AUTHENTIK_API_TOKEN"),
            authentication_flow=os.getenv(
                "AUTHENTIK_AUTH_FLOW", "default-authentication-flow"
            ).strip(),
            token_url=os.getenv("AUTHENTIK_TOKEN_URL", "").strip()
            or f"{domain}/application/o/token/",
            jwks_url=os.getenv("AUTHENTIK_JWKS_URL", "").strip()
            or f"{issuer}jwks/",
            scopes=os.getenv(
                "AUTHENTIK_SCOPES", "openid profile email marketplace_role"
            ).strip(),
            app_password_prefix=os.getenv(
                "AUTHENTIK_APP_PASSWORD_PREFIX", "fastapi-login"
            ).strip(),
            allowed_roles=roles,
            request_timeout=int(os.getenv("AUTHENTIK_REQUEST_TIMEOUT", "20")),
        )
