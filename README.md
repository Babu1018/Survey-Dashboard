# Survey Dashboard

A survey builder, assignment, and live-monitoring dashboard: a React + Vite
frontend backed by a FastAPI + PostgreSQL backend.

## Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL running locally (or a connection string to a remote instance)

## 1. Backend (FastAPI)

```bash
cd Backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt

copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

Edit `Backend/.env` and set `DATABASE_URL` to your PostgreSQL connection
string (and the `SMTP_*` values if you want outgoing email — password reset,
notifications — to work). Then start the server:

```bash
python main.py
```

The API runs at `http://127.0.0.1:8001`, interactive docs at
`http://127.0.0.1:8001/docs`. `Backend/API_ENDPOINTS.md` documents every
route in detail.

## 2. Frontend (React + Vite)

From the repo root, in a separate terminal:

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173` and talks to the backend at
`http://127.0.0.1:8001` by default. If your backend runs somewhere else,
create a `.env` file at the repo root with:
```
VITE_API_URL=http://your-backend-host:port
```

Other scripts: `npm run build` (production build), `npm run preview`
(serve that build locally), `npm run lint`.

## Project structure

```
Survey-Dashboard/
├── Backend/                     FastAPI app — the single source of truth for all data
│   ├── main.py                   App entry point, CORS, router registration
│   ├── database.py               DB connection/session setup
│   ├── auth_utils.py             Password hashing, JWT helpers
│   ├── email_utils.py            SMTP sending for OTPs/notifications
│   ├── notifications.py          Notification creation helpers
│   ├── ws_manager.py             WebSocket connection manager (live monitor feed)
│   ├── models/                   SQLAlchemy ORM models
│   ├── schemas/                  Pydantic request/response schemas
│   ├── routers/                  One router per resource (auth, users, surveys, groups, monitor, notifications)
│   ├── uploads/                  User-uploaded survey media, served at /uploads
│   ├── requirements.txt
│   ├── .env.example
│   └── API_ENDPOINTS.md          Full REST API reference
│
├── public/                      Static assets served as-is (favicon, icons)
│
├── src/                         React app
│   ├── assets/                   Images bundled by Vite
│   ├── bones/                    boneyard-js visual-builder registry (used by SurveyBuilder)
│   ├── components/
│   │   └── common/                Small shared UI: Toast, StatCard, BranchBadge
│   ├── config/
│   │   └── api.js                 Single source of truth for the backend base URL
│   ├── layouts/                  App chrome
│   │   ├── MainLayout.jsx          Sidebar + TopBar + content shell
│   │   ├── Sidebar.jsx
│   │   └── TopBar.jsx
│   ├── pages/                    One file per route (Dashboard, SurveyBuilder, LiveMonitor, ...)
│   ├── routes/
│   │   └── AppRoutes.jsx          All route definitions + the auth guard
│   ├── services/                 Every backend call lives here, grouped by resource —
│   │   │                         the only files that know about HTTP/fetch
│   │   ├── apiClient.js           Shared request/error-handling helper
│   │   ├── authService.js
│   │   ├── surveyService.js
│   │   ├── groupService.js
│   │   ├── userService.js
│   │   ├── monitorService.js
│   │   └── inboxService.js
│   ├── store/                    zustand stores — app state, call into services/
│   ├── utils/                    Pure helpers (Excel import/export, translation, routing logic)
│   ├── App.jsx
│   └── main.jsx
│
├── index.html
├── vite.config.js
└── package.json
```

Adding a new backend endpoint from the frontend side: add a function to the
matching file in `src/services/`, then call it from the relevant `store/`
(or directly from a page, for one-off calls) — nothing else in the app talks
to `fetch`/the API URL directly.
