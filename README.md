# LifePilot

## Project folders

- `frontend/` contains the React/Vite application, including `src/`, `public/`, and its `index.html`.
- `backend/` contains the Express API and backend tests.
- `database/` contains the Prisma schema for MongoDB. Previous PostgreSQL migrations are archived at `database/postgresql-migrations/` and are not used by MongoDB.
- The root `package.json` provides commands for both apps.

## Run the frontend

From the repository root, install dependencies with `npm install`, then start the Vite development server with `npm run dev`.

## Run the backend foundation

The API is a separate Node.js/Express application in `backend/`. The frontend proxies `/api` requests to it during Vite development and preview.

1. Install the backend dependencies from the repository root in PowerShell:

   ```sh
   Push-Location .\backend
   npm install
   Copy-Item .env.example .env
   Pop-Location
   ```

   The example values work for local development; change `FRONTEND_ORIGINS` in `backend/.env` to the exact browser origin(s) you use.

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

The expected response includes `"status":"ok"`. This endpoint checks API process health only; use `GET /api/health/database` to verify MongoDB separately. Production deployments must configure their frontend host to proxy `/api` to the backend and set `FRONTEND_ORIGINS` to the exact production frontend origin(s).

Run backend tests with `npm run backend:test`.

## Configure authentication

Email/password authentication uses the existing Express and Prisma backend with MongoDB Community Server. Passwords are hashed with Argon2id. The API sets a random opaque, HttpOnly, SameSite=Lax cookie; only its SHA-256 token hash is stored in MongoDB. Sessions expire after `SESSION_TTL_DAYS` (default 7, maximum 30); choosing “Remember me” uses `SESSION_REMEMBER_TTL_DAYS` (default 30, maximum 90). Production cookies require HTTPS and receive the `Secure` attribute. Auth mutations require an exact configured `Origin`, and login/signup requests are rate limited.

Required backend environment values:

- `DATABASE_URL` — local MongoDB URI, for example `mongodb://127.0.0.1:27017/lifepilot`. Keep credentials private if authentication is enabled.
- `FRONTEND_ORIGINS` — comma-separated exact browser origins authorized for CORS and authentication form submissions. Set this to the actual deployment origin(s).

Optional values:

- `NODE_ENV` — `development`, `test`, or `production`.
- `PORT` — API port (default `3000`).
- `SESSION_TTL_DAYS` — fixed session lifetime from 1 to 30 days (default `7`).
- `SESSION_REMEMBER_TTL_DAYS` — lifetime when the user selects “Remember me”, from 1 to 90 days (default `30`).
- `JSON_BODY_LIMIT` — Express JSON body size limit (default `32kb`).

No signing key, service-role key, or frontend database credential is used. Keep `DATABASE_URL` only in `backend/.env`. Generate the Prisma Client and synchronize MongoDB collections and indexes from the schema with:

```powershell
npm run db:generate
npm run db:push
```

MongoDB uses schema synchronization rather than SQL migrations. Start the API and frontend as described above; authentication requests are proxied under `/api/auth`.

The existing login and signup pages now create persistent sessions against this API. Refreshing calls `GET /api/auth/me`; private frontend routes redirect to sign-in without a valid session. `POST /api/auth/logout` revokes the database session. Password reset is intentionally not implemented because no email-delivery/verification service is configured. Goal and Daily Instructor routes are described below; all private API reads and writes are scoped to `request.auth.userId`.

## Gaming Session library

Gaming Session combines brain-training and entertainment categories. Built-in and account-added games open a Google search for `play <game name> online` in a new tab; custom games do not need a playable URL or API key. Signed-in users can add/edit/delete their own games, favorite built-in or custom games, and see recently played games. Custom games and image URLs or small uploaded logos are stored in MongoDB; favorites and recent-play timestamps are stored per user in `user_game_preferences`.

The authenticated API is `GET/POST /api/games`, `PATCH/DELETE /api/games/:gameId`, and `PATCH /api/games/preferences/:gameKey`. Apply schema changes with `npm run db:push`.

## Goal Instructor API

The Goal Instructor now loads goals from the authenticated API and persists roadmap edits in MongoDB. All endpoints require a valid LifePilot session:

- `GET /api/goals` — list the signed-in user's goals.
- `POST /api/goals` — create a goal with its user-selected duration, dates, preferences, monthly objectives, weekly objectives, daily tasks, schedules, and milestones.
- `GET /api/goals/:goalId` — retrieve one owned goal.
- `PATCH /api/goals/:goalId` — update goal details and roadmap content.
- `DELETE /api/goals/:goalId` — delete an owned goal and its dependent data.

Write requests require the configured trusted `Origin`. The API validates nested request data and scopes every query to the authenticated user. Goal progress is calculated from completed task definitions (not completion-attempt rows), and repeated completions remain in task history. When an edited roadmap removes a completed task, that task and its completion history are retained. The MongoDB schema is in `database/schema.prisma`; run `npm run db:push` after schema changes.

The current roadmap generator is a local, category-guided template; no AI provider or AI API key is configured. No AI credentials are sent to the browser. Older goals that exist only in browser local storage are not silently assigned to an account, because that storage is not associated with a verified user. The Goal Instructor offers an explicit import action with an ownership confirmation; the original browser copy is retained, and imports are idempotent if retried.

## Daily Instructor API

Daily Instructor loads goal roadmap schedules and personal tasks for the selected date from authenticated endpoints:

- `GET /api/daily/tasks?from=YYYY-MM-DD&to=YYYY-MM-DD` — retrieve the user's current schedules and completion history for a date range.
- `POST /api/daily/tasks` — create a personal task and schedule it.
- `PATCH /api/daily/tasks/:taskId` — update an owned task or its schedule, or record its first completion.
- `POST /api/daily/tasks/:taskId/retake` — begin a retake without changing the task's Completed status.
- `POST /api/daily/tasks/:taskId/retake/complete` — record another completion-history entry, with optional notes.
- `DELETE /api/daily/tasks/:taskId` — delete an owned personal task; goal roadmap tasks are managed in Goal Instructor.

The Daily Instructor uses the existing signed-in session and MongoDB persistence; it does not keep a separate local copy. Tasks remain associated with their original goals, repeated attempts are stored as separate completion records without duplicating task definitions, and goal progress continues to count task definitions rather than attempts. Schedule changes create revisions instead of removing previous schedule records. The API validates task changes, rejects time overlaps, enforces saved goal availability, and prevents a completed task from being moved back to an unfinished status. Run `npm run db:push` after schema changes.

## Configure and verify local MongoDB Community Server

MongoDB Compass is the client UI; the MongoDB Community Server service must also be installed and running. Prisma's MongoDB connector requires a replica set for transactions used by the application, including signup. For a local single-node replica set:

1. Open the MongoDB service configuration file as Administrator (commonly `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg`) and add:

   ```yaml
   replication:
     replSetName: rs0
   ```

2. Restart MongoDB from an Administrator PowerShell:

   ```powershell
   Restart-Service MongoDB
   ```

3. Initialize the replica set once:

   ```powershell
   mongosh "mongodb://127.0.0.1:27017/admin" --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
   ```

   Confirm it becomes primary with `mongosh "mongodb://127.0.0.1:27017/admin" --eval "rs.status().myState"`. The result should be `1`.

The schema is in `database/schema.prisma`; the backend loads its environment from `backend/.env`. Install backend packages and prepare the environment file from the repository root in PowerShell:

```powershell
Push-Location .\backend
npm ci
Copy-Item .env.example .env
Pop-Location
```

Edit `backend/.env` and set `DATABASE_URL=mongodb://127.0.0.1:27017/lifepilot`. Never commit this file or put the URI in frontend environment variables.

The schema includes users, sessions, goals, milestones, weekly objectives, daily tasks, schedules, completion attempts, preferences, Brain Training entries, and gaming sessions. Records use MongoDB ObjectIds. Completion attempts are separate records linked to one task definition, and goal progress counts completed task definitions rather than attempts. Passwords are hashed, and private API queries are scoped to the authenticated user.

Generate the Prisma Client, sync the schema, and run a real health check plus a sample create/read:

```powershell
npm run db:generate
npm run db:push
npm run db:health
npm run db:record-test
npm run db:test
```

MongoDB uses schema synchronization rather than SQL migrations. Previous PostgreSQL SQL migrations are retained in `database/postgresql-migrations/` for reference only; they are not applied to MongoDB.

`db:record-test` creates a uniquely named record in `database_connection_checks`, retrieves it, and leaves it in place for inspection. It does not overwrite or delete existing data. The live health endpoint is `GET /api/health/database`; treat the connection as verified only when it returns `{"status":"ok","database":"mongodb"}`.

`db:test` runs a live CRUD and ownership integration test. It creates a uniquely named test user and related records, then deletes only that test user's data; run it against a development/test database, not production.

Start the backend and frontend in separate terminals with `npm run backend:dev` and `npm run dev`. To view the sample in MongoDB Compass, connect to `mongodb://127.0.0.1:27017`, open the `lifepilot` database, and select the `database_connection_checks` collection.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
