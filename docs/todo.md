# Rescate ePCR: master to-do list

**Conventions**
- IDs like `P2-07` are stable for citation
- Size: **S** ≤ half a day · **M** ≈ 1–2 days · **L** ≈ 3–5 days · **XL** > 1 week (split it).
- `Reqs:` FR/NFR IDs from the PA-2 spec. 
- `Dep:` tasks that must finish first. 
- `Done when:` the check that closes it.
- Every PR needs a reviewer other than the author (NFR15), a requirement ID, and tests.

**Target architecture (PA-2 §4.1)**
- Client–server over one HTTPS REST/JSON interface. Client uses MVC (`FormRenderer` view, `ChartController` + hooks `useChart`/`useAuth`).
- Server is layered: **Security** (`RateLimiter`, `SessionManager`, `PolicyGuard`) → **Services** (10 classes) → **Repositories** (6 classes, the only code that touches the DB) → DB / file storage.
- External: Email service, legacy MySQL (read once by `MigrationRunner`), backup storage.

---

## Phase 0: Foundations and safety net

### 0.1 Repository and process
- [x] **P0-01 (S)** `legacy-v1` tag on `main` so the old code is recoverable.
- [ ] **P0-02 (S)** Decide repo layout (e.g. `apps/api`, `apps/web`, `packages/shared`, `docs/`, `scripts/`, `legacy/` read-only copy of `backend/` and `frontend/`). Update `docs/repo-map.md`.
- [x] **P0-03 (S)** Protect `main`: 1 approving review, status checks, no force-push. Reqs: NFR15.
- [x] **P0-04 (S)** PR template with checklist.
- [ ] **P0-05 (S)** `CODEOWNERS` for security-sensitive paths (`security/`, `services/auth*`, `repositories/`, `migrations/`, audit).
- [ ] **P0-06 (S)** `.editorconfig`, Prettier, ESLint (typescript-eslint, jsx-a11y), lint-staged + Husky.
- [x] **P0-07 (S)** Remove committed noise (`debug.log`, build artifacts); extend `.gitignore`.
- [ ] determine unittest framework
- [ ] **P0-08 (M)** GitHub Actions CI: install, lint, typecheck, unit tests with 70% backend coverage gate, integration tests against a DB service container, build. Reqs: NFR14.
- [ ] **P0-09 (S)** Dependabot for npm and Actions.
- [ ] **P0-10 (S)** `gitleaks` in CI; scan history for real `.env`, passwords, JWT secrets (`git log -p -S"JWT_SECRET"`); rotate anything found.
- [ ] **P0-11 (S)** Issue labels and project board: `phase-0`…`phase-9`, `security`, `legacy-fix`, `migration`, `a11y`, `i18n`, `blocked`.
- [ ] **P0-12 (S)** Written definition of done: tests, docs, EN+ES strings, a11y check, audit event where PHI is touched, requirement ID in the PR.
- [x] **P0-13 (S)** `main` is not the default branch; changes go through PRs.

### 0.2 Legacy audit
- [ ] **P0-20 (M)** Run the legacy system locally per its README; walk each existing use case; record problems in `docs/`.
- [ ] **P0-21 (M)** Obtain a sanitized copy of production data or a seeded realistic set. No real PHI in git or on laptops without approval. Bryan is non-technical, so plan how to get it (script he runs, or a screen-share).
- [ ] **P0-22 (M)** Data profiling script → `docs/legacy-data-profile.md`: row counts, null rates per `charts` column, distinct values of categorical columns, date ranges, parse success of JSON-ish columns (`medications`, `procedures`, `vital_signs`, `obstetrics`).
- [ ] **P0-23 (S)** Table of every legacy API endpoint: method, auth, caller.
- [ ] **P0-24 (S)** Inventory of legacy frontend screens: route, component, API calls, role visibility.
- [ ] **P0-25 (M)** Full chart field list from `sql/database.js` and the chart components → `docs/field-inventory.csv`. Label each field by section (maps to §4.2 domain classes), visit type, required/optional, input type, options, EN/ES labels.
- [ ] **P0-26 (M)** Confirm which sections each of the 10 natures of call requires. Reqs: FR5, FR6, NFR12.
- [ ] **P0-27 (S)** Extract Spanish strings stored as data → `docs/option-codes.csv` (legacy string, proposed code, EN, ES).
- [ ] **P0-28 (S)** Document the legacy PDF layout; get a sample PDF from Rescate (if exists)
- [ ] **P0-29 (S)** `npm audit` on both legacy `package.json`s; note required Node version.
- [ ] **P0-30 (M)** Reproduce and ticket the known legacy security findings (each becomes a regression test in Phase 8):
  - SQL injection: `login`, `register`, `forgot`, `rate_limiter.js`, chart/patient views, `summary`, `calls`, `notes`.
  - Unauthenticated routes: chart upload, files, download, `pdfTest`.
  - Path traversal via `chartId`/`file`.
  - No role scoping on `GET /charts`, `/charts/patients`.
  - `POST /charts/:id/update` edits any chart.
  - `jwtCookie()` sets `auth` true on failure; 24 h JWT, no idle timeout or revocation; reset link 1 h; no password policy.
  - Rate limiter keyed on IP only, fails open. CORS hard-coded to localhost.
- [ ] **P0-31 (S)** Review legacy encryption (passwords, data at rest, in transit) as the interview requested; write findings. Reqs: FR11.
- [ ] **P0-32 (S)** Recent Node security issues: audit what can and cannot be used 

