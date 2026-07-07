# Survey Dashboard Backend
FastAPI backend for the Survey Dashboard application with PostgreSQL integration.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/Scripts/activate  # On Windows
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure database:
   - Copy `.env.example` to `.env`
   - Update `DATABASE_URL` with your PostgreSQL connection string
   - Default: `postgresql://postgres:password@localhost:5432/Survey-Dashboard`

4. Run the application:
```bash
python main.py
```

The API will be available at `http://localhost:8000`
API documentation at `http://localhost:8000/docs`

## Project Structure

- `main.py` - FastAPI application entry point
- `database.py` - Database connection and session management
- `models/` - SQLAlchemy ORM models
- `schemas/` - Pydantic schemas for request/response validation
- `routers/` - API route handlers
- `requirements.txt` - Python dependencies
- `.env.example` - Environment variables template
