# FastAPI Authentik login module

This folder is a reusable, database-independent extraction of ChaiHub's
Authentik login flow. It provides:

- `POST /auth/login` for email/password login through Authentik;
- `GET /auth/me` for the current verified identity;
- RS256/JWKS access-token validation;
- reusable FastAPI dependencies for protected and role-restricted endpoints.

It does not include ChaiHub's local user database, OTP signup, first-admin rule,
SMTP configuration, or application-specific profile fields.

## 1. Configure Authentik

Create a separate OAuth2/OIDC provider and application for this backend.

Provider requirements:

1. Use a **confidential** client and record its client ID and client secret.
2. Enable the password grant used by this backend bridge.
3. Select a **Signing Key** so access tokens are signed with RS256.
4. Leave **Encryption Key** empty. This module validates signed JWTs and does
   not accept encrypted JWE tokens.
5. Attach the `openid`, `profile`, `email`, and any custom role scope mappings.
6. Use an authentication flow containing identification and password stages.
   MFA, CAPTCHA, consent, and other interactive stages cannot be completed by
   this headless password bridge.
7. Create a least-privilege backend API token that can read users and manage
   the per-user app-password tokens needed for token issuance.

For refresh tokens, attach the `offline_access` mapping and add
`offline_access` to `AUTHENTIK_SCOPES`. The consuming application must still
implement token refresh and secure refresh-token storage.

## 2. Install

PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Linux/macOS:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with the credentials from your friend's own Authentik provider.
Never copy ChaiHub's `.env` or share its API token/client secret.

## 3. Run the example

```bash
python -m uvicorn app:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs` to use the interactive API documentation.

Run the included offline tests with no extra development dependencies:

```bash
python -m unittest discover -s tests -v
```

## 4. Add it to an existing FastAPI backend

Copy the `authentik_auth` directory into the backend, install the dependencies,
and add:

```python
from fastapi import Depends, FastAPI
from authentik_auth import AuthentikAuth, AuthentikSettings

app = FastAPI()
authentik = AuthentikAuth(AuthentikSettings.from_env())
app.include_router(authentik.router)


@app.get("/private")
def private_route(user=Depends(authentik.current_user)):
    return {"subject": user["sub"]}


@app.get("/admin")
def admin_route(user=Depends(authentik.require_roles("Admin"))):
    return {"message": "Admin access granted", "subject": user["sub"]}
```

Alternatively, install this directory as an editable package:

```bash
python -m pip install -e .
```

## API examples

Login:

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "user-password"
}
```

Use the returned access token:

```http
GET /auth/me
Authorization: Bearer ACCESS_TOKEN
```

## Security notes

- Keep `.env`, the Authentik API token, client secret, and user tokens private.
- Use HTTPS outside local development.
- Add rate limiting and audit logging to `/auth/login` before public deployment.
- Configure CORS only for known frontend origins.
- Do not log request bodies or passwords.
- Give every application its own provider credentials and API token.
- For a new browser-facing application, consider standard Authorization Code +
  PKCE instead of collecting passwords in the application's own login form.
