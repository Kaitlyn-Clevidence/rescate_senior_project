# Rescate ePCR: master to-do list

**Conventions**
- `[ ]` open 
- IDs like `P1-07` are stable for citation
- Size: **S** ≤ half a day · **M** ≈ 1–2 days · **L** ≈ 3–5 days · **XL** > 1 week (may need to split).
- `Reqs:` the FR/NFR IDs the task serves. 
- `Dep:` tasks that must finish first. 
- `Done when:` the check that closes it.
- Every PR needs a reviewer other than the author (NFR15).

---

## Phase 0: Foundations and safety net
### 0.1 Repository and process
- [x] **P0-01 (S)** Create a `legacy/` snapshot tag on current `main` (`git tag legacy-v1`) so the old code is always recoverable. *Done when:* tag pushed.
- [ ] **P0-02 (S)** Decide repo layout such as`apps/api`, `apps/web`, `packages/shared` (types, permission map, option codes), `docs/`, `scripts/`, `legacy/` (read-only copy of `backend/` and `frontend/`). Ensure there is documentation in `docs/`.
- [x] **P0-03 (S)** Protect `main`: require 1 approving review, require status checks, block force-push. Reqs: NFR15.
- [x] **P0-04 (S)** Add PR template with checklist (tests added, requirement IDs, migration included, translations added, accessibility checked).
- [ ] **P0-05 (S)** Add `CODEOWNERS` (security-sensitive paths: `auth/`, `policy/`, `migrations/`, `audit/`).
- [ ] **P0-06 (S)** Add `.editorconfig`, Prettier, ESLint (typescript-eslint, jsx-a11y), and a `lint-staged` + Husky pre-commit hook.
- [x] **P0-07 (S)** Remove committed noise: `frontend/epcr-system/debug.log`, build artifacts; extend `.gitignore` (`.env`, `attachments/`, coverage, `dist/`).
- [ ] **P0-08 (M)** GitHub Actions CI: install, lint, typecheck, unit tests with coverage threshold (70% backend), integration tests against a service container database, build. Reqs: NFR14.
- [ ] **P0-09 (S)** Dependabot (or Renovate) for npm and GitHub Actions.
- [ ] **P0-10 (S)** Secret scanning and `gitleaks` in CI; confirm no real `.env`, passwords or JWT secrets are in git history (`git log -p -S"JWT_SECRET"`). If any are found, rotate them.
- [ ] **P0-11 (S)** Issue labels and a project board: `phase-0` … `phase-8`, `security`, `legacy-fix`, `migration`, `a11y`, `i18n`, `blocked`.
- [ ] **P0-12 (S)** Definition of done (written): tests, docs, translations EN+ES, a11y check, audit event where PHI is touched, requirement ID in the PR.
- [x] Ensure `main` is not the default branch and must be actively edited or merged for changes

### 0.2 Legacy audit (turn assumptions into facts)
- [ ] **P0-20 (M)** Stand up the legacy system locally exactly as the README says (MySQL, backend `nodemon app.js`, frontend `npm start`). Go through each (pre existing) use case and record any problems in `docs/`.
- [ ] **P0-21 (M)** Get a sanitized copy of production data (names, phones and addresses scrambled) or a seeded realistic dataset. Never put real PHI in git or on laptops without approval. (Reach out to Bryan but have a plan on how to get it, he does not have technical background)
- [ ] **P0-22 (M)** Data profiling script: row counts per table, null rates per `charts` column, distinct values for every categorical column (`call_type`, `call_nature`, `location`, `disposition`, `destination`, `trauma_cause`, `care_level`, `p_classify`, `gender`), min/max dates, and the parse success rate of JSON-ish columns (`medications`, `procedures`, `vital_signs`, `obstetrics`). Output `docs/legacy-data-profile.md`.
- [ ] **P0-23 (S)** List every legacy API endpoint with method, auth requirement and who calls it (frontend file and line). Output a table. *Starting point:* `routes/router.js`, `charts/router.js`, `users/router.js`, `notes/router.js`, `patients/router.js`.
- [ ] **P0-24 (S)** Inventory legacy frontend screens: route, component, API calls, role visibility. Output a table. *Starting point:* `App.js` route list.
- [ ] **P0-25 (M)** Extract the complete chart field list from `sql/database.js` and `ChartForm`, `AddCall`, `AddPatient`, `AddInterventions`, `PhysicalAssessment`, `Popup`, `Confirm`. Label each field: visit type (clinic / ambulance / both), required or optional, input type, option list, Spanish label, English label. Output `docs/field-inventory.csv`. This is the seed for form definitions.
- [ ] **P0-26 (M)** Walk through both workflows with a provider (clinic visit and ambulance call) and record which fields they actually use. Ask which fields they would drop. Reqs: FR5, FR6, NFR12.
- [ ] **P0-27 (S)** Extract every Spanish string stored as data, from `summary()` in `charts/repository.js` and the frontend option lists, into `docs/option-codes.csv` (column: legacy string, proposed code, EN label, ES label).
- [ ] **P0-28 (S)** Read `backend/pdf/index.js` and the locale JSON files and list what the printed chart looks like. Get a sample PDF from the sponsor to preserve layout expectations.
- [ ] **P0-29 (S)** Run `npm audit` on both legacy `package.json` files; record critical items. Note Node version the legacy code needs.
- [ ] **P0-30 (M)** Security findings list (already known, confirm each by reproducing on a local copy). Each becomes a ticket in 0.3 or a regression test in the new code:
  - SQL injection: `login`, `register`, `forgot` (`routes/repository.js`), `rate_limiter.js`, `viewChart`, `viewPatientChart`, `summary`, `calls` (`charts/repository.js`), `notes/repository.js`.
  - Unauthenticated routes: `POST /charts/upload/:id`, `POST /charts/files/:id`, `GET /charts/download/:id/:file`, `GET /charts/:id/pdfTest`.
  - Path traversal via `chartId` and `file` in `path.join`.
  - `GET /charts` and `/charts/patients` have no role scoping.
  - `POST /charts/:id/update` can edit any chart, and uses `req.params` as the id (object, not string).
  - `jwtCookie()` in `App.js` sets `auth` true even on failure.
  - JWT lifetime 24 h, no idle timeout, no revocation.
  - Password policy absent; reset link 1 h.
  - `logout` clears the cookie but the token stays valid until expiry.
  - Rate limiter keyed on IP only and fails open on errors.
  - CORS origin hard-coded to localhost.

