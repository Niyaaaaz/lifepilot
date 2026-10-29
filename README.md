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

The expected response includes `"status":"ok"`. The endpoint currently verifies API process health only; no database or application features are connected yet. Production deployments must configure their frontend host to proxy `/api` to the backend and set `FRONTEND_ORIGINS` to the exact production frontend origin(s).

Run backend tests with `npm run backend:test`.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