### 0.3 Backups before anything else (FR10, NFR9)
- [ ] **P0-40 (S)** `scripts/backup-legacy.sh`: `mysqldump --single-transaction --routines` + `backend/attachments/`, compressed, SHA-256 checksum file.
- [ ] **P0-41 (M)** Restore test into scratch MySQL; compare row counts and sample checksums. *Done when:* a second person repeats it from the doc.
- [ ] **P0-42 (S)** Encrypt backups (age/gpg), store in ≥2 places, document key custody.
- [ ] **P0-43 (S)** Daily legacy backup (cron/host snapshot) until cutover.

### 0.4 Decisions to record (ADRs in `docs/adr/`)
- [ ] **P0-50 (S)** ADR-001: layered architecture + client MVC, with offline seams for FR14 
- [ ] **P0-51 (S)** ADR-002: DB engine. MySQL 8 (matches legacy, easier ETL) vs PostgreSQL. The §4.3 schema is written for MySQL types; confirm with hosting constraints.
- [ ] **P0-52 (S)** ADR-003: backend language/framework and data access (TypeScript + Express/Fastify; Knex vs Prisma). Repositories must hide this choice.
- [ ] **P0-53 (S)** ADR-004: frontend stack (React 18 + Vite + TypeScript, UI library, query library, i18n, charts).
- [ ] **P0-54 (S)** ADR-005: session strategy (server-side sessions with 15-min idle, per `SessionManager`).
- [ ] **P0-55 (S)** ADR-006: hosting and data residency; NOM-024-SSA3-2012 obligations; budget.
- [ ] **P0-56 (S)** ADR-007: file storage (S3-compatible/MinIO/encrypted disk) for `Attachment.storageKey`.
- [ ] **P0-57 (S)** ADR-008: immutability model (no update/delete in `ChartRepository` + DB trigger + content hash).
- [ ] **P0-58 (S)** ADR-009: draft cache store (`DraftStore`): DB table outside chart tables vs Redis; TTL value.
- [ ] **P0-59 (S)** ADR-010: trainee/practice data discard on submit.

## Phase 1: Design report and course deliverables (due Oct 28)

- [ ] **P1-03 (S)** Reconcile §4.3 tables with §4.2 domain classes. The 4.3 `charts` table still holds ambulance-ish columns (`location`, `patient_count`, `agencies`, `is_vehicle_accident`, `care_level`, `triage_color`, `incident_*`) that §4.2 puts in `AmbulanceChart`, and 4.3 has `visit_type` vs 4.2 `callType`/`natureOfCall`. Pick one set of names.


## Phase 2: Data layer and migration (FR10, NFR2, NFR9)

### 2.1 New schema (§4.3)
- [ ] **P2-01 (M)** ER diagram for the full model: `users`, `patients`, `charts` (+ `ambulance_calls`, `clinic_visits` 1:1 on `chart_id`), `transports`, `chart_crew`, `vehicle_accident`, `wound_care`, `vitals`, `notes`, `attachments`, `chart_forms`, `chart_patient_info`, `assessments`, `physical_exam`, `obstetrics`, `fluid_intake_output`, `medications_given`, `procedures_performed`, `auth tokens`, `chart_drafts` (cache), `audit_log`, `charts_v1_archive`. Review with the team.
- [ ] **P2-02 (S)** ID strategy: INT PK + `chart_uuid`/`attachment_uuid` CHAR(36) unique for external references; `legacy_chart_id` nullable unique.
- [ ] **P2-03 (M)** Choose and set up the migration tool; first migration creates all tables with keys, FKs, `NOT NULL`s, ENUMs (`role`, `language_preferred`, `visit_type`, `call_category`).
- [ ] **P2-04 (M)** `charts` indexes: `incident_date`, `visit_type`/`call_type`, `nature_of_call`, `patient_id`, `created_by`, `submitted_at`, `is_practice`, composite for dashboard filters.
- [ ] **P2-05 (M)** Patient search indexes (`last_name`, `first_name`, `birth_date`) plus fuzzy/full-text option. Reqs: NFR2.
- [ ] **P2-06 (S)** Immutability: DB trigger rejecting `UPDATE`/`DELETE` on `charts` and all section tables once submitted; test proves it. Reqs: FR12.
- [ ] **P2-07 (S)** `audit_log` append-only (revoke UPDATE/DELETE from the app DB user).
- [ ] **P2-08 (S)** Separate DB roles: `app_rw` (no DDL), `migrator`, `reporting_ro`, `backup`.
- [ ] **P2-09 (M)** Seed data: an admin user, a user per role, fake patients and charts for dev, option-code tables.
- [ ] **P2-10 (S)** One-command local DB create/migrate/seed.
- [ ] **P2-11 (S)** Chart `submitted_at` set only on submit; `needs_review` flag column in place for FR15.

### 2.2 Option codes and form definitions
- [ ] **P2-20 (M)** Option codes from P0-27 into versioned JSON in `packages/shared/options/` (code → `{en, es}`).
- [ ] **P2-21 (L)** Turn `field-inventory.csv` into form definitions for **clinic** and **ambulance**, keyed by nature of call (10 types): sections, fields, required sections, visibility rules, option sets, i18n keys. This is the data `FormDefinitionService.requiredSections()` serves.
- [ ] **P2-22 (M)** Schema (zod/JSON Schema) for the form-definition format and a validator used at seed time.
- [ ] **P2-23 (S)** CI check: no screen/section exceeds 10 core fields. Reqs: NFR12.
- [ ] **P2-24 (S)** Medication list file (EN/ES) placeholder for FR31.

### 2.3 Migration: `MigrationRunner` + `LegacyArchiveRepository`
- [ ] **P2-30 (S)** `scripts/etl/` skeleton: config (source read-only, target), dry-run flag, structured logs.
- [ ] **P2-31 (M)** `backup()`: wraps P0-40; records path and checksum; fails if backup fails. Reqs: NFR9.
- [ ] **P2-32 (M)** `migrate()` step 1: copy raw legacy rows to `charts_v1_archive` via `LegacyArchiveRepository.insertRaw(entity, legacyId, rawRow)`. Read-only safety net, never modified.
- [ ] **P2-33 (L)** Transform patients (`fname`/`lname`/`birth`/`gender` → `first_name`/`last_name`/`birth_date`/`gender`); parse multi-format dates; log failures.
- [ ] **P2-34 (XL)** Transform charts into `Chart` + `AmbulanceChart`/`ClinicChart` + section tables, set `legacy_chart_id`, `submitted_at`, `needs_review` where data is incomplete. Split into:
  - [ ] Map Spanish display strings to option codes; unmapped values counted and kept in archive.
  - [ ] Parse `medications`, `procedures`, `vital_signs`, `obstetrics`, `ambulance_crew` text into `MedicationGiven`, `ProcedurePerformed`, `Vital`, `Obstetrics`, `CrewMember` rows; on parse failure keep raw text in a note and flag `needs_review`.
  - [ ] Convert datetimes from UTC (legacy pool uses `timezone: 'utc'`); record clinic timezone assumption.
- [ ] **P2-35 (M)** Transform notes → `notes`. Authors may not exist as users: keep author name text plus nullable `user_id`.
- [ ] **P2-36 (M)** Transform users: carry `username`, `email`, `name`, `phone`, `certifications`; map `privilege` → role. Do not copy password hashes; force a reset on first login.
- [ ] **P2-37 (M)** Transform attachments: copy files to new storage with new keys, SHA-256, size/type, flag violations of limits.
- [ ] **P2-38 (M)** Idempotent, resumable loader using `legacy_chart_id`/id map; batch transactions.
- [ ] **P2-39 (L)** `verifyCounts()` + deeper verify: counts per entity and per year, field-by-field on a random sample (~500 charts) plus unusual ones, attachment hashes, orphan report. Output `reports/etl-<timestamp>.md`. *Done when:* zero unexplained differences. Reqs: FR10.
- [ ] **P2-40 (S)** Backup gate: ETL refuses to run without a verified backup newer than N minutes. Reqs: FR10, NFR9.
- [ ] **P2-41 (M)** Time the ETL on production-sized data (needed for cutover window).
- [ ] **P2-42 (S)** Rehearse the full ETL twice (restore → migrate → verify) before cutover.

---

## Phase 3: Backend core

### 3.1 Scaffolding
- [ ] **P3-01 (M)** TypeScript project, strict config, build/dev scripts, `/healthz`.
- [ ] **P3-02 (M)** Typed env config (zod); fail on missing secrets; `.env.example` with no real values.
- [ ] **P3-03 (S)** Logging (pino) with request IDs; redact passwords, tokens, PHI.
- [ ] **P3-04 (S)** Central error handler: consistent JSON, no stack traces or raw DB errors to clients.
- [ ] **P3-05 (S)** `helmet`, strict CORS from config, body size limits, `HttpOnly`/`Secure`/`SameSite` cookies.
- [ ] **P3-06 (M)** Per-route zod validation middleware.
- [ ] **P3-07 (S)** DB module: pool, transaction helper, graceful shutdown.
- [ ] **P3-08 (S)** Module template (`routes`, `service`, `repository`, `schemas`, `tests`) so layering is enforced by structure. Lint rule: routes may not import repositories; services may not import the DB driver.
- [ ] **P3-09 (S)** OpenAPI spec from zod schemas, served in dev only.
- [ ] **P3-10 (S)** Test harness: Vitest/Jest, supertest, per-run test DB, factories.

### 3.2 Repositories layer (only code that touches the DB; NFR2)
- [ ] **P3-20 (M)** `UserRepository`: `findByEmail`, `create`, `updateRole`, `saveToken`, `consumeToken(tokenHash)` (atomic, single use).
- [ ] **P3-21 (S)** `PatientRepository`: `create`, `findByName(name, birthDate)`.
- [ ] **P3-22 (L)** `ChartRepository`: `insertSubmitted(chart)` writes chart + subclass row + optional transport + all section rows in **one transaction**; `findByUuid` loads the right subclass; `search(filters, page)`. **No update or delete method exists.** Reqs: FR7, FR12.
- [ ] **P3-23 (S)** `NoteRepository`: `insert`, `listByChart` (append-only).
- [ ] **P3-24 (S)** `AttachmentRepository`: `insert`, `findByUuid`.
- [ ] **P3-25 (S)** `LegacyArchiveRepository` (shared with P2-32).
- [ ] **P3-26 (M)** Repository integration tests against a real DB, including a test that the transaction rolls back if any section row fails.

### 3.3 Security layer: `RateLimiter`, `SessionManager`, `PolicyGuard`
- [ ] **P3-30 (M)** `PolicyGuard` + permission map in `packages/shared`: roles Admin, Provider, Board, Trainee × permissions (`chart.create`, `chart.read`, `chart.search`, `addendum.create`, `dashboard.read`, `user.manage`, `form.manage`, `export.read`, `audit.read`, `settings.manage`). `can(role, permission)`, `authorize(permission)`; **deny by default**. `User.can()` delegates here. Reqs: FR2.
- [ ] **P3-31 (M)** Middleware: every route must declare a permission; a test fails if a route lacks one.
- [ ] **P3-32 (M)** `SessionManager`: `authenticate(request)`, `touch(sessionId)`; server-side store; **15-minute idle** expiry; absolute max (e.g. 12 h); new ID at login. Reqs: FR1, NFR7.
- [ ] **P3-33 (S)** CSRF protection for state-changing routes.
- [ ] **P3-34 (S)** `RateLimiter`: `hit(key)`, `isBlocked(key)` on IP + account for login and reset; **fails closed**; replaces the V1 `rate_limiters` table. Reqs: FR11, NFR6.
- [ ] **P3-35 (M)** Role × route matrix test asserting allow/deny and error code. Reqs: FR2.
- [ ] **P3-36 (S)** 403 responses carry a stable error code the client translates to EN/ES.

### 3.4 Services layer
**Accounts and auth (FR1, FR3, FR4, NFR6)**
- [ ] **P3-40 (M)** `AuthService`: `login`, `logout` (destroys session server-side); Argon2id/bcrypt ≥12; constant-time on unknown user; generic error; records login events. Reqs: FR1, FR11, NFR6.
- [ ] **P3-41 (S)** Password policy: ≥12 chars with special character; common-password reject; shared with frontend.
- [ ] **P3-42 (M)** `AccountService`: `createUser(email, role)`, `changeRole`, `requestReset(email)`, `completeSetup(token, password)`; random token, only hash stored, **10-minute TTL, single use**. Reset request returns the same response whether or not the email exists. Reqs: FR3, FR4.
- [ ] **P3-43 (S)** Admin reset for any user; self-service profile update (language, phone, name). Deactivate, never hard-delete, users who authored charts (`User.deactivate()`).
- [ ] **P3-44 (M)** `MailService`: `sendSetup`, `sendReset`; SMTP provider (not a personal Gmail), EN/ES templates, links built from `FRONTEND_URL`, failures logged and shown to admin. Reqs: FR3, FR4, FR8.
- [ ] **P3-45 (M)** Tests: link at 10:01 rejected, 9:59 works, second use rejected, login works right after reset, idle at 15:01 → 401, password policy cases.

**Forms (FR5, FR6, FR30, NFR12)**
- [ ] **P3-50 (M)** `FormDefinitionService`: `getForm(callType, natureOfCall)` in requested language, `requiredSections(...)`.
- [ ] **P3-51 (M)** `validate(callType, natureOfCall, data)`: required, type, range, option membership, conditional rules (e.g. `traumaCause` required when nature is trauma; `Obstetrics` required for OB; `MedicationGiven` required for injections; consent form required for every nature).
- [ ] **P3-52 (S)** Reject fields not in the selected visit type's definition (FR6).
- [ ] **P3-53 (M)** `addField(field)` for admins (timestamp, text) creates a new form version; existing charts keep theirs; chart stores `formVersion`. Reqs: FR30 (Level 3).
- [ ] **P3-54 (M)** Unit tests for each rule and for clinic vs ambulance separation.

**Charts, drafts, addenda (FR7, FR12, FR13)**
- [ ] **P3-60 (M)** `DraftStore`: `put`, `get`, `discard`; owner-only; `expiresAt`; touching extends TTL; recoverable for ≥5 min. Lives outside chart tables. Reqs: FR13.
- [ ] **P3-61 (S)** Expired-draft cleanup job.
- [ ] **P3-62 (L)** `ChartService.createDraft` and `submit(user, draftId)`: build the correct `Chart` subclass from `callType`, attach only the sections the nature of call requires, validate, link/create patient (duplicate warning on name + birth date), save through `ChartRepository.insertSubmitted`, delete the draft, audit event. `Chart.isEditable()` is always false.
- [ ] **P3-63 (M)** `ChartService.get(user, chartUuid)`: role-checked; audit who read which chart; returns form version and labels.
- [ ] **P3-64 (L)** `ChartService.search(user, filters, page)`: name, date range, call type, nature, author; pagination, sort; **≤ 2 s at 50,000 charts**; benchmark script. Reqs: NFR2.
- [ ] **P3-65 (S)** No update/delete routes; test that `PUT/PATCH/DELETE /charts/:id` return 404/405 and the trigger blocks direct SQL. Reqs: FR12.
- [ ] **P3-66 (M)** `AddendumService`: `add(user, chartUuid, text)`, `listForChart`; Provider/Admin only; stores author, role and certifications snapshot, timestamp. Reqs: FR7, FR12.
- [ ] **P3-67 (S)** Atomic human-readable `incidentNumber` (sequence) to avoid duplicates under concurrent submits.
- [ ] **P3-68 (M)** Trainee path (see ADR-010): practice charts never appear in provider lists, dashboards or exports, and never reach production tables if the discard model is chosen. Reqs: FR23.
- [ ] **P3-69 (S)** Timeline helpers: `AmbulanceChart.timeline()`, `isTimelineInOrder()`, `ClinicChart.timeline()`, `lengthOfStay()` feeding the sidebar. Reqs: FR22.

**Consent, attachments (FR16, FR17)**
- [ ] **P3-70 (M)** Storage adapter (`put`, `get`, `delete`, `signedUrl`): local-disk and S3/MinIO implementations.
- [ ] **P3-71 (M)** `AttachmentService.upload`: auth, size limit (confirm; interviews say EKG/medication-list images only), allow-list by content sniffing, strip metadata, virus scan hook. `download(user, attachmentUuid)` authorizes against the chart; no user-supplied paths touch the FS.
- [ ] **P3-72 (S)** Attachments only on drafts, or as addendum attachments after submit; never mutate a submitted chart.
- [ ] **P3-73 (M)** `ConsentFormService.sign(user, chartUuid, formType, language, signature)`: signature PNG + hash + signer name + timestamp + `textVersion`; `listForChart`. Reqs: FR16.