### 0.4 Backups before anything else (FR10, NFR9)
- [ ] **P0-31 (S)** Write `scripts/backup-legacy.sh`: `mysqldump --single-transaction --routines` plus a copy of `backend/attachments/`, compressed, with a SHA-256 checksum file.
- [ ] **P0-32 (M)** Restore test: restore the dump into a scratch MySQL, compare row counts per table and a checksum of a sample of rows. Document the procedure. *Done when:* a second person repeats it from the doc.
- [ ] **P0-33 (S)** Store backups encrypted (age/gpg) in at least two places; document key custody.
- [ ] **P0-34 (S)** Schedule daily backups of legacy (cron or host snapshot) until cutover.

### 0.5 Decisions to record (ADRs in `docs/adr/`)
- [ ] **P0-35 (S)** ADR-001: architecture (Option A with offline seams, then B).
- [ ] **P0-36 (S)** ADR-002: database engine. Keep MySQL 8 (JSON columns, easier ETL) vs move to PostgreSQL (JSONB, GIN indexes, `pg_trgm`). Decide with the sponsor's hosting constraints.
- [ ] **P0-37 (S)** ADR-003: backend framework and language (TypeScript + Express vs Fastify; Prisma vs Knex).
- [ ] **P0-38 (S)** ADR-004: frontend stack (React 18 + Vite + TypeScript, UI library, state/query library, i18n, chart library).
- [ ] **P0-39 (S)** ADR-005: session strategy (cookie session with server-side store vs short JWT + refresh).
- [ ] **P0-40 (S)** ADR-006: hosting and data residency (where PHI lives, BAA or equivalent, budget). Confirm NOM-024-SSA3-2012 obligations with the sponsor.
- [ ] **P0-41 (S)** ADR-007: file storage (S3-compatible, MinIO or encrypted disk) and encryption approach.
- [ ] **P0-42 (S)** ADR-008: the immutability model (app guard + DB rule/trigger + content hash).

---

## Phase 1: Data layer and migration (FR10, NFR2, NFR9)

### 1.1 New schema
- [ ] **P1-01 (M)** Draft the ER model: `users`, `auth_tokens`, `patients`, `charts`, `chart_drafts`, `addenda`, `form_definitions`, `attachments`, `audit_log`, `legacy_id_map`. Review with the team.
- [ ] **P1-02 (S)** Choose ID strategy
- [ ] **P1-03 (M)** Choose and set up the migration tool (Prisma Migrate / Knex / Flyway). First migration creates all tables with keys, foreign keys and `NOT NULL`s.
- [ ] **P1-04 (M)** `charts`: indexed columns `incident_date`, `visit_type`, `incident_type`, `patient_id`, `author_id`, `status`, `submitted_at`, `is_practice`; `data` JSON(B) for the rest. Add composite index for dashboard filters.
- [ ] **P1-05 (M)** Patient search: index `last_name`, `first_name`, `birth_date`; add trigram or full-text index for fuzzy search. Reqs: NFR2.
- [ ] **P1-06 (S)** Immutability: DB trigger or rule that rejects `UPDATE`/`DELETE` on rows in `charts` and `addenda`; a test proves it. Reqs: FR12.
- [ ] **P1-07 (S)** `audit_log` is append-only (revoke `UPDATE`/`DELETE` for the app DB user).
- [ ] **P1-08 (S)** Create separate DB roles: `app_rw` (no DDL), `migrator` (DDL), `reporting_ro` (read replica/reports), `backup`.
- [ ] **P1-09 (M)** Seed data: roles, an admin user, `form_definitions` v1 for clinic and ambulance, option-code tables, a few fake patients and charts for dev.
- [ ] **P1-10 (S)** A `make db-reset` (or npm script) that creates, migrates and seeds a local DB in one command.

### 1.2 Option codes and form definitions
- [ ] **P1-20 (M)** Finalize `option-codes` from P0-27 into a versioned JSON in `packages/shared/options/` (code → `{en, es}`), e.g. `sex.male`, `disposition.transport`, `destination.imss`.
- [ ] **P1-21 (L)** Turn `field-inventory.csv` into `form_definition` JSON for **clinic** and **ambulance**: sections, fields, types, requiredness, visibility rules, option sets, i18n keys.
- [ ] **P1-22 (M)** JSON Schema (or zod) for the form-definition format, and a validator used at seed time and by the admin editor later.
- [ ] **P1-23 (S)** Split sections so none exceeds 10 core fields per screen (NFR12); script that fails CI if a section exceeds it.
- [ ] **P1-24 (S)** Medication list file (EN/ES names) placeholder for FR31 later.

