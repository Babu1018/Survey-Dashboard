from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import surveys, groups, monitor, auth, users
from database import init_db
import os

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
    uvicorn.run(app, host="0.0.0.0", port=8000)
