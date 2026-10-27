# TeamFlow – MERN Stack Project

**Live Demo:** https://team-flow-project-liart.vercel.app

**GitHub Repository:** https://github.com/amansingh7475/Team-Flow-Project


# TeamFlow

TeamFlow is a React/Vite workspace UI with an independently runnable Express, TypeScript, MongoDB, Mongoose, and Socket.IO API. The repository is split into `client/` and `server/` so each deploys independently.

## Project structure

```text
Teamflow/
├── client/       React/Vite frontend, frontend tests, Playwright config
├── server/       Express/Mongoose/Socket.IO backend
├── README.md
└── .gitignore
```

Generated `dist/`, `node_modules/`, and Playwright artifacts are intentionally not moved between applications.

## Local development

1. Copy `client/.env.example` to `client/.env` for the frontend and `server/.env.example` to `server/.env`.
2. Start a disposable local MongoDB instance using the URI in `server/.env`.
3. Install and start the API:

   ```powershell
   cd server
   npm ci
   npm run dev
   ```

4. In another terminal, install and start the frontend:

   ```powershell
   cd client
   npm ci
   npm run dev
   ```

The frontend defaults to isolated localStorage mock mode. Set `VITE_DATA_MODE=api` only when the API and MongoDB are running. API mode never falls back to mock data after a request failure.

## Verification

```powershell
cd client
npm test
npm run build
npm run test:e2e
npm run test:e2e:api

cd ..\server
npm test
npm run build
```

Playwright UI tests use mock mode by default and require browser binaries:

```powershell
cd client
npx playwright install chromium
npm run test:e2e
```

API-mode smoke coverage requires a running disposable API and MongoDB database:

```powershell
cd client
$env:E2E_API_URL = 'http://127.0.0.1:4000/api/v1'
npm run test:e2e:api
```

For a staging API-mode run, use a disposable MongoDB database and a staging frontend/API pair. Set `E2E_API_URL` to the API `/api/v1` URL and, when exercising the hosted frontend, set `E2E_BASE_URL` to the staging frontend URL. Never point `TEST_MONGODB_URI` or E2E credentials at production data. The API smoke test creates a uniquely named test user/workspace and verifies session restoration, project creation, and unauthenticated denial.

Example PowerShell commands for a disposable staging environment:

```powershell
# API host, after setting the staging values from server/.env.example
cd server
npm ci
npm run build
npm run start

# Separate terminal: run API E2E against that API and its disposable database
cd ..\client
$env:E2E_API_URL = 'https://api-staging.example.com/api/v1'
$env:E2E_BASE_URL = 'https://teamflow-staging.example.com'
npm run test:e2e:api
```

The API E2E command must receive a live API URL backed by a disposable database. Use a test-safe invitation delivery configuration and never production credentials or data. For hosted frontend checks, set `E2E_BASE_URL`; Playwright will not start the local mock preview in that mode.

Build the staging frontend explicitly in API mode; `VITE_DEPLOY_ENV=staging` makes the build fail instead of silently using mock mode if either setting is missing:

```powershell
$env:VITE_DEPLOY_ENV = 'staging'
$env:VITE_DATA_MODE = 'api'
$env:VITE_API_BASE_URL = 'https://api-staging.example.com/api/v1'
$env:VITE_SOCKET_URL = 'https://api-staging.example.com'
cd client
npm run build
```

## Production configuration

Never commit `.env` files or secrets. Use a strong random `SESSION_SECRET` of at least 32 characters, a private MongoDB URI, an explicit frontend origin, and `NODE_ENV=production`. Production cookies are HTTP-only and Secure. Configure `INVITATION_DELIVERY_URL` as a trusted HTTPS email-delivery webhook; invitations are not silently converted into direct memberships. Configure `SOCKET_CORS_ORIGIN` when the Socket.IO origin differs from the frontend origin.

The API exposes `/api/v1/health` for liveness and `/api/v1/health/ready` for database readiness. Send SIGTERM/SIGINT during shutdown so the HTTP server, Socket.IO connections, and MongoDB connection close cleanly.

The current rate limiter is process-local; use a shared limiter/store before running multiple API instances. Back up MongoDB and provide TLS, secret rotation, logs, metrics, and an external email provider as part of deployment.

## Staging deployment checklist

- Use Node.js `22.12.x` or newer Node 24 within the declared engine range; run `npm ci` separately in `client/` and `server/`.
- Build with `npm run build` in both workspaces. Serve `client/dist/` through the staging web server and run the API with `npm run start` from `server/`.
- Provide a disposable staging MongoDB database, strong `SESSION_SECRET`, explicit `FRONTEND_ORIGIN`, `SOCKET_CORS_ORIGIN`, and an HTTPS invitation delivery webhook.
- Verify `/api/v1/health` and `/api/v1/health/ready`, cookie attributes, CORS, Socket.IO authentication, invitation delivery, and SIGTERM shutdown logs.
- Run the frontend tests from `client/` and backend tests from `server/` against staging-only data.

## Rollback checklist

- Stop new API instances from receiving traffic and keep the previous frontend bundle/API image available.
- Restore the previous application version using the matching lockfiles; do not run destructive database commands as part of rollback.
- Preserve the MongoDB backup and verify health/readiness before reopening traffic.
- Rotate credentials if the failed release exposed secrets, cookies, invitations, or logs.
- Confirm Socket.IO clients reconnect to the restored API and rerun smoke tests before declaring rollback complete.