### 1.3 ETL from legacy
- [ ] **P1-30 (S)** `scripts/etl/` project skeleton with config (source DB read-only, target DB), a dry-run flag, and structured logs.
- [ ] **P1-31 (M)** `extractor`: stream rows from legacy tables with pagination; read-only connection; no writes.
- [ ] **P1-32 (L)** `transform.patients`: map `fname`/`lname`/`birth`/`gender` → `first_name`/`last_name`/`birth_date`/`sex_code`. Parse `birth` strings (`VARCHAR(30)`) with multiple formats; log failures.
- [ ] **P1-33 (XL)** `transform.charts`: move indexed fields (`incident_date`, `call_type`, `call_nature`, `trauma_cause`, `disposition`, `destination`, …) to columns; everything else into `data` keyed by field key.
  - [ ] Convert Spanish display strings to option codes via the mapping; unmapped values stay in `data._unmapped` and are counted.
  - [ ] Parse `medications`, `procedures`, `vital_signs`, `obstetrics`, `ambulance_crew` text columns into structured arrays; keep the original text under `data._raw` when parsing fails.
  - [ ] Convert `DATETIME` columns from UTC (the legacy pool uses `timezone: 'utc'`) and record the clinic timezone assumption.
  - [ ] Set `status = submitted`, `form_version = 0` (legacy), `is_practice = false`, `legacy_id`.
- [ ] **P1-34 (M)** `transform.notes → addenda`: keep author name, certifications, date; link to the migrated chart. Users may not exist for every note author, so store `author_name` text plus nullable `author_id`.
- [ ] **P1-35 (M)** `transform.users`: carry over `username`, `email`, `name`, `phone`, `certifications`; map `privilege` → role (`admin` → Admin, `standard` → Provider by default); **do not copy password hashes** unless the team decides bcrypt hashes remain acceptable. Prefer forcing a password reset on first login.
- [ ] **P1-36 (M)** `transform.attachments`: scan `attachments/<chartId>/`, copy to the new storage with new keys, compute SHA-256, record mime/size, flag files over limits or of disallowed types.
- [ ] **P1-37 (S)** `legacy_id_map` table (entity, legacy id, new id) written by the loader so a re-run is idempotent.
- [ ] **P1-38 (M)** `loader`: batch inserts inside transactions, idempotent via `legacy_id_map`, resumable after failure.
- [ ] **P1-39 (L)** `verify`:
  - [ ] Row counts per entity and per incident year match.
  - [ ] Field-by-field comparison on a random sample (e.g. 500 charts) plus all charts with unusual values.
  - [ ] Every attachment hash matches.
  - [ ] Report of unmapped values, parse failures and orphan rows (charts without patients and vice versa).
  - Output: `reports/etl-<timestamp>.md`. *Done when:* the report shows zero unexplained differences. Reqs: FR10.
- [ ] **P1-40 (S)** Backup gate: the ETL refuses to run unless a verified backup newer than N minutes exists (checks the checksum file from P0-50). Reqs: FR10, NFR9.
- [ ] **P1-41 (M)** Performance test of the ETL on production-sized data; document run time (needed for the cutover window).
- [ ] **P1-42 (S)** Rehearse the ETL end to end at least twice before cutover, from backup restore through verify.

---

## Phase 2: Backend core (apps/api)

### 2.1 Scaffolding
- [ ] **P2-01 (M)** TypeScript project, `tsconfig` strict, path aliases, build and dev scripts, health endpoint `/healthz`.
- [ ] **P2-02 (M)** Config module: typed env loading with validation (zod); startup fails on missing secrets; separate `.env.example` with no real values.
- [ ] **P2-03 (S)** Logging (pino) with request IDs; redact passwords, tokens and PHI fields from logs.
- [ ] **P2-04 (S)** Central error handler: consistent JSON errors, no stack traces in production, no internal error text to clients (legacy returns raw `err`).
- [ ] **P2-05 (S)** Security middleware: `helmet` (legacy lists it but never uses it), strict CORS from config, body size limits, `HttpOnly`/`Secure`/`SameSite` cookies.
- [ ] **P2-06 (M)** Request validation middleware using zod schemas per route.
- [ ] **P2-07 (S)** Database module: connection pool, transaction helper, graceful shutdown.
- [ ] **P2-08 (S)** Module template (`routes`, `service`, `repository`, `schemas`, `tests`) so every module looks the same.
- [ ] **P2-09 (S)** OpenAPI spec generated from the zod schemas; served at `/docs` in development only.
- [ ] **P2-10 (S)** Test harness: Vitest or Jest, supertest, a test database that is reset per run, factory helpers for users/charts.

### 2.2 Authentication and sessions (FR1, FR3, FR4, NFR6, NFR7)
- [ ] **P2-20 (M)** Password hashing util: Argon2id (or bcrypt cost ≥12); unit tests include timing-safe compare.
- [ ] **P2-21 (S)** Password policy validator: ≥12 chars, at least one special character; also reject common passwords list. Shared with the frontend via `packages/shared`.
- [ ] **P2-22 (M)** `POST /auth/login`: constant-time on unknown user; generic error message; lockout or backoff after N failures; audit event.
- [ ] **P2-23 (M)** Sessions: server-side session store keyed by random ID, 15-minute sliding idle timeout, absolute max (e.g. 12 h), rotate ID at login. Reqs: NFR7.
- [ ] **P2-24 (S)** `POST /auth/logout` destroys the session server-side (legacy only clears the cookie).
- [ ] **P2-25 (S)** CSRF protection (double-submit token or SameSite=strict plus custom header) for state-changing routes.
- [ ] **P2-26 (M)** `auth_tokens` table logic: generate random token, store only its hash, 10-minute expiry, single use. Reqs: FR3, FR4.
- [ ] **P2-27 (M)** `POST /auth/setup` (complete account setup) and `POST /auth/reset/request`, `POST /auth/reset/confirm`. Request endpoint always returns the same response whether or not the email exists.
- [ ] **P2-28 (S)** Admin-triggered reset for any user (FR4): `POST /users/:id/reset`.
- [ ] **P2-29 (S)** Rate limit login and reset endpoints (library, with Redis or in-memory store; fail closed).
- [ ] **P2-30 (S)** `GET /auth/me` returns the user, role and permissions for the client.
- [ ] **P2-31 (M)** Tests: expired link at 10:01 rejected; link at 9:59 works; second use rejected; user can log in right after reset; idle at 15:01 returns 401; password policy cases.

