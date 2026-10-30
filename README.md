# LifePilot

## Run the frontend

Install dependencies with `npm install`, then start the Vite development server with `npm run dev`.

## Run the backend foundation

The API is a separate Node.js/Express application in `server/`. The frontend proxies `/api` requests to it during Vite development and preview.

1. Install the backend dependencies from the repository root in PowerShell:

   ```sh
   Push-Location .\server
   npm install
   Copy-Item .env.example .env
   Pop-Location
   ```

   The example values work for local development; change `FRONTEND_ORIGINS` in `server/.env` to the exact browser origin(s) you use.

2. Start the API in development mode:

   ```sh
   npm run backend:dev
   ```

   Or start it in production mode:

   ```sh
   npm run backend:start
   ```

3. In a separate terminal, run the frontend with `npm run dev`. By default, the API listens on `http://127.0.0.1:3000`; Vite proxies `/api` to that address. Set `VITE_API_PROXY_TARGET` if the backend is hosted elsewhere during local development or preview.

Test the health endpoint directly:

```sh
curl http://127.0.0.1:3000/api/health
```

Or through the frontend proxy while Vite is running:

```sh
curl http://localhost:5173/api/health
```

The expected response includes `"status":"ok"`. This endpoint checks API process health only; application data APIs are not connected yet. Production deployments must configure their frontend host to proxy `/api` to the backend and set `FRONTEND_ORIGINS` to the exact production frontend origin(s).

Run backend tests with `npm run backend:test`.

## Configure authentication

Email/password authentication uses the existing Express, PostgreSQL, and Prisma backend. Passwords are hashed with Argon2id. The API sets a random opaque, HttpOnly, SameSite=Lax cookie; only its SHA-256 token hash is stored in PostgreSQL. Sessions expire after `SESSION_TTL_DAYS` (default 7, maximum 30); choosing “Remember me” uses `SESSION_REMEMBER_TTL_DAYS` (default 30, maximum 90). Production cookies require HTTPS and receive the `Secure` attribute. Auth mutations require an exact configured `Origin`, and login/signup requests are rate limited.

Required backend environment values:

- `DATABASE_URL` — PostgreSQL URL; required in production. Production URLs must include `sslmode=require`, `verify-ca`, or `verify-full`.
- `FRONTEND_ORIGINS` — comma-separated exact browser origins authorized for CORS and authentication form submissions. Set this to the actual deployment origin(s).

Optional values:

- `NODE_ENV` — `development`, `test`, or `production`.
- `PORT` — API port (default `3000`).
- `SESSION_TTL_DAYS` — fixed session lifetime from 1 to 30 days (default `7`).
- `SESSION_REMEMBER_TTL_DAYS` — lifetime when the user selects “Remember me”, from 1 to 90 days (default `30`).
- `JSON_BODY_LIMIT` — Express JSON body size limit (default `32kb`).

No signing key, service-role key, or frontend database credential is used. Keep `DATABASE_URL` only in the backend environment. To apply the user-session schema migration and regenerate Prisma Client, run:

```powershell
npm run db:generate
npm run db:migrate:dev
```

In deployed environments use `npm run db:migrate:deploy`. Start the API and frontend as described above; authentication requests are proxied under `/api/auth`.

The existing login and signup pages now create persistent sessions against this API. Refreshing calls `GET /api/auth/me`; private frontend routes redirect to sign-in without a valid session. `POST /api/auth/logout` revokes the database session. Password reset is intentionally not implemented because no email-delivery/verification service is configured. Goal and Daily Instructor routes are described below; all private API reads and writes are scoped to `request.auth.userId`.

## Goal Instructor API

The Goal Instructor now loads goals from the authenticated API and persists roadmap edits in PostgreSQL. All endpoints require a valid LifePilot session:

- `GET /api/goals` — list the signed-in user's goals.
- `POST /api/goals` — create a goal with its user-selected duration, dates, preferences, monthly objectives, weekly objectives, daily tasks, schedules, and milestones.
- `GET /api/goals/:goalId` — retrieve one owned goal.
- `PATCH /api/goals/:goalId` — update goal details and roadmap content.
- `DELETE /api/goals/:goalId` — delete an owned goal and its dependent data.

