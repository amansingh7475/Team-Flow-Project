# TeamFlow API

Independent Express/Mongoose backend for TeamFlow. Authentication uses secure session cookies and protected access is scoped by the authenticated user's workspace membership.

## Run

```bash
cd server
copy .env.example .env
npm install
npm run dev
```

The API listens on `http://localhost:4000` and exposes `GET /api/v1/health` (liveness) and `GET /api/v1/health/ready` (MongoDB readiness).

The same server exposes Socket.IO at `http://localhost:4000`. Socket connections must include the HTTP-only `teamflow_session` cookie and a requested `workspaceId`; the server verifies the session and membership before joining the workspace room. Configure `SOCKET_CORS_ORIGIN` when the socket origin differs from `FRONTEND_ORIGIN`.

Authentication uses an HTTP-only `teamflow_session` cookie backed by a hashed, revocable session record. Passwords are bcrypt-hashed and never returned. In production set a strong `SESSION_SECRET`; cookies become `Secure` automatically. Auth routes are rate-limited and return generic credential errors.

For local HTTP development use `SESSION_COOKIE_SAME_SITE=lax` and `SESSION_COOKIE_SECURE=false`. For a Vercel frontend calling a Render API, use HTTPS origins with `SESSION_COOKIE_SAME_SITE=none` and `SESSION_COOKIE_SECURE=true`; these values are validated at startup and are used consistently when setting and clearing the session cookie. Credentialed CORS and Socket.IO accept only the explicitly configured origins.

`/api/v1/auth/register`, `/login`, `/logout`, `/me`, `/change-password`, `/request-password-reset`, and `/reset-password` are available. Protected workspace routes require the session cookie and `x-workspace-id`; the server verifies membership and role before mutations. The frontend sends cookies with `credentials: include` when `VITE_DATA_MODE=api`.

Request validation bounds externally supplied collections before database work: projects accept at most 100 member IDs (128 characters each), and tasks accept at most 20 labels (50 characters each). JSON request bodies remain limited to 100 KB. These are API safety limits, not pagination limits; larger collaboration sets should use separate workspace records.

Kanban task `order` values are intentionally restricted to finite safe integers because they represent discrete positions; fractional or infinite ordering values are rejected.

## Data contract

The frontend mock service stores `Project` records with `id`, `name`, `code`, `color`, `description`, optional `startDate`, `due`, `members`, and `state`. `Task` records contain `id`, `title`, `description`, `projectId`, `status`, `priority`, `due`, `assignee`, `initials`, `tone`, `labels`, and `comments`. Mongo documents use ObjectIds and timestamps; serializers expose stable `id` strings and the same semantic fields.

## API mode

The frontend remains in localStorage mock mode by default. Set `VITE_DATA_MODE=api` and `VITE_API_BASE_URL=http://localhost:4000/api/v1` only after starting MongoDB and the server. For integration tests, set `TEST_MONGODB_URI` to a disposable local test database; if unset, the suite attempts `mongodb-memory-server` and skips database-dependent cases when its native binary cannot start.

Workspace invitations are persisted with hashed, expiring tokens. In production, set `INVITATION_DELIVERY_URL` to a trusted internal email-delivery webhook. The webhook receives the recipient email, role, token, and expiry; raw tokens are only returned by the API outside production for local testing.

The process handles SIGTERM/SIGINT by closing the HTTP listener, Socket.IO server, and MongoDB connection. The default rate limiter is in-memory and must be replaced with a shared store for multi-instance deployments. Use a disposable `TEST_MONGODB_URI` or the ephemeral MongoMemoryServer test database; never point integration tests at production data.

## Staging

Use Node.js `22.12.x` or Node 24, run `npm ci`, `npm run build`, and start with `npm run start`. Set `NODE_ENV=production`, a strong `SESSION_SECRET`, the staging `MONGODB_URI`, explicit frontend/socket origins, and an HTTPS `INVITATION_DELIVERY_URL`. Validate both health endpoints, secure cookie attributes, workspace isolation, Socket.IO authentication, invitation delivery, and graceful SIGTERM shutdown before accepting staging traffic. Roll back to the previous API build and lockfile without deleting MongoDB data; restore from backup only through the approved database procedure.

### Staging environment variables

The backend requires these runtime settings. Values below are examples only; do not commit real secrets.

| Variable | Staging value | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables production cookie/security behavior. |
| `PORT` | Hosting-provider port, commonly `4000` | HTTP and Socket.IO listener port. |
| `MONGODB_URI` | Disposable/staging MongoDB Atlas connection string | Application database; never use production data for E2E. |
| `FRONTEND_ORIGIN` | Exact HTTPS frontend origin | CORS and browser session requests. |
| `SOCKET_CORS_ORIGIN` | Exact HTTPS frontend origin | Socket.IO handshake CORS; set explicitly for staging. |
| `SESSION_SECRET` | Random secret of at least 32 characters | Signs/validates session cookies. |
| `SESSION_TTL_DAYS` | `7` or the approved staging TTL | Session expiry window. |
| `SESSION_COOKIE_SAME_SITE` | `none` | Required for HTTPS Vercel-to-Render cross-site requests. |
| `SESSION_COOKIE_SECURE` | `true` | Required for production HTTPS cookies. |
| `API_RATE_LIMIT` | Approved requests/minute per IP | API abuse protection; use a shared store before multi-instance production. |
| `INVITATION_DELIVERY_URL` | HTTPS internal email webhook | Delivers invitation email requests; required for production invitations. |

`TEST_MONGODB_URI` is test-only and must not be configured as the staging runtime database. The server does not require a frontend URL or database credential in source control.