**Audit and reports (FR11, FR18–FR20)**
- [ ] **P3-80 (M)** `AuditLogger.record(event)` called from auth, chart read/search/submit, addendum, user/role changes, exports: user, action, entity, id, IP, user agent, time. `query(filters)` for admins.
- [ ] **P3-81 (L)** `ReportService.summary(filters)` via SQL aggregates (sex, age class, nature of call, disposition, trauma cause, procedures, response times); filters: date range, visit type, incident type. Board gets aggregates only. Reqs: FR18.
- [ ] **P3-82 (M)** `trend(filters)`: current vs previous period, delta and direction.
- [ ] **P3-83 (M)** Plain-language summaries (EN/ES templates).
- [ ] **P3-84 (M)** `exportCsv`, `exportPdf` (pdfkit, port of legacy layout, EN/ES); single-chart PDF with addenda appended. Reqs: FR20.
- [ ] **P3-85 (S)** Dashboard metrics in a config file so FR19 changes need no code.

### 3.5 Operations in the API
- [ ] **P3-90 (S)** Daily backup job + retention + restore script + failure alert. Reqs: NFR9.
- [ ] **P3-91 (S)** Pre-migration hook in deploy: backup, verify, then migrate; abort on failure.
- [ ] **P3-92 (S)** Document and verify encryption at rest (DB volume, object storage, backups). Reqs: FR11.
- [ ] **P3-93 (S)** HTTPS, HSTS, TLS ≥1.2 at the proxy; test with `testssl.sh`. Reqs: NFR5.

---

## Phase 4: Frontend (React, MVC)

### 4.1 Scaffolding
- [ ] **P4-01 (M)** React 18 + Vite + TypeScript, ESLint a11y, Vitest + Testing Library, Playwright.
- [ ] **P4-02 (S)** One UI library; remove Bootstrap and MUI v4 mix.
- [ ] **P4-03 (M)** Design tokens: 4.5:1 contrast, 16 px base font, light and dark themes (night mode is the stakeholder's top accessibility ask). Reqs: NFR11, FR24.
- [ ] **P4-04 (S)** Single API client: env base URL, CSRF header, 401 → login, types from shared package.
- [ ] **P4-05 (S)** TanStack Query for caching, retries, loading/error states.
- [ ] **P4-06 (M)** App shell: nav by role, language toggle, theme toggle, user menu, session warning at 14 min.
- [ ] **P4-07 (M)** Role-aware route guards from the permission map; access-denied page.
- [ ] **P4-08 (S)** `useAuth()` hook: session via `/auth/me`, 15-minute idle timer. Reqs: NFR7.

### 4.2 i18n and accessibility (FR8, NFR11)
- [ ] **P4-10 (M)** EN/ES namespaces plus option-label catalogs keyed by option code.
- [ ] **P4-11 (S)** Language toggle saved to user profile; falls back to browser language before login.
- [ ] **P4-12 (S)** CI check for missing keys in either language.
- [ ] **P4-13 (M)** Locale-aware dates/numbers/units.
- [ ] **P4-14 (M)** Accessibility pass: labels, focus order, keyboard use, ARIA live regions for save messages, ≥44 px touch targets, `axe` in CI.
- [ ] **P4-15 (S)** Token-pair contrast test across themes.
- [ ] **P4-16 (M)** Spanish review by fluent providers; sign-off checklist per screen.

### 4.3 Auth screens
- [ ] **P4-20 (M)** Login page with validation and language toggle.
- [ ] **P4-21 (M)** Account setup page: live password checklist; expired-link state with "request new link".
- [ ] **P4-22 (S)** Forgot-password and reset-confirm pages.

### 4.4 Chart entry (View = `FormRenderer`, Controller = `ChartController`/`useChart`)
- [ ] **P4-30 (M)** Call-type picker (Clinic / Ambulance) then nature of call; large touch cards.
- [ ] **P4-31 (L)** `FormRenderer.render(formDefinition, values)`: text, number, select, multiselect, radio, checkbox, date, timestamp, body-region picker, repeating rows (medications, procedures, vitals, fluids); `showErrors(errors)`.
- [ ] **P4-32 (M)** `ChartController`: `onFieldChange`, `autosave`, `submit`; client validation reusing the definition; focus first error.
- [ ] **P4-33 (M)** Stepper with progress; **≤10 fields per screen**. Reqs: NFR12.
- [ ] **P4-34 (M)** Timestamp sidebar visible on every step: dispatch, en route, arrive, patient contact, depart, arrive at destination, transfer; plus incident number, unit, meds given, patient name. Timestamps editable from the sidebar (Joel's request). Reqs: FR22.
- [ ] **P4-35 (M)** Patient step: search existing or create; duplicate warning.
- [ ] **P4-36 (L)** Interventions step (medications, procedures, vitals, fluids) with a spell-check hook ready for FR31.
- [ ] **P4-37 (M)** Review screen: read-only summary, missing required fields linked, confirm dialog on submit.
- [ ] **P4-38 (M)** Autosave: debounce, "Saved at hh:mm" / "Not saved", server draft + local fallback, restore prompt within TTL; "save now" button. Reqs: FR13.
- [ ] **P4-39 (S)** Trainee mode: "Practice chart: not saved to patient records" banner and distinct accent. Reqs: FR23.
- [ ] **P4-40 (M)** Attachment step: size/type feedback, thumbnails, remove before submit. Reqs: FR17.
- [ ] **P4-41 (M)** Consent/AMA signature pad (touch and stylus), language switch for text. Reqs: FR16.
- [ ] **P4-42 (S)** Help button/tooltips next to complex fields (moderate-low priority from interviews).

### 4.5 Browsing and addenda
- [ ] **P4-50 (M)** Chart list: search by name/date, filters, pagination, empty/error states.
- [ ] **P4-51 (M)** Chart detail: read-only, grouped by section, form version, author, attachments, addenda; **no edit controls**.
- [ ] **P4-52 (S)** Add-addendum panel (Provider/Admin).
- [ ] **P4-53 (S)** PDF and CSV download buttons (current language).

### 4.6 Dashboard
- [ ] **P4-60 (M)** Filter bar (date range, visit type, incident type) bound to URL params; side-by-side date-range comparison.
- [ ] **P4-61 (L)** Metric cards with trend arrows and plain-language text; charts with accessible text alternatives plus a table of raw numbers.
- [ ] **P4-62 (S)** Export buttons for current filter.
- [ ] **P4-63 (S)** Board role sees dashboard only, no chart links.
- [ ] **P4-64 (S)** Metrics read from server config (P3-85).

### 4.7 Admin and settings
- [ ] **P4-70 (M)** User table: search, role dropdown, active toggle, send setup link, reset password, status badges.
- [ ] **P4-71 (S)** Create-user dialog.
- [ ] **P4-72 (M)** Audit log viewer.
- [ ] **P4-73 (M)** Admin security settings page (lockout threshold, minimum password length; 2-step sign-in only if scoped). Confirm which settings are really in scope.
- [ ] **P4-74 (S)** User settings: email, password, language, theme.
- [ ] **P4-75 (M)** Form field manager (FR30, Level 3).

### 4.8 Retire legacy frontend
- [ ] **P4-80 (S)** Feature parity checklist against P0-24; each old screen has an equivalent or a "dropped" decision.
- [ ] **P4-81 (S)** Remove canvasjs, jspdf, html2canvas, moment, bootstrap, MUI v4.

---

## Phase 5: Security and compliance (FR11, FR21, NFR4–NFR7)

- [ ] **P5-01 (M)** STRIDE threat model → `docs/threat-model.md`.
- [ ] **P5-02 (S)** Map HIPAA technical safeguards to controls.
- [ ] **P5-03 (M)** Review NOM-024-SSA3-2012 with Bryan and a compliance adviser; ticket gaps; don't claim compliance without sign-off.
- [ ] **P5-04 (S)** Data classification (PHI/identifier/other) driving log redaction and export rules.
- [ ] **P5-05 (S)** Retention policy with Rescate. Charts are immutable; interview says minimum 10 years, goal indefinite, while UC04 says 5 years minimum in Mexico. Settle one number.
- [ ] **P5-06 (M)** OWASP ZAP baseline against staging; fix findings.
- [ ] **P5-07 (S)** `npm audit` in CI; fail on high/critical.
- [ ] **P5-08 (S)** Secrets management and rotation procedure.
- [ ] **P5-09 (S)** Verify cookie flags and headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy).
- [ ] **P5-10 (M)** Access-log review procedure; test with a mock incident.
- [ ] **P5-11 (S)** One-page incident response (breach, lost tablet, compromised account).
- [ ] **P5-12 (S)** Backup security: encryption, access list, quarterly restore drill.
- [ ] **P5-13 (S)** Teammate-run pen-test checklist: privilege escalation across all role pairs, IDOR on chart/attachment UUIDs, token reuse, session fixation.
- [ ] **P5-14 (S)** Confirm no PHI in logs, URLs, errors, or analytics.

---

## Phase 6: Testing and quality (NFR1–NFR3, NFR13, NFR14)

- [ ] **P6-01 (M)** Unit tests for services (lifecycle, validation, policy, tokens, password policy) to ≥70% backend coverage with CI gate.
- [ ] **P6-02 (M)** Integration tests per endpoint with a real DB (immutability, 10-minute links, search limits, concurrency).
- [ ] **P6-03 (M)** Contract tests: OpenAPI vs generated frontend client.
- [ ] **P6-04 (L)** Playwright flows: login → clinic chart → submit → addendum; ambulance chart with autosave recovery; admin creates user → setup email → login; Board sees dashboard only; Trainee practice chart; language toggle; idle timeout.
- [ ] **P6-05 (M)** k6 performance: pages ≤2 s at 10 Mbps (NFR1), search ≤2 s at 50k (NFR2), 25 concurrent users ≤10% degradation (NFR3).
- [ ] **P6-06 (S)** Generator for 50,000+ synthetic charts.
- [ ] **P6-07 (M)** Accessibility audits: axe/Lighthouse plus manual keyboard and screen-reader pass.
- [ ] **P6-08 (M)** Usability test: ≥3 new volunteers complete a basic chart within 10 minutes of training. Book volunteers early. Reqs: NFR13.
- [ ] **P6-09 (S)** Spanish review with 2 bilingual providers.
- [ ] **P6-10 (M)** Test on the clinic's actual tablets. Reqs: FR9.
- [ ] **P6-11 (S)** Synthetic-data-only policy in dev/test.
- [ ] **P6-12 (S)** Regression tests for every P0-30 legacy vulnerability.
- [ ] **P6-13 (S)** `docs/traceability.md`: each FR/NFR → tests and verification method; CI check that each ID appears in a test.

---

## Phase 7: Deployment, operations and cutover

### 7.1 Deployment (NFR5, NFR9, NFR10)
- [ ] **P7-01 (M)** Dockerfiles; docker-compose for dev (db, mailhog, MinIO, api, web).
- [ ] **P7-02 (M)** `dev`, `staging` (synthetic data), `production` with separate secrets and DBs.
- [ ] **P7-03 (M)** Hosting per ADR-006: DB, object storage, domain, auto-renewing TLS.
- [ ] **P7-04 (M)** CD: merge to `main` → staging; manual approval → production; migrations after the backup gate.
- [ ] **P7-05 (S)** Maintenance-window procedure (planned maintenance excluded from uptime).
- [ ] **P7-06 (M)** Monitoring: `/healthz` uptime, error tracking with PHI scrubbing, disk/DB alerts, backup alert. Reqs: NFR10 (98% monthly).
- [ ] **P7-07 (S)** Runbook: restart, restore, rotate secrets, add a user manually, read audit logs.
- [ ] **P7-08 (S)** Disaster-recovery drill; document RTO/RPO.
- [ ] **P7-09 (S)** Log retention/rotation; patching schedule with an owner.

### 7.2 Cutover
- [ ] **P7-20 (S)** Cutover plan: date, owner, freeze window, rollback conditions, paper fallback.
- [ ] **P7-21 (S)** Final legacy backup + verification.
- [ ] **P7-22 (M)** Run ETL on final data; verify; sign-off from two teammates and Bryan.
- [ ] **P7-23 (S)** Send setup links to all existing users.
- [ ] **P7-24 (S)** Production smoke tests: login, find a migrated chart, view addendum, export PDF, practice chart.
- [ ] **P7-25 (S)** Switch URL; legacy read-only or offline; keep DB snapshot.
- [ ] **P7-26 (S)** Two weeks of close monitoring.
- [ ] **P7-27 (S)** Rehearse rollback, including what happens to charts entered after cutover.
- [ ] **P7-28 (S)** Agree legacy snapshot retention/disposal with Rescate.
- [ ] **P7-29 (M)** EN/ES training guides and one live session per role. Reqs: NFR13.

---

## Phase 8: Level 2 features (FR14–FR24)

Most FR22–FR24 work is already placed in Phases 3–4; this phase holds offline and polish.

### 8.1 Offline and sync (FR14, FR15, NFR4, NFR8)
- [ ] **P8-01 (M)** Agree offline scope with Rescate (chart entry only, or also search?).
- [ ] **P8-02 (M)** PWA basics: manifest, service worker, install prompt, update flow that never interrupts an in-progress chart.
- [ ] **P8-03 (L)** Encrypted local store (IndexedDB/Dexie, AES-GCM, key from login, wiped on logout/idle).
- [ ] **P8-04 (L)** Client `ChartRepository`-style abstraction with online and offline implementations so UI code doesn't change.
- [ ] **P8-05 (L)** Outbox of operations with client UUIDs and idempotency keys; persisted before UI says "saved".
- [ ] **P8-06 (L)** Server `/sync/push`: idempotent, per-item results, no duplicates on retry, conflicts flagged not merged; sets `needs_review`. Reqs: FR15.
- [ ] **P8-07 (M)** Retry with backoff; banner for pending/failed items. Reqs: NFR8.
- [ ] **P8-08 (M)** Purge local data after server ack; test it. Reqs: NFR4.
- [ ] **P8-09 (M)** Offline unlock of the local store for a previously signed-in user.
- [ ] **P8-10 (L)** Failure-injection tests: tab killed mid-write, airplane mode mid-submit, clock skew, duplicate requests, 500 mid-batch; assert zero loss.
- [ ] **P8-11 (S)** Flag incomplete records at sync time instead of rejecting silently.

### 8.2 Other Level 2
- [ ] **P8-20 (M)** Tablet image capture and compression (camera, EXIF stripping, orientation). Reqs: FR17.
- [ ] **P8-21 (M)** Signature screens polished for tablets; consent text versioning. Reqs: FR16.
- [ ] **P8-22 (M)** Dashboard metric workshop with Rescate and Board. Reqs: FR19.
- [ ] **P8-23 (M)** Pre-filled practice scenarios for trainees. Reqs: FR23.
- [ ] **P8-24 (S)** Dark-mode QA across every screen and chart. Reqs: FR24.

---

## Phase 9: Level 3 features (if time allows)

- [ ] **P9-01 (L)** Medication spell-check (bilingual dictionary, fuzzy match, offline-capable). Reqs: FR31.
- [ ] **P9-02 (M)** Trend alerts (rolling-window job, thresholds, notification). Reqs: FR27.
- [ ] **P9-03 (M)** High/low contrast themes and dyslexia-friendly font per user. Reqs: FR26.
- [ ] **P9-04 (M)** Additional languages workflow. Reqs: FR29.
- [ ] **P9-05 (L)** Admin-configurable fields UI with versioning and preview. Reqs: FR30.
- [ ] **P9-06 (L)** Open-source packaging: Rescate-specific content to config, license, docs. Reqs: FR28.
- [ ] **P9-07 (L)** Capacitor wrap for iOS/Android; evaluate store-review and background-sync risk. Reqs: FR25.

---

## Phase 10: Remaining documentation

- [ ] **P10-01 (S)** API docs published from OpenAPI.
- [ ] **P10-02 (S)** ADRs complete (P0-50…P0-59) and linked from the README.
- [ ] **P10-03 (S)** User guides (EN/ES) and a short admin guide.
- [ ] **P10-04 (S)** Maintenance guide for future volunteers: add a user, change a field, restore a backup.

---

## Open questions (resolve with Bryan or the instructors)

1. **Trainee data.** FR23/UC18 say practice submissions are discarded and never reach the DB; §4.2 puts `isPractice` on `Chart`, which implies storing them. Decide before P3-62 (ADR-010).
2. **Retention.** 10 years minimum (interview) vs 5 years minimum (UC04). See P5-05.
3. **Admin security settings.** UC13 lists two-step sign-in and lockout after 5 failures; FR/NFR list neither two-step nor configurable lockout. Confirm scope.
4. **DB engine.** MySQL vs PostgreSQL (ADR-002) before P2-03.
5. **Attachment limits.** Interviewees only need EKG and medication-list images; storage size was flagged as a semi-technical answer to be treated with caution.
6. **Requirements not mapped to a class in §4.2:** FR9, FR14, FR21, FR22 (sidebar view), FR23–FR29, NFR1, NFR3, NFR4, NFR5, NFR8, NFR10–NFR15. Tasks above cover them; keep the traceability matrix in sync.

## Suggested order

| Period | Focus | Exit check |
|---|---|---|
| Now–Oct 28 | Phase 1 (design report), P0-02…P0-12 | Report submitted; schema and class names agree |
| Next 2 weeks | P0-20…P0-31 (audit), P0-40…P0-43 (backups), ADRs | Legacy runs, backups restore, data profile written, decisions recorded |
| Then | Phase 2.1–2.2 (schema, forms), P3-01…P3-10, P3-20…P3-26 | New DB migrates from scratch; API boots with CI green; repositories tested |
| Then | P3-30…P3-45 (security, auth), P4-01…P4-08, P4-20…P4-22 | Login, setup link, reset link, role matrix tests green |
| Then | P3-50…P3-69 (forms, drafts, charts, addenda), P4-30…P4-41, ETL v1 (P2-30…P2-39) | Chart can be drafted, submitted, searched, amended; ETL dry run on sample data |
| Spring 2027 | Dashboard, offline (Phase 8), testing, cutover (Phase 7) | Usability test passed; cutover rehearsed twice; done by May 2027 |

## Highest-risk items to start early

1. **P0-22 data profiling and P2-34 chart transform** (unknown data quality, Spanish strings, text columns).
2. **ADR-002 database and ADR-006 hosting/compliance** (block infrastructure and encryption).
3. **P3-22 `ChartRepository` single-transaction insert across ~15 section tables** and **P3-64 search at 50,000 rows** (index design affects the schema).
4. **P8-03…P8-10 offline store and sync** (hardest engineering; keep the client/server seam clean now).



---

## Prototype: "DB ↔ backend ↔ frontend, see charts"

Goal: prove the stack is wired end to end. A user opens the web app, the app calls the API, the API reads the database, and a list of charts appears. Throwaway quality is fine. No auth, drafts, offline, forms, or dashboard. Use synthetic data only (P0-21 / P6-11).

**Scope: in**
- One database with 2 required tables (`patients`, `charts`) and optionally `ambulance_calls`/`clinic_visits`, with a few seeded rows.
- One API: `GET /healthz`, `GET /charts`, `GET /charts/:uuid`, going Route → Service → Repository (so the layering is real from day one).
- One web page: chart list, click a row to see detail.

### Steps
- [ ] **PR-01 (S)** Pick the stack for the prototype per ADR-002/003/004  *Done when:* the team agrees and the choice is written down.
- [ ] **PR-02 (S)** Create the repo layout from P0-02. Do not touch the legacy `backend/` and `frontend/`. *Done when:* both apps install and start with an empty hello page / `/healthz`.
- [ ] **PR-03 (S)** Start a local database (docker-compose or local MySQL) and add a `.env.example` with the connection settings. No real secrets in git. *Done when:* the DB runs and you can connect with a client.
- [ ] **PR-04 (M)** First migration creating `patients` and `charts` (shared columns from §4.3: `id`, `chart_uuid`, `patient_id`, `created_by`, `visit_type`, `incident_date`, `disposition`, `submitted_at`), with PK/FK/unique keys. Optionally add `ambulance_calls` and `clinic_visits` 1:1 on `chart_id`. *Done when:* the migration runs on an empty DB.
- [ ] **PR-05 (S)** Seed script inserting about 10 fake patients and 15 fake charts (mix of clinic and ambulance). *Done when:* `SELECT COUNT(*) FROM charts` returns the seeded count.
- [ ] **PR-06 (S)** One-command reset (`npm run db:reset`): create, migrate, seed. *Done when:* a teammate runs it from a clean clone.
- [ ] **PR-07 (S)** API skeleton: env config, DB pool, `GET /healthz` that runs `SELECT 1`. *Done when:* `curl localhost:<port>/healthz` returns OK only when the DB is reachable (stop the DB and confirm it fails).
- [ ] **PR-08 (M)** Repository layer: `ChartRepository.search(filters, page)` and `findByUuid(uuid)` (read-only, no update/delete methods), joining the patient name. *Done when:* a repository test against the seeded DB returns expected rows.
- [ ] **PR-09 (S)** Service layer: `ChartService.search` and `get` that call the repository; routes call the service only. *Done when:* the routes contain no SQL.
- [ ] **PR-10 (S)** Routes `GET /charts` (with `page`, optional `name` filter) and `GET /charts/:uuid`, returning JSON; 404 for an unknown uuid. *Done when:* `curl` shows the seeded charts.
- [ ] **PR-11 (S)** CORS for the web dev origin only. *Done when:* the browser can call the API without CORS errors.
- [ ] **PR-12 (S)** Web: API client wrapper with base URL from env. *Done when:* the app fetches `/healthz` and shows "API connected".
- [ ] **PR-13 (M)** Web: chart list page (date, patient name, visit type, disposition) with loading, empty and error states. *Done when:* the page shows all seeded charts.
- [ ] **PR-14 (S)** Web: read-only chart detail page opened from a list row via `/charts/:uuid`. *Done when:* clicking a row shows that chart's fields.
- [ ] **PR-15 (S)** Smoke tests: an API integration test on `GET /charts` against the seeded test DB, plus one Playwright check that the list shows the expected row count. *Done when:* both pass locally.
- [ ] **PR-16 (S)** Run instructions (clone, `.env`, `db:reset`, start api, start web) in `docs/prototype.md`. *Done when:* a teammate who didn't build it reaches the chart list in under 10 minutes.
- [ ] **PR-17 (S)** Demo checklist: (1) rows in the DB client, (2) `curl /charts`, (3) web list, (4) chart detail, (5) stop the DB and show the error state. *Done when:* rehearsed once.

### Stretch (still below MVP)
- [ ] **PR-20 (M)** Load a sanitized sample of legacy charts via a throwaway script (P0-21, P0-22) to show real-shaped data.
- [ ] **PR-21 (S)** Name filter box on the list calling `GET /charts?name=`.
- [ ] **PR-22 (S)** Hard-coded role switch (no real login) that hides the list for "Board", to preview FR2.