Write requests require the configured trusted `Origin`. The API validates nested request data and scopes every query to the authenticated user. Goal progress is calculated from completed task definitions (not completion-attempt rows), and repeated completions remain in task history. When an edited roadmap removes a completed task, that task and its completion history are retained. The Prisma migration `20261030170000_goal_instructor_api` adds monthly-objective storage and goal/task scheduling metadata; apply all pending migrations with `npm run db:migrate:dev` (or `npm run db:migrate:deploy` in deployment).

The current roadmap generator is a local, category-guided template; no AI provider or AI API key is configured. No AI credentials are sent to the browser. Older goals that exist only in browser local storage are not silently assigned to an account, because that storage is not associated with a verified user. The Goal Instructor offers an explicit import action with an ownership confirmation; the original browser copy is retained, and imports are idempotent if retried.

## Daily Instructor API

Daily Instructor loads goal roadmap schedules and personal tasks for the selected date from authenticated endpoints:

- `GET /api/daily/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD` — retrieve the user's current schedules and completion history for a date range.
- `POST /api/daily/tasks` — create a personal task and schedule it.
- `PATCH /api/daily/tasks/:taskId` — update an owned task or its schedule, or record its first completion.
- `POST /api/daily/tasks/:taskId/retake` — begin a retake without changing the task's Completed status.
- `POST /api/daily/tasks/:taskId/retake/complete` — record another completion-history entry, with optional notes.
- `DELETE /api/daily/tasks/:taskId` — delete an owned personal task; goal roadmap tasks are managed in Goal Instructor.

The Daily Instructor uses the existing signed-in session and PostgreSQL persistence; it does not keep a separate local copy. Tasks remain associated with their original goals, repeated attempts are stored as separate completion records without duplicating task definitions, and goal progress continues to count task definitions rather than attempts. Schedule changes create revisions instead of removing previous schedule records. The API validates task changes, rejects time overlaps, enforces saved goal availability, and prevents a completed task from being moved back to an unfinished status. Apply the `20261030180000_daily_instructor_api` migration with the other pending migrations using `npm run db:migrate:dev` (or `npm run db:migrate:deploy` in deployment).

## Configure PostgreSQL

The backend uses PostgreSQL through Prisma. Install the backend packages and prepare its environment file from the repository root in PowerShell:

```powershell
Push-Location .\server
npm ci
Copy-Item .env.example .env
Pop-Location
```

Edit `server/.env` and replace the `DATABASE_URL` placeholders with the connection URL provided by your PostgreSQL administrator or hosting provider. Do not commit this file or put the URL in frontend environment variables. In production, the backend requires a database URL with `sslmode=require`, `sslmode=verify-ca`, or preferably `sslmode=verify-full`. Use a database role limited to this application's database, and keep credentials and production URLs in your deployment's secret manager.

The schema includes user-owned goals, milestones, weekly objectives, daily tasks, dated schedule records, task-completion attempts, preferences, Brain Training library entries, and gaming sessions. Completion attempts are separate rows linked to a single task definition; the goal-progress service counts completed task definitions, not attempt rows. The Daily Instructor schedule API creates schedule revisions and retains prior schedule records and task-completion history. Password hashes and revocable user sessions are stored in PostgreSQL; passwords are never stored in plain text. Private rows are keyed to a user and have ownership-aware foreign keys, and private feature APIs filter by the authenticated user's ID.

After setting `DATABASE_URL`, generate the Prisma Client and apply the checked-in migration to a development database:

```powershell
npm run db:generate
npm run db:migrate:dev
```

For a deployed database, apply committed migrations without creating new migrations:

```powershell
npm run db:migrate:deploy
```

Check migration status and database connectivity:

```powershell
npm run db:status
npm run db:health
```

The HTTP database health probe is also available at `GET /api/health/database`; it responds with a generic unavailable status and does not reveal connection details if the database is unconfigured or unreachable.

Test real database connectivity and create/read/update/delete behavior against the configured database:

```powershell
npm run db:test
```

This integration test creates a uniquely named temporary test user and related records, checks repeated completion attempts and distinct-task goal progress, then removes the user and its test data. Run it only against a development/test database, never production. The schema migration creates tables and constraints but does not insert a user or seed data.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