### 2.3 Authorization (FR2)
- [ ] **P2-40 (M)** Permission map in `packages/shared`: roles Admin, Provider, Board, Trainee × permissions (`chart.create`, `chart.read`, `chart.search`, `addendum.create`, `dashboard.read`, `user.manage`, `form.manage`, `export.read`, `audit.read`, `settings.manage`). Source of truth for client and server.
- [ ] **P2-41 (M)** `authorize(permission)` middleware; default deny; every route must declare a permission (a test fails if a route lacks one).
- [ ] **P2-42 (M)** Row-level rules in services: Provider sees all real charts; Trainee only their own `is_practice` charts; Board never receives chart-level data, only aggregates.
- [ ] **P2-43 (M)** Matrix test: for every role × every route, assert allowed/denied and the denial message (FR2 acceptance).
- [ ] **P2-44 (S)** Access-denied responses (403) with a stable error code the client can display in EN/ES.

### 2.4 Users and accounts (FR1, FR3)
- [ ] **P2-50 (M)** `POST /users` (admin): create with email, name, role; creates a setup token and sends the email.
- [ ] **P2-51 (S)** `PATCH /users/:id` (admin): change role, activate/deactivate; audit the change.
- [ ] **P2-52 (S)** `GET /users`, `GET /users/:id` with role-based field limits (Board/Provider see names only if needed).
- [ ] **P2-53 (S)** Self-service `PATCH /users/me` (language preference, phone, display name). Reqs: FR8.
- [ ] **P2-54 (S)** Never hard-delete users who authored charts; deactivate instead. Replace the legacy `deleteUser` and `deleteSelf` behavior.
- [ ] **P2-55 (M)** Provider certifications field (legacy `certifications`, shown on notes): keep as a user attribute, snapshot onto chart and addendum at write time.
- [ ] **P2-56 (M)** Mail service: SMTP provider config (replace the personal Gmail account), HTML+text templates in EN/ES, link built from `FRONTEND_URL`, send failures logged and surfaced to the admin.

### 2.5 Forms (FR5, FR6, FR30, NFR12)
- [ ] **P2-60 (M)** `GET /forms/:visitType` returns the active form definition plus option labels in the requested language.
- [ ] **P2-61 (M)** Form validation engine: given a definition and `data`, return field-level errors (required, type, ranges, option membership, conditional visibility).
- [ ] **P2-62 (S)** Ensure fields not in the selected visit type's definition are rejected (FR6: "no unnecessary fields").
- [ ] **P2-63 (M)** Admin endpoints to add a timestamp or text field to a form (creates a new version; old charts keep their version). Reqs: FR30.
- [ ] **P2-64 (S)** Version rules: new version never alters existing charts; a chart stores `form_version`.
- [ ] **P2-65 (M)** Unit tests for each validation rule and for the clinic vs ambulance field separation (FR5).

### 2.6 Charts, drafts, addenda (FR7, FR12, FR13)
- [ ] **P2-70 (M)** Drafts: `PUT /drafts/:id` upsert (owner only), `GET /drafts/:id`, `GET /drafts` (own), `DELETE /drafts/:id`; store with `expires_at`; touching extends TTL. Reqs: FR13.
- [ ] **P2-71 (S)** Draft cleanup job removes expired drafts (and the policy for what "expired" means; at least 5 minutes of recoverability, longer is fine).
- [ ] **P2-72 (L)** `POST /charts` (submit from draft): validate with the form definition, create the patient or link an existing one, write the chart in one transaction, delete the draft, write an audit event.
- [ ] **P2-73 (M)** Trainee path: same flow but `is_practice = true`, never visible to Providers' lists, dashboards or exports.
- [ ] **P2-74 (M)** `GET /charts/:id`: role-checked, audits the read (who looked at which chart), returns the form version used and labels.
- [ ] **P2-75 (L)** `GET /charts` search: filters (patient name, date range, visit type, incident type, author), pagination, sort; uses indexes; response time ≤ 2 s at 50,000 rows (NFR2); add a benchmark script.
- [ ] **P2-76 (M)** No update or delete route for charts. A test asserts `PUT/PATCH/DELETE /charts/:id` return 404/405 and the DB trigger blocks direct updates. Reqs: FR12.
- [ ] **P2-77 (M)** `POST /charts/:id/addenda`, `GET /charts/:id/addenda`. Providers and Admins only. Store author, role snapshot, certifications snapshot, timestamp. Reqs: FR7, FR12.
- [ ] **P2-78 (S)** Patient lookup/link when starting a chart (avoid duplicate patients); simple duplicate warning on name + birth date.
- [ ] **P2-79 (S)** Auto-incrementing human-readable incident number (the legacy `getChartNumber` endpoint does this): make it atomic with a sequence to avoid duplicates under concurrent submits.
- [ ] **P2-80 (S)** Concurrency test: 25 simultaneous users submitting and searching with ≤10% response-time increase (NFR3).

