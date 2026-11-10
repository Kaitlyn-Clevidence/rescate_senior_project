# Rescate de San Carlos: ePCR 2.0 (prototype)

Rewrite of the Rescate patient care report system. The current goal is the P4 prototype: prove the stack end to end, from database to API to web page.

```
Browser (React + Vite)  →  Fastify routes  →  Repositories (Kysely)  →  MySQL 8 (Docker)
```

## Current Status

- **Database:** MySQL 8.4 in Docker. `0001_init.sql` creates `patients` and `charts`, and a seed file adds 4 patients and a few charts.
- **API (`apps/api`):** Fastify with Kysely for queries.
  - `GET /charts` and `GET /charts/:id`
  - `GET /patients/:id`
  - `GET /patients/:id/charts`
  - Ids are validated as integers (1 or more), unknown ids return 404, and CORS is limited to the web app's address.
- **Web (`apps/web`):** React + Vite + TypeScript.
  - Look up by **patient number** (patient details plus all their charts) or **chart number** (one chart).
  - Dates are shown in readable form.
  - English/Spanish switch.
  - Light / Dark / Auto theme. Colors come from variables in `src/index.css`.
  - The last result is cached in the browser for 30 minutes.

## How to Run

Requires Docker Desktop (running) and Node 24 or newer.

**One-time setup**

1. Create your env file, and set a dev password inside it:
   ```bash
   cp .env.example .env
   ```
   **Windows PowerShell:**
   ```powershell
   Copy-Item .env.example .env
   ```
2. Install dependencies:
   ```bash
   (cd apps/api && npm install)
   ```
   ```bash
   (cd apps/web && npm install)
   ```
   **Windows PowerShell:**
   ```powershell
   npm --prefix .\apps\api install
   npm --prefix .\apps\web install
   ```
3. Start the database and wait until `db` shows `healthy`:
   ```bash
   docker compose up -d
   docker compose ps
   ```
4. Create the tables and load sample data:
   ```bash
   docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" rescate' < apps/api/migrations/0001_init.sql
   ```
   ```bash
   docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" rescate' < apps/api/seeds/001_prototype_seed.sql
   ```
   **Windows PowerShell:** 
   ```powershell
   Get-Content -Raw .\apps\api\migrations\0001_init.sql | docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" rescate'
   Get-Content -Raw .\apps\api\seeds\001_prototype_seed.sql | docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" rescate'
   ```

**Every time (two terminals)**

```bash
cd apps/api && npm run dev     # API on http://127.0.0.1:3000
```
```bash
cd apps/web && npm run dev     # web on http://localhost:5173
```
**Windows PowerShell:** Run these in separate terminals:
```powershell
Set-Location .\apps\api
npm run dev
```
```powershell
Set-Location .\apps\web
npm run dev
```

Open **http://localhost:5173**. The web app sends `/api/...` requests to the API through Vite's proxy, which strips the `/api` prefix.

**Quick checks:** `http://127.0.0.1:3000/charts` and `http://127.0.0.1:3000/patients/1` should return JSON.

## Lint and typecheck

Run these before opening a PR. A clean run prints nothing.

**Web** (`apps/web`)
```bash
cd apps/web && npm run lint
```
This runs oxlint with the rules in `.oxlintrc.json` (React hooks rules and the React/TypeScript plugins). It prints nothing when it passes.
```bash
cd apps/web && npx tsc -b
```
This typechecks the app. `npm run build` also runs it before building.
**Windows PowerShell:**
```powershell
Set-Location .\apps\web
npm run lint
npx tsc -b
```

**API** (`apps/api`)
```bash
cd apps/api && npx tsc --noEmit
```
The API has no linter yet, only the typecheck. It reports type errors and doesn't write any files.
**Windows PowerShell:**
```powershell
Set-Location .\apps\api
npx tsc --noEmit
```

Imports of files must end in `.js` (for example `./http/app.js`), even though the files are `.ts`. The TypeScript settings require it, and a missing extension is the most common typecheck error.

## Troubleshooting

| Problem | Fix |
|---|---|
| API exits naming a missing env variable | Check that `.env` exists in the repo root and has every value from `.env.example` |
| `ECONNREFUSED ::1` | Set `DB_HOST=127.0.0.1` in `.env` |
| `/charts` says "Unknown column" | Tables are missing or old. Run `docker compose down -v`, start again, and redo step 4 |
| Web page doesn't match the API | Clear the `rescate:last-record` key in the browser's Local Storage (the app caches results) |
| `.env` changed after the first start | The password inside the database won't update. Wipe with `docker compose down -v` first |

Other database commands: `docker compose down` stops the database and keeps the data. `docker compose down -v` deletes the data.

## Layout

```
apps/api/    Fastify API  (src/config, src/db, src/http, src/repositories, migrations/, seeds/)
apps/web/    React app
docs/        prototype plan, repo map, to-do list
legacy/      read-only copy of the old system
```