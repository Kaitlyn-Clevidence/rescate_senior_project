# Rescate de San Carlos: ePCR 2.0 (prototype)

Rewrite of the Rescate patient care report system. The current goal is the P4 prototype: prove the stack end to end, from database to API to web page.

```
Browser (React + Vite)  →  Fastify routes  →  Repositories (Kysely)  →  MySQL 8 (Docker)
```

## Current Status

- **Database:** MySQL 8.4 in Docker. The SQL files in `apps/api/migrations/` create all the tables (patients, charts, and the chart sections, notes, attachments, audit log and more), and the seed files in `apps/api/seeds/` add sample data (today: 4 patients and 16 charts). Setup runs every migration and then every seed file, in order (see step 4 below).
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
4. Create the tables and load sample data. This runs **every migration** in `apps/api/migrations/` in number order, then **every seed file** in `apps/api/seeds/` in number order. Use the loops below instead of naming files one by one, so a new migration or seed file is picked up without changing this README:
   ```bash
   for f in apps/api/migrations/*.sql; do
     docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" rescate' < "$f" || break
   done
   ```
   ```bash
   for f in apps/api/seeds/*.sql; do
     docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" rescate' < "$f" || break
   done
   ```
   **Windows PowerShell:** 
   ```powershell
   Get-ChildItem .\apps\api\migrations\*.sql | Sort-Object Name | ForEach-Object {
     Get-Content -Raw $_.FullName | docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" rescate'
   }
   Get-ChildItem .\apps\api\seeds\*.sql | Sort-Object Name | ForEach-Object {
     Get-Content -Raw $_.FullName | docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" rescate'
   }
   ```

   **Important:** this is for a **new, empty database**. The migrations add and drop columns, so running them again on a database that already has the tables fails with errors like `Duplicate column name`. To start over cleanly, wipe the data first (`docker compose down -v`, then `docker compose up -d`, wait for `healthy`) and repeat this step. If you already have a database and a new migration arrives, run only that one file, or wipe and redo this step.

   The files are run in file-name order, so migration names must keep the zero-padded number (`0001_`, `0002_`, ...). Numbers can have gaps (for example `0004` lives on another branch until it is merged); the loop runs whatever is in the folder.

   **Seed files work the same way.** Every `.sql` file in `apps/api/seeds/` runs in file-name order (`001_`, `002_`, ...), after all the migrations, so adding a seed file needs no change here. Keep the zero-padded number. Two rules for seed files:
   - Each file should stand on its own. The current `001_prototype_seed.sql` starts by emptying `charts` and `patients`, so a later file must not empty those tables again or it would erase what an earlier file loaded.
   - Unlike migrations, seed files are safe to run again on an existing database as long as they empty the tables they fill. If a seed file fails, the loop stops there and the files after it do not run.

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
| `/charts` says "Unknown column" | Tables are missing or old (a migration did not run). Run `docker compose down -v`, start again, and redo step 4 |
| Step 4 prints `Duplicate column name` or `Can't DROP` | The migrations were already applied to this database. Wipe it (`docker compose down -v`, then `docker compose up -d`) and redo step 4 |
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