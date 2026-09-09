import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import surveys, groups, monitor, auth, users, notifications
from database import init_db
# Authentik SSO temporarily disabled - see routers/users.py for the matching change.
# from authentik_auth import AuthentikAuth, AuthentikSettings, ConfigurationError
import os

logger = logging.getLogger(__name__)

# Initialize database
init_db()

app = FastAPI(title="Survey Dashboard API", version="1.1.0")

# Create uploads dir if not exists
if not os.path.exists("uploads"):
    os.makedirs("uploads")

# Serve static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# High-priority CORS for Command Center Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:5174", 
        "http://localhost:5175", 
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(surveys.router)
app.include_router(groups.router)
app.include_router(monitor.router)
app.include_router(notifications.router)

# Authentik SSO login is optional and additive to the local username/password
# login above. It only mounts once AUTHENTIK_* is configured in .env; see
# authentik_auth/README.md for setup.
# Temporarily disabled - re-enable by uncommenting this block and the import above.
# try:
#     authentik_settings = AuthentikSettings.from_env()
# except ConfigurationError:
#     logger.info("Authentik SSO not configured; skipping /api/auth/authentik/* routes")
# else:
#     authentik = AuthentikAuth(authentik_settings, prefix="/api/auth/authentik")
#     app.include_router(authentik.router)
#     logger.info("Authentik SSO enabled at /api/auth/authentik")

@app.get("/")
def read_root():
    return {
        "status": "Operational",
        "system": "Command Center API",
        "version": "1.1.0",
        "endpoints": ["/api/surveys", "/api/groups", "/api/monitor"]
    }

@app.get("/health")
def health_check():
    return {"status": "green", "uptime": "optimal"}

if __name__ == "__main__":
    import uvicorn
    # Port 8000 is a common default and is easily claimed by an unrelated local
    # service. A server bound to 0.0.0.0:8000 is silently shadowed on loopback
    # by anything bound to 127.0.0.1:8000, which sends the frontend's requests
    # to the wrong app. Default to a less contested port and allow an override.
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
