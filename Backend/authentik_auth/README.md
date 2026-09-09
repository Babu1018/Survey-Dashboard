# Authentik SSO login (Survey Dashboard)

This package is mounted into the Backend as an **alternative** login path
alongside the existing local username/password auth in `routers/auth.py`. It
does not replace the `User` table, OTP reset, or phone login — it adds:

- `POST /api/auth/authentik/login` — email/password login bridged through Authentik
- `GET /api/auth/authentik/me` — current verified identity from the access token
- RS256/JWKS access-token validation
- `authentik.require_roles(...)` dependency for role-restricted endpoints

It is disabled automatically (not mounted, no startup error) until the
`AUTHENTIK_*` variables are set in `Backend/.env`.

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
8. Map an Authentik group or user attribute called `role` to one of
   `Admin`, `Manager`, or `User` (this app's existing roles — see
   `AUTHENTIK_ALLOWED_ROLES` in `.env.example`), so `/api/auth/authentik/login`
   returns a role the frontend already understands.

For refresh tokens, attach the `offline_access` mapping and add
`offline_access` to `AUTHENTIK_SCOPES`. The frontend does not currently
implement token refresh, so omit this unless you add that.

## 2. Fill in `Backend/.env`

Uncomment and fill in the `AUTHENTIK_*` block in `Backend/.env.example`, then
restart the backend. `main.py` mounts the router only if
`AuthentikSettings.from_env()` succeeds; check the startup log line
(`Authentik SSO ...`) to confirm it picked up your config.

## Security notes

- Keep `.env`, the Authentik API token, client secret, and user tokens private.
- Use HTTPS outside local development.
- Add rate limiting and audit logging to `/api/auth/authentik/login` before
  public deployment.
- Do not log request bodies or passwords.
- For a new browser-facing application, consider standard Authorization Code +
  PKCE instead of collecting passwords in the application's own login form —
  this bridge exists to keep parity with the app's existing password-form UX.