### 2.7 Attachments and signatures (FR16, FR17)
- [ ] **P2-90 (M)** Storage adapter interface (`put`, `get`, `delete`, `signedUrl`) with a local-disk and an S3/MinIO implementation.
- [ ] **P2-91 (M)** Upload endpoint with auth, size limit (e.g. 10 MB; confirm), type allow-list by **content sniffing** (not only extension), image re-encoding to strip metadata, virus scan hook.
- [ ] **P2-92 (S)** Download endpoint: authorize against the chart, stream with `Content-Disposition`, no user-supplied paths ever reach the file system.
- [ ] **P2-93 (S)** Attachments allowed only while the chart is a draft or as an addendum attachment after submission (never mutate a submitted chart).
- [ ] **P2-94 (M)** Signature capture storage: PNG + hash + signer name + timestamp + language of the consent text, linked to the chart. Reqs: FR16.

### 2.8 Audit, reports, export (FR11, FR18, FR20)
- [ ] **P2-100 (M)** `AuditLogger` service called from the auth middleware (login success/failure, logout), chart read/search/submit, addendum, user and role changes, exports. Record user, action, entity, id, IP, user agent, time.
- [ ] **P2-101 (S)** `GET /audit` (admin) with filters and pagination; export CSV.
- [ ] **P2-102 (L)** `ReportService.summary(filters)`: SQL aggregates (`GROUP BY` option codes) for sex, age class, call nature, location, disposition, destination, trauma cause, procedures; date range, visit type and incident type filters. Replaces the 150-line `summary()` counter code.
- [ ] **P2-103 (M)** Trends: compare current period to previous period, return delta and direction for each metric. Reqs: FR18.
- [ ] **P2-104 (M)** Plain-language summary generator (templates in EN/ES: "Falls rose 18% compared with last month"). Reqs: FR18.
- [ ] **P2-105 (M)** CSV export (streamed) and PDF export (pdfkit, ported from `backend/pdf/index.js`, with the EN/ES locale files). Board gets aggregate exports only. Reqs: FR20.
- [ ] **P2-106 (M)** Single-chart PDF export with all addenda appended, EN or ES. Remove the client-side `html2canvas/jsPDF` path.
- [ ] **P2-107 (S)** Dashboard metrics config file so FR19 changes need no code change (metric key, source field, chart type, label keys).

### 2.9 Operations in the API
- [ ] **P2-110 (S)** Backup job script and scheduler (daily, retention policy), restore script, and alert on failure. Reqs: NFR9.
- [ ] **P2-111 (S)** Pre-migration hook in the deploy pipeline: take a backup, verify, then run migrations; abort deploy if the backup fails. Reqs: FR10, NFR9.
- [ ] **P2-112 (S)** Encrypted-at-rest settings documented and verified (database volume, object storage, backups). Reqs: FR11.
- [ ] **P2-113 (S)** Enforce HTTPS, HSTS and TLS ≥1.2 at the proxy; test with `testssl.sh`. Reqs: NFR5.

---

## Phase 3: Frontend (apps/web)

### 3.1 Scaffolding
- [ ] **P3-01 (M)** React 18 + Vite + TypeScript, ESLint with a11y rules, Vitest + Testing Library, Playwright for end-to-end.
- [ ] **P3-02 (S)** Pick one UI library (e.g. MUI v5 or a headless library + CSS variables); remove Bootstrap and MUI v4 mixing.
- [ ] **P3-03 (M)** Design tokens: colors meeting 4.5:1, 16 px base font, spacing, radii, focus ring; light, dark, and high-contrast themes. Reqs: NFR11, FR24, FR26.
- [ ] **P3-04 (S)** One API client (`fetch` wrapper) with base URL from env, CSRF header, JSON errors, 401 handling that sends the user to login, and typed responses from the shared package.
- [ ] **P3-05 (S)** Data fetching with TanStack Query: caching, retries, loading and error states.
- [ ] **P3-06 (M)** App shell: header, nav by role, language toggle, theme toggle, user menu, session-expiry warning dialog at 14 minutes.
- [ ] **P3-07 (M)** Routing with role-aware guards driven by the permission map; unknown or forbidden routes show an access-denied page (FR2).
- [ ] **P3-08 (S)** Idle timer: after 15 minutes of inactivity, clear client state and go to login. Reqs: NFR7.

### 3.2 i18n and accessibility (FR8, NFR11)
- [ ] **P3-10 (M)** Move `locales/en|es/translation.json` into namespaces; add option-label catalogs keyed by option code from `packages/shared`.
- [ ] **P3-11 (S)** Language toggle persists to the user's profile (fixes legacy forced `'es'` default) and falls back to the browser language before login.
- [ ] **P3-12 (S)** Lint rule or script that fails CI when a key exists in `en` but not `es`, or vice versa.
- [ ] **P3-13 (M)** Dates, numbers and units formatted by locale (Intl) not by string.
- [ ] **P3-14 (M)** Accessibility pass: labels on all inputs, focus order, keyboard-only use, ARIA live regions for save/sync messages, touch targets ≥44 px, `axe` checks in CI.
- [ ] **P3-15 (S)** Contrast test across all themes in CI (token pairs ≥4.5:1).
- [ ] **P3-16 (M)** Spanish review by fluent providers (FR8 acceptance). Keep a checklist of screens and their sign-off.

### 3.3 Authentication screens
- [ ] **P3-20 (M)** Login page: validation, error states, language toggle, link to reset.
- [ ] **P3-21 (M)** Account setup page (from emailed link): password rules checklist updating live, expired-link state with "request new link".
- [ ] **P3-22 (S)** Forgot password and reset-confirm pages.
- [ ] **P3-23 (S)** Replace the `jwtCookie`/`getUsername` startup checks with a single `useAuth()` hook that calls `/auth/me`.

