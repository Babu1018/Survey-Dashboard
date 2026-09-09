# Survey Dashboard API — Endpoint Reference & Hosting Checklist

This documents the API surface as implemented today (FastAPI app in `Backend/`), for reference when deploying to a real server. It also lists concrete gaps that should be closed before going live — none of these are fixed yet, this is a checklist only.

## App basics

- Entry point: `Backend/main.py`. Title: "Survey Dashboard API", version `1.1.0`.
- No global URL prefix — each router declares its own full `/api/...` prefix.
- Static file uploads served at `/uploads` from `Backend/uploads/`.
- Auth: JWT bearer tokens (`python-jose`), issued by `POST /api/auth/login`. Roles: `Admin`, `Manager`, `User`, enforced per-endpoint via a `require_role([...])` dependency.
- Database: PostgreSQL only (`Backend/database.py`), connection string from the `DATABASE_URL` env var, no fallback.
- Default dev run: `uvicorn main:app` on `0.0.0.0:8000` (see bottom of `main.py`).

## Endpoints

### Auth — `Backend/routers/auth.py`, prefix `/api/auth`

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/login` | Log in, returns JWT + user profile | none |
| POST | `/change-password` | Change own password | any logged-in user |
| GET | `/me` | Get current user's profile | any logged-in user |

### Users — `Backend/routers/users.py`, prefix `/api/users`

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | List all users | Admin/Manager |
| GET | `/{user_id}` | Get one user | Admin/Manager |
| POST | `/` | Create user (optional direct survey assignment) | Admin/Manager |
| PATCH | `/{user_id}` | Update password/role/is_active | Admin only |
| POST | `/{user_id}/assign-survey/{survey_id}` | Directly assign a survey to a user | Admin/Manager |
| DELETE | `/{user_id}/assign-survey/{survey_id}` | Unassign | Admin/Manager |
| DELETE | `/{user_id}` | Delete user (blocks deleting `admin`) | Admin only |

### Surveys — `Backend/routers/surveys.py`, prefix `/api/surveys`

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/bulk-delete` | Delete surveys by `ids` and/or `category` | Admin/Manager |
| POST | `/upload` | Upload media (200MB max), returns a URL | Admin/Manager |
| POST | `/maintenance/repair` | Ad-hoc schema/cascade repair (raw SQL) | Admin |
| GET | `/` | List surveys (optional `?category=`), with nested questions/options | any logged-in user |
| GET | `/my-responses` | List the current user's own submissions (survey title + status) | any logged-in user |
| GET | `/{survey_id}` | Get one survey with nested questions/options | any logged-in user |
| POST | `/` | Create survey (metadata only) | Admin/Manager |
| POST | `/{survey_id}/questions` | Bulk-add questions + options to a survey | Admin/Manager |
| PUT | `/{survey_id}` | Update survey metadata | Admin/Manager |
| DELETE | `/{survey_id}` | Delete survey (cascades questions/responses) | Admin/Manager |
| DELETE | `/{survey_id}/questions` | Delete all questions of a survey | Admin/Manager |
| POST | `/{survey_id}/responses` | Submit a respondent's answers | **none — public by design** |
| GET | `/{survey_id}/stats` | Response count + question count | **none** |

Note: there is no per-question update endpoint. The builder always does `DELETE /{survey_id}/questions` followed by `POST /{survey_id}/questions` (full replace) on every save.

### Groups — `Backend/routers/groups.py`, prefix `/api/groups`

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | List groups | **none** |
| POST | `/` | Create group | **none** |
| DELETE | `/{group_id}` | Delete group | **none** |
| PATCH | `/{group_id}` | Update group name/description | **none** |
| POST | `/{group_id}/assign/{survey_id}` | Assign survey to group | **none** |
| DELETE | `/{group_id}/assign/{survey_id}` | Unassign survey from group | **none** |
| GET | `/{group_id}/surveys` | List surveys assigned to a group | **none** |
| POST | `/{group_id}/users/{user_id}` | Add user to group | **none** |
| DELETE | `/{group_id}/users/{user_id}` | Remove user from group | **none** |

### Monitor — `Backend/routers/monitor.py`, prefix `/api/monitor`

| Method | Path | Purpose | Auth |
|---|---|---|---|
| WS | `/ws` | Live feed — broadcasts on every new response submission | **none** |
| GET | `/recent` | Recent responses (`?limit=50`), includes red-flag detection | **none** |
| GET | `/responses/{response_id}` | Full response detail: per-answer score, scale aggregation, computed severity | **none** |
| DELETE | `/responses/{response_id}` | Delete a response | Admin/Manager |
| POST | `/responses/bulk-delete` | Bulk delete responses by id list | Admin/Manager |
| PATCH | `/responses/{response_id}/status` | Update a response's status (`Pending`/`Reviewed`/`Intervention Triggered`/`Resolved`/`Approved`/`Rejected` — any string accepted) | Admin/Manager |

## Hosting-readiness checklist

None of these are implemented yet — they're gaps to close before deploying somewhere other than localhost.

1. **Hardcoded `http://localhost:8000` API base** in the frontend — `src/pages/SurveyBuilder.jsx` (media uploads), `src/pages/SurveyForm.jsx` (response submission), and the `src/store/*.js` files (`useSurveyStore.js`, `useAuthStore.js`, `useGroupStore.js`, `useMonitorStore.js`). Needs to become env-configurable, e.g. a Vite `VITE_API_URL` env var read via `import.meta.env.VITE_API_URL`.
2. **CORS allow-list is hardcoded to localhost** (`Backend/main.py`, `allow_origins=[...]`) — needs to read the real hosted frontend domain(s) from an env var instead.
3. **No auth at all on `groups.py` (every endpoint) and three `monitor.py` endpoints** (`GET /recent`, `GET /responses/{response_id}`, `WS /ws`) — anyone with network access to the API can currently read all group membership and every survey response, including red-flag/severity data. `GET /api/surveys/{id}/stats` is also open. `POST /api/surveys/{id}/responses` is intentionally public (respondents don't log in) — leave that one as-is.
4. **Secrets/env hygiene** — `Backend/database.py` requires `DATABASE_URL` with no fallback (good), but confirm `SECRET_KEY` (JWT signing secret, used in `auth_utils.py`) is set from a real environment variable in production and not left at its development default.
5. **No migration framework** — `Backend/database.py`'s `init_db()` runs idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements at every boot instead of using Alembic or similar. Fine for a single environment today, but risky once staging/production need coordinated schema changes.
6. **Uploaded file URLs are hardcoded to localhost** — `POST /api/surveys/upload` in `surveys.py` returns `f"http://localhost:8000/uploads/{filename}"` literally; needs to build the URL from the real request host/configured base URL instead.
7. **`POST /api/surveys/{id}/questions` has no request validation** — it accepts a raw `List[dict]` and pulls fields with `.get()` rather than validating against the `QuestionSchema` Pydantic model that already exists in `Backend/schemas/survey.py` but isn't used by this endpoint. Malformed payloads are silently accepted with `None`/default values instead of a 422 error.
