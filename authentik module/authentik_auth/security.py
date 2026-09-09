from __future__ import annotations

import requests
from fastapi import HTTPException, status
from jose import JWTError, jwt

from .settings import AuthentikSettings


class TokenVerifier:
    """Verify Authentik-signed RS256 access tokens through its JWKS endpoint."""

    def __init__(self, settings: AuthentikSettings):
        self.settings = settings
        self._keys: list[dict] | None = None

    def _get_jwks(self) -> list[dict]:
        try:
            response = requests.get(
                self.settings.jwks_url,
                timeout=self.settings.request_timeout,
            )
            response.raise_for_status()
            keys = response.json().get("keys") or []
        except (requests.RequestException, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to retrieve Authentik signing keys",
            ) from exc
        if not keys:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentik did not publish any signing keys",
            )
        return keys

    def _find_key(self, kid: str | None, *, refresh: bool = True) -> dict:
        if self._keys is None:
            self._keys = self._get_jwks()
        key = next((item for item in self._keys if item.get("kid") == kid), None)
        if key is None and refresh:
            self._keys = self._get_jwks()
            return self._find_key(kid, refresh=False)
        if key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Access token was signed with an unknown key",
            )
        return key

    def decode(self, token: str) -> dict:
        if not token or token in {"undefined", "null"}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing access token",
            )
        if token.count(".") != 2:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    "Encrypted JWE tokens are not supported. Clear the Encryption Key "
                    "on the Authentik OAuth2 provider and keep its Signing Key enabled."
                ),
            )
        try:
            header = jwt.get_unverified_header(token)
            key = self._find_key(header.get("kid"))
            return jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=self.settings.audience,
                issuer=self.settings.issuer,
            )
        except HTTPException:
            raise
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token",
            ) from exc

    def roles(self, payload: dict) -> list[str]:
        candidates: list = []
        direct_role = payload.get("role")
        candidates.extend(
            direct_role if isinstance(direct_role, list) else [direct_role]
        )
        attribute_role = (payload.get("attributes") or {}).get("role")
        candidates.extend(
            attribute_role if isinstance(attribute_role, list) else [attribute_role]
        )
        candidates.extend(payload.get("groups") or [])

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