### 3.4 Chart entry (FR5, FR6, FR22, NFR12, NFR13)
- [ ] **P3-30 (M)** Visit-type picker (Clinic Visit / Ambulance Call) with large touch cards.
- [ ] **P3-31 (L)** `FormRenderer`: render sections and fields from the form definition; supports text, number, select, multiselect, radio, checkbox, date, time/timestamp, body-region picker (from `PhysicalAssessment.js`), repeating rows (medications, procedures, vitals).
- [ ] **P3-32 (M)** Client-side validation using the same definition rules; inline errors; focus the first error.
- [ ] **P3-33 (M)** Stepper navigation with progress; at most 10 fields per step.
- [ ] **P3-34 (M)** Timestamp and reference sidebar: dispatch, en route, arrive, patient contact, depart, arrive at destination, transfer; incident number; unit; visible across all steps. Reqs: FR22.
- [ ] **P3-35 (M)** Patient step: search existing patient or create new; duplicate warning.
- [ ] **P3-36 (L)** Interventions step: medications, procedures, vitals as repeating rows, with spell-check hook ready for FR31.
- [ ] **P3-37 (M)** Review screen: read-only summary, missing required fields listed with links back, final submit with confirm dialog.
- [ ] **P3-38 (M)** Autosave: debounce, show "Saved at hh:mm" or "Not saved", save to the server and to a local fallback; restore prompt on return within the TTL. Reqs: FR13.
- [ ] **P3-39 (S)** Trainee mode: banner "Practice chart: not saved to patient records", distinct color accent, a different submit label. Reqs: FR23.
- [ ] **P3-40 (M)** Attachment step: choose/capture images, size and type feedback, thumbnails, remove before submit. Reqs: FR17.
- [ ] **P3-41 (M)** Consent/AMA signature step: signature pad (touch and stylus), language switch for the consent text, clear/redo, attached to chart. Reqs: FR16.

### 3.5 Browsing and addenda (FR7, FR12)
- [ ] **P3-50 (M)** Chart list: search box, filters, pagination, sort, empty and error states; role-limited columns.
- [ ] **P3-51 (M)** Chart detail: read-only, grouped by section, shows form version, author, submitted time, attachments, addenda in order; no edit controls anywhere.
- [ ] **P3-52 (S)** Add addendum panel (Provider/Admin only) with confirmation; appears immediately in the list.
- [ ] **P3-53 (S)** Print and PDF download buttons (server PDF, current language).

### 3.6 Dashboard (FR18, FR20, FR19)
- [ ] **P3-60 (M)** Filter bar (date range, visit type, incident type) bound to URL query params so views are shareable.
- [ ] **P3-61 (L)** Metric cards with trend arrow and plain-language summary; bar/line/pie charts using one maintained library; accessible text alternative for each chart.
- [ ] **P3-62 (S)** Export buttons (PDF and CSV) for the current filter.
- [ ] **P3-63 (S)** Board-role view of the dashboard only; hides chart links.
- [ ] **P3-64 (S)** Metric definitions read from the server config (P2-107) so metrics can change after sponsor review.

### 3.7 Admin
- [ ] **P3-70 (M)** User table: search, role dropdown (4 roles), active toggle, "send setup link" and "reset password" actions, status badges (pending, active, disabled).
- [ ] **P3-71 (S)** Create-user dialog with email, name, role.
- [ ] **P3-72 (M)** Audit log viewer with filters.
- [ ] **P3-73 (M)** Form field manager (Level 3: add timestamp/text fields). Reqs: FR30.
- [ ] **P3-74 (S)** Settings page: language, theme, session information.

### 3.8 Retire legacy frontend
- [ ] **P3-80 (S)** Feature parity checklist against P0-24 (every old screen has a new equivalent or an explicit "dropped" decision).
- [ ] **P3-81 (S)** Remove canvasjs, jspdf, html2canvas, moment, bootstrap, and MUI v4 once nothing uses them.

---

## Phase 4: Security and compliance (FR11, FR21, NFR4–NFR7)

- [ ] **P4-01 (M)** Threat model workshop (STRIDE on the system diagram): assets (PHI, credentials), actors, entry points. Output `docs/threat-model.md`.
- [ ] **P4-02 (S)** Map each HIPAA technical safeguard (access control, audit controls, integrity, transmission security) to a feature or control in a table.
- [ ] **P4-03 (M)** Review NOM-024-SSA3-2012 requirements with the sponsor and compliance adviser; list what applies (record structure, identifiers, catalogs, retention) and create tickets for any gaps. Do not claim compliance without sign-off.
- [ ] **P4-04 (S)** Data classification: mark each field as PHI/identifier/other; drives log redaction and export rules.
- [ ] **P4-05 (S)** Retention policy and deletion rules agreed with the sponsor (charts are immutable; how long to keep; what "right to access" requests look like).
- [ ] **P4-06 (M)** Run OWASP ZAP baseline scan against a staging deployment; triage and fix findings.
- [ ] **P4-07 (S)** `npm audit` and dependency review in CI; fail on high/critical.
- [ ] **P4-08 (S)** Secrets management: environment secrets in the host/secret store, rotation procedure, no secrets in images.
- [ ] **P4-09 (S)** Verify cookies: `HttpOnly`, `Secure`, `SameSite`; verify headers with a scanner (CSP, HSTS, X-Content-Type-Options, Referrer-Policy).
- [ ] **P4-10 (M)** Access-log review procedure: who reviews, how often, how to investigate; test it with a mock incident.
- [ ] **P4-11 (S)** Incident response checklist (breach, lost tablet, account compromise), one page, includes contacts.
- [ ] **P4-12 (S)** Backup security: encryption, access list, restore drill every quarter.
- [ ] **P4-13 (S)** Penetration-style test checklist run by a teammate who did not write the code: privilege escalation between all role pairs, IDOR on chart/attachment IDs, token reuse, session fixation.
- [ ] **P4-14 (S)** Confirm no PHI in logs, URLs (query strings), error messages or analytics.

