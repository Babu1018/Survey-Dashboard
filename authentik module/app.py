"""Minimal runnable example using the reusable Authentik module."""

from fastapi import Depends, FastAPI

from authentik_auth import AuthentikAuth, AuthentikSettings

settings = AuthentikSettings.from_env()
authentik = AuthentikAuth(settings)

app = FastAPI(title="Authentik FastAPI Example")
app.include_router(authentik.router)


@app.get("/")
def health() -> dict:
    return {"status": "running"}


@app.get("/protected")
def protected(payload: dict = Depends(authentik.current_user)) -> dict:
    return {"message": "Valid Authentik token", "subject": payload.get("sub")}


@app.get("/admin-only")
def admin_only(payload: dict = Depends(authentik.require_roles("Admin"))) -> dict:
    return {"message": "Admin access granted", "subject": payload.get("sub")}