---

## Phase 5: Testing and quality (NFR13, NFR14)

- [ ] **P5-01 (M)** Unit tests: services (chart lifecycle, form validation, policy, tokens, password policy) to ≥70% backend coverage; coverage gate in CI.
- [ ] **P5-02 (M)** Integration tests: each endpoint with real DB; includes immutability, 10-minute links, search limits, concurrency.
- [ ] **P5-03 (M)** Contract tests: the OpenAPI spec vs the frontend client types (generate the client from the spec).
- [ ] **P5-04 (L)** Playwright end-to-end flows: login → clinic chart → submit → addendum; ambulance chart with autosave and recovery; admin creates user → setup email (mailhog) → login; Board sees dashboard only; Trainee practice chart; language toggle; idle timeout.
- [ ] **P5-05 (M)** Performance tests (k6): login and chart list ≤2 s on a simulated 10 Mbps connection (NFR1); search ≤2 s at 50,000 charts (NFR2); 25 concurrent users with ≤10% degradation (NFR3).
- [ ] **P5-06 (S)** Seed script that generates 50,000+ synthetic charts for the performance tests.
- [ ] **P5-07 (M)** Accessibility audits: automated (axe/Lighthouse) plus manual keyboard and screen-reader pass for the five main flows.
- [ ] **P5-08 (M)** Usability test: at least 3 new volunteers complete a basic chart within 10 minutes of training; record time, errors, and quotes. Reqs: NFR13.
- [ ] **P5-09 (S)** Spanish translation review with 2 bilingual providers (FR8 acceptance); capture corrections.
- [ ] **P5-10 (M)** Tablet testing on the actual devices the clinic uses (screen sizes, touch, orientation, browser versions). Reqs: FR9.
- [ ] **P5-11 (S)** Test data policy: only synthetic data in dev/test; documented.
- [ ] **P5-12 (S)** Regression tests for every legacy vulnerability from P0-30 (SQL injection strings, path traversal strings, unauthenticated access).
- [ ] **P5-13 (S)** Traceability matrix: every FR/NFR → tests and verification method (spec's "Verification Method" column). Keep in `docs/traceability.md`; CI check that each requirement ID appears in at least one test name or file.

---

## Phase 6: Deployment and operations (NFR5, NFR9, NFR10)

- [ ] **P6-01 (M)** Dockerfiles for API and web; docker-compose for local development (db, mailhog, MinIO, api, web).
- [ ] **P6-02 (M)** Environments: `dev`, `staging` (production-like, synthetic data), `production`. Different secrets and databases.
- [ ] **P6-03 (M)** Hosting setup per ADR-006: VM or container platform, managed database or self-managed with backups, object storage, domain, TLS certificates with auto-renew.
- [ ] **P6-04 (M)** CD pipeline: on merge to `main` deploy to staging; manual approval to production; runs migrations after the backup gate (P2-111).
- [ ] **P6-05 (S)** Zero-downtime-ish deploy or a published maintenance window procedure (planned maintenance is excluded from uptime, NFR10).
- [ ] **P6-06 (M)** Monitoring: uptime check on `/healthz`, error tracking (Sentry or similar, PHI scrubbing on), disk/DB alerts, backup success alert. Reqs: NFR10.
- [ ] **P6-07 (S)** Uptime measurement method (monthly report from the monitor). Reqs: NFR10.
- [ ] **P6-08 (S)** Runbook: restart, restore from backup, rotate secrets, add a user manually, read audit logs.
- [ ] **P6-09 (S)** Disaster recovery test: restore production-like backup into a clean environment, time it, document RTO/RPO.
- [ ] **P6-10 (S)** Log retention and rotation; access to logs limited.
- [ ] **P6-11 (S)** Dependency and OS patching schedule; owner assigned.

---

## Phase 7: Cutover from legacy

- [ ] **P7-01 (S)** Cutover plan document: date/time, owner, communication, freeze window, rollback conditions.
- [ ] **P7-02 (S)** Announce freeze to clinic staff; agree on paper fallback during the window.
- [ ] **P7-03 (S)** Final legacy backup + verification (P0-50, P0-51).
- [ ] **P7-04 (M)** Run ETL on final data; run `verify`; get sign-off from two team members and the sponsor contact.
- [ ] **P7-05 (S)** Provision users: send setup links to all existing users (no password carry-over) or a staged invite.
- [ ] **P7-06 (S)** Smoke tests in production: login, search a known migrated chart, view addendum, export PDF, create a practice chart.
- [ ] **P7-07 (S)** Switch DNS/URL; set the legacy app to read-only or take it offline; keep the DB snapshot.
- [ ] **P7-08 (S)** Monitor closely for 2 weeks; daily check of errors, slow queries and support questions.
- [ ] **P7-09 (S)** Rollback plan tested in rehearsal (what happens to charts entered after cutover if we have to go back?).
- [ ] **P7-10 (S)** Retention: when to archive and finally dispose of the legacy snapshot (agree with the sponsor).
- [ ] **P7-11 (M)** Training: short guides in EN/ES (PDF and in-app help) for Providers, Trainees, Admins, Board; one live session per group. Reqs: NFR13.

---

## Phase 8: Level 2 features 

### 8.1 Offline and sync (FR14, FR15, NFR4, NFR8)
- [ ] **P8-01 (M)** Decide offline scope with the sponsor: which screens work offline (chart entry only, or also search?).
- [ ] **P8-02 (M)** PWA basics: web manifest, service worker (app shell cache), install prompt, update flow that does not interrupt a chart in progress.
- [ ] **P8-03 (L)** Local encrypted store: IndexedDB via Dexie; AES-GCM with a key derived at login (WebCrypto) and wiped on logout/idle; request persistent storage; handle quota errors.
- [ ] **P8-04 (L)** Chart service abstraction on the client (`ChartRepository` interface with online and offline implementations) so UI code does not change.
- [ ] **P8-05 (L)** Outbox: queue of operations (`draft.save`, `chart.submit`, `addendum.add`, `attachment.put`) with client-generated UUIDs and idempotency keys; persisted before UI says "saved".
- [ ] **P8-06 (L)** Server `/sync/push`: idempotent apply, per-item result, partial failures, no duplicates on retry; conflict detection for drafts edited on two devices (flag, do not merge). Reqs: FR15.
- [ ] **P8-07 (M)** Retry with backoff; visible banner for pending/failed items; user notification on failure. Reqs: NFR8.
- [ ] **P8-08 (M)** Purge local data after server acknowledgement; confirm by test. Reqs: NFR4.
- [ ] **P8-09 (M)** Offline login: allow a previously authenticated user to unlock the local store (PIN/password) while offline; define the limits.
- [ ] **P8-10 (L)** Failure-injection tests: kill the tab mid-write, airplane mode mid-submit, clock skew, duplicated requests, server 500 mid-batch; assert zero data loss.
- [ ] **P8-11 (S)** Flag incomplete records at sync time ("missing required fields") instead of rejecting silently. Reqs: FR15.

### 8.2 Other Level 2
- [ ] **P8-20 (M)** Image capture and compression on tablets (camera access, EXIF stripping, orientation fixes). Reqs: FR17.
- [ ] **P8-21 (M)** Signature screens polished for tablets in EN/ES; consent text versioning. Reqs: FR16.
- [ ] **P8-22 (M)** Dashboard metric refinement workshop with sponsor and Board; update metric config (P2-107). Reqs: FR19.
- [ ] **P8-23 (M)** Trainee practice scenarios (pre-filled sample cases providers can open and practice). Reqs: FR23.
- [ ] **P8-24 (S)** Dark-mode QA across every screen and chart color. Reqs: FR24.

---

## Phase 9: Level 3 features (if time allows)

- [ ] **P9-01 (L)** Medication spell-check: bilingual medication dictionary, fuzzy match with suggestions, offline-capable. Reqs: FR31.
- [ ] **P9-02 (M)** Trend alerts: scheduled job comparing rolling windows, threshold config, email/in-app notification (e.g. bike trauma spike). Reqs: FR27.
- [ ] **P9-03 (M)** Accessibility modes: high/low contrast themes, dyslexia-friendly font option stored per user. Reqs: FR26.
- [ ] **P9-04 (M)** Additional languages: translation workflow, pseudo-localization test, right-to-left check if needed. Reqs: FR29.
- [ ] **P9-05 (L)** Admin-configurable fields UI (timestamp/text), versioned and previewed before publishing. Reqs: FR30.
- [ ] **P9-06 (L)** Open-source packaging: strip Rescate-specific content into configuration (clinic name, catalogs, forms), license choice, contribution guide, installation docs, sample data. Reqs: FR28.
- [ ] **P9-07 (L)** Capacitor wrap for iOS/Android; evaluate App Store/Play review risk, storage behavior, background sync limits. Reqs: FR25.

---

## Phase 10: Documentation and course deliverables

- [ ] **P10-01 (M)** Design report fur October 28
- [ ] **P10-03 (L)** 10 UI mock-ups (Figma or similar) for the screens listed in section 7.2 of the outline, with annotations.
- [ ] **P10-04 (S)** README rewrite: how to run, test, migrate, deploy.
- [ ] **P10-05 (S)** API documentation published from OpenAPI.
- [ ] **P10-06 (S)** Architecture decision records complete (P0-60 … P0-67) and linked from the README.
- [ ] **P10-07 (S)** User guides (EN/ES) and a short admin guide.
- [ ] **P10-08 (S)** Maintenance guide for the clinic's future volunteers: how to add a user, change a field, restore a backup.

---

## Suggested order

| Week | Focus | Exit check |
|---|---|---|
| 1 | P0-01…P0-12 (repo, CI, process), P0-20…P0-30 (audit), P0-50…P0-53 (backups), ADRs | Legacy runs locally, backups restore, data profile written, decisions recorded |
| 2 | P1-01…P1-10 (schema), P1-20…P1-23 (option codes, forms), P2-01…P2-10 (scaffolding) | New DB migrates from scratch, form definitions validate, API boots with tests in CI |
| 3 | P2-20…P2-44 (auth + RBAC), P3-01…P3-08 (web scaffold), P3-20…P3-23 | Login, setup link, reset link, role matrix tests green |
| 4 | P2-60…P2-80 (forms, drafts, charts, addenda), P1-30…P1-39 (ETL v1) | A chart can be drafted, submitted, found by search and amended by an addendum; ETL dry run reports on sample data |

## Highest-risk items to start early

1. **P0-22 data profiling and P1-33 chart transform** (unknown data quality, Spanish string values, text columns).
2. **P0-61 database choice and P0-65 hosting/compliance** (blocks infrastructure and encryption choices).
3. **P2-75 search at 50,000 rows** (index design affects the schema).
4. **P8-03 to P8-10 offline store and sync** (hardest engineering; design seams in Phase 2 so it does not force a rewrite).
5. **P5-08 usability test** (needs volunteers booked weeks ahead).
