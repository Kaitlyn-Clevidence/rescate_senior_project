# Rescate Repo Map

Related docs: [todo.md](todo.md) (task IDs cited below), [legacy-audit.md](legacy-audit.md).

---

## Part 1: Legacy folder

The legacy code has been moved under `legacy/` (task P0-02 started). Nothing new imports from it.

```
rescate_senior_project/
├── .github/
│   └── pull_request_template.md
├── .gitignore
├── README.md                     currently empty
├── docs/
│   ├── repo-map.md               this file
│   ├── todo.md                   master to-do list (P0…P10 + prototype appendix)
│   └── legacy-audit.md           currently empty; findings from running the legacy system (P0-20)
│
└── legacy/                       FROZEN, read-only reference
    ├── legacy_README.md          startup instructions for legacy system 
    ├── backend/                  Node + Express + MySQL
    │   ├── app.js                bootstrap, CORS pinned to localhost:3001
    │   ├── middleware/           auth.js (JWT cookie), rate_limiter.js (per-IP, in DB)
    │   ├── routes/
    │   │   ├── router.js, controller.js, repository.js   login, logout, register, forgot, change-password
    │   │   ├── charts/           add, list, view, update, summary, calls, files
    │   │   ├── patients/  users/  notes/
    │   ├── pdf/                  pdfkit renderer, img/, locales/ (EN.json, ES.json)
    │   └── sql/database.js       MySQL pool + CREATE TABLE IF NOT EXISTS
    │                             (users, charts, patients, notes, ratelimiters)
    └── frontend/epcr-system/     Create React App 4, React 17
        └── src/
            ├── App.js, Routes.js, Auth.js, i18nextConf.js
            ├── locales/{en,es}/translation.json
            ├── views/            Login, Reset, Dashboard, Settings, Statistics
            └── components/       chart entry (ChartForm, AddCall, AddPatient,
                                  AddInterventions, PhysicalAssessment, Confirm),
                                  chart viewing (ViewCharts, ViewChart, ShowMed…),
                                  Attachments, Notes, SummaryReport, TrendCall,
                                  user/admin screens, MainNav
```

### Where legacy things live

| Looking for | Go to |
|---|---|
| Database schema | `legacy/backend/sql/database.js` |
| Login, reset, password hashing | `legacy/backend/routes/repository.js` |
| Chart queries and summary counters | `legacy/backend/routes/charts/repository.js` |
| Role checks (`privilege === "admin"`) | `legacy/backend/routes/*/controller.js` |
| File upload/download | `legacy/backend/routes/charts/controller.js` |
| PDF layout and translations | `legacy/backend/pdf/` |
| UI route list and auth state | `legacy/frontend/epcr-system/src/App.js` |
| Chart form | `src/components/ChartForm.js` and children |
| English/Spanish text | `src/locales/` |

---

## Part 2: Target structure

Monorepo (npm workspaces):

```
rescate_senior_project/
├── .github/
│   ├── pull_request_template.md
│   ├── CODEOWNERS                    security/, repositories/, migrations/, services/AuthService, AuditLogger
│   ├── dependabot.yml                keep track of dependencies and updates
│   └── workflows/
│       ├── ci.yml                    lint, typecheck, test, 70% coverage gate, build, gitleaks, npm audit
│       ├── e2e.yml                   Playwright against docker-compose
│       └── deploy.yml                staging auto, prod manual, backup gate first
│
├── package.json                      workspaces: apps/*, packages/*
├── tsconfig.base.json
├── docker-compose.yml                db, mailhog, minio, api, web
├── .env.example                      names only
├── README.md                         run, test, migrate, deploy
│
├── apps/
│   ├── api/                          SERVER: Node + TypeScript (layered)
│   │   ├── src/
│   │   │   ├── main.ts               bootstrap, graceful shutdown
│   │   │   ├── config/               typed env (zod)
│   │   │   │
│   │   │   ├── http/                 REST/JSON edge (the only link to the client)
│   │   │   │   ├── routes/           one file per resource; each route declares a permission
│   │   │   │   │                     auth, users, charts, drafts, addenda, forms,
│   │   │   │   │                     attachments, consent, reports, audit, healthz
│   │   │   │   └── middleware/       validate (zod), csrf, requestId, errorHandler
│   │   │   │
│   │   │   ├── security/             SECURITY LAYER (3 classes)
│   │   │   │   ├── RateLimiter.ts        hit(key), isBlocked(key)       FR11, NFR6
│   │   │   │   ├── SessionManager.ts     authenticate, touch; 15-min idle  FR1, NFR7
│   │   │   │   └── PolicyGuard.ts        can, authorize; deny by default   FR2
│   │   │   │
│   │   │   ├── services/             SERVICES LAYER (10 classes)
│   │   │   │   ├── AuthService.ts            login, logout
│   │   │   │   ├── AccountService.ts         createUser, changeRole, requestReset, completeSetup
│   │   │   │   ├── ChartService.ts           createDraft, submit, search, get
│   │   │   │   ├── DraftStore.ts             put, get, discard (TTL, outside chart tables)
│   │   │   │   ├── AddendumService.ts        add, listForChart
│   │   │   │   ├── ConsentFormService.ts     sign, listForChart
│   │   │   │   ├── FormDefinitionService.ts  getForm, requiredSections, validate, addField
│   │   │   │   ├── AttachmentService.ts      upload, download
│   │   │   │   ├── ReportService.ts          summary, trend, exportCsv, exportPdf
│   │   │   │   └── AuditLogger.ts            record, query
│   │   │   │
│   │   │   ├── repositories/         REPOSITORIES LAYER (6 classes, ONLY code that touches DB)
│   │   │   │   ├── ChartRepository.ts        insertSubmitted (one transaction), findByUuid, search. No update/delete.
│   │   │   │   ├── PatientRepository.ts      create, findByName
│   │   │   │   ├── UserRepository.ts         findByEmail, create, updateRole, saveToken, consumeToken
│   │   │   │   ├── NoteRepository.ts         insert, listByChart
│   │   │   │   ├── AttachmentRepository.ts   insert, findByUuid
│   │   │   │   └── LegacyArchiveRepository.ts  insertRaw, findByLegacyId (used by the migration)
│   │   │   │
│   │   │   ├── domain/               DOMAIN MODEL (21 classes), no I/O
│   │   │   │   ├── User.ts  Patient.ts
│   │   │   │   ├── Chart.ts (abstract)  AmbulanceChart.ts  ClinicChart.ts  ChartDraft.ts
│   │   │   │   ├── TransportInfo.ts  CrewMember.ts  VehicleAccident.ts  WoundCare.ts
│   │   │   │   ├── Vital.ts  Note.ts  Attachment.ts  ConsentForm.ts
│   │   │   │   ├── ChartPatientInfo.ts  Assessment.ts  PhysicalExam.ts  Obstetrics.ts
│   │   │   │   └── FluidEntry.ts  MedicationGiven.ts  ProcedurePerformed.ts
│   │   │   │
│   │   │   ├── infra/                INFRASTRUCTURE
│   │   │   │   ├── db/               pool, transaction helper
│   │   │   │   ├── MailService.ts        sendSetup, sendReset (EN/ES templates)
│   │   │   │   ├── storage/              adapter: local disk, S3/MinIO
│   │   │   │   └── logger.ts             pino, PHI redaction
│   │   │   └── jobs/                 draft cleanup, nightly backup, trend alerts
│   │   │
│   │   ├── migrations/               versioned SQL (users, patients, charts, ambulance_calls,
│   │   │                             clinic_visits, transports, vitals, notes, attachments, …)
│   │   ├── seeds/                    admin, one user per role, fake patients and charts
│   │   ├── test/                     integration tests, factories, test DB setup
│   │   ├── pdf/                      pdfkit templates + EN/ES locales (ported from legacy)
│   │   └── package.json
│   │
│   └── web/                          CLIENT: React 18 + Vite + TypeScript (MVC)
│       ├── src/
│       │   ├── main.tsx
│       │   ├── app/                  router, providers, role-aware route guards
│       │   ├── api/                  the single API client (only link to the server)
│       │   ├── features/
│       │   │   ├── auth/             Login, Setup, Reset; useAuth (session, idle timer)   [Controller]
│       │   │   ├── chart-entry/      ChartController + useChart (autosave, validation)   [Controller]
│       │   │   │                     FormRenderer, Stepper (≤10 fields/screen),
│       │   │   │                     TimestampSidebar, Review, Signature                  [View]
│       │   │   ├── charts/           ChartList, ChartDetail (read-only), AddendumPanel
│       │   │   ├── dashboard/        Filters, MetricCard, Trends, Export
│       │   │   ├── admin/            UserTable, AuditLog, FormFields
│       │   │   └── settings/         language, theme
│       │   ├── components/           Button, Field, Dialog, Banner
│       │   ├── i18n/                 en/ and es/ catalogs + option labels
│       │   ├── theme/                tokens: light, dark (night mode), later high contrast
│       │   └── offline/              Level 2 (FR14): local store, outbox, sync; empty for now
│       │   (Model = draft values, form definition, user/role, language held in feature state)
│       ├── e2e/                      Playwright flows
│       └── package.json
│
├── packages/
│   └── shared/
│       └── src/
│           ├── permissions.ts        roles × permissions, single source of truth
│           ├── password-policy.ts    ≥12 chars + special character, both sides
│           ├── options/              option codes with en/es labels
│           ├── forms/                form-definition types + schema
│           └── types/                request/response types
│
├── forms/                            form definitions as data (required sections per nature of call)
│   ├── clinic.v1.json
│   ├── ambulance.v1.json
│   └── README.md                     how to add a field or call type
│
├── scripts/
│   ├── backup-legacy.sh  restore-test.sh  db-reset.sh  gen-fake-charts.ts
│   └── etl/                          MigrationRunner: backup() → migrate() → verifyCounts()
│       ├── extract.ts  load.ts  verify.ts
│       ├── transform/                patients, charts, notes, users, attachments
│       └── mappings/                 option-codes.csv
│
├── legacy/                           frozen, read-only (tag legacy-v1)
│
└── docs/
    ├── repo-map.md  todo.md  legacy-audit.md
    ├── adr/                          ADR-001 … ADR-010 (architecture, DB, session, immutability, trainee data)
    ├── diagrams/                     layered view, ER diagram, use cases
    ├── prototype.md                  stack choice + run instructions (PR-01, PR-16)
    ├── legacy-data-profile.md        P0-22 output
    ├── field-inventory.csv           P0-25 output
    ├── threat-model.md  traceability.md  runbook.md
```

### Class → file coverage

| Subsystem | Count | Lives in |
|---|---|---|
| Domain model | 21 | `apps/api/src/domain/` |
| Presentation | 2 | `FormRenderer`, `ChartController` in `apps/web/src/features/chart-entry/` |
| Security layer | 3 | `apps/api/src/security/` |
| Services layer | 10 | `apps/api/src/services/` |
| Repositories layer | 6 | `apps/api/src/repositories/` |
| Infrastructure and tools | 2 | `MailService` in `infra/`, `MigrationRunner` in `scripts/etl/` |

### Data design → migrations

| Table(s) | Built by |
|---|---|
| `users`, `patients`, `charts` | first migration (prototype PR-04) |
| `ambulance_calls`, `clinic_visits` | 1:1 on `chart_id`; visit-specific fields (NFR12) |
| `vitals`, `notes`, `attachments` | core tables from §4.3 |
| `chart_forms` (consent/AMA), `chart_patient_info`, `assessments`, `physical_exam`, `obstetrics`, `fluid_intake_output`, `medications_given`, `procedures_performed`, `chart_crew`, `vehicle_accident`, `wound_care`, `transports` | section tables, attached only when the nature of call requires them |
| `charts_v1_archive` | migration safety net (`LegacyArchiveRepository`) |
| `chart_drafts`, `audit_log`, auth tokens | cache/ops tables outside the chart tables |
| *(no `rate_limiters` table)* | `RateLimiter` replaces it |

### How the structure maps to the patterns

| Pattern | Where it lives |
|---|---|
| Client-server | `apps/web` talks to `apps/api` only through `apps/web/src/api` over HTTPS REST/JSON |
| Layered (server) | `http/` → `security/` → `services/` → `repositories/` → DB/storage |
| MVC (client) | Model: feature state; View: `FormRenderer`, `ChartList`, `Dashboard`, sidebar; Controller: `ChartController`, `useChart`, `useAuth` |
| Repository | Only `repositories/` and `migrations/` touch the database |
| Pipe and filter | `scripts/etl/`, `ReportService` |

### Rules that keep it clean

1. Calls go down only: route → security → service → repository. A service may call another **service**, never another's repository.
2. Routes contain no SQL and no business rules; services never import the DB driver.
3. `apps/web` and `apps/api` never import each other. Shared code goes in `packages/shared`.
4. Permissions are defined once in `packages/shared/src/permissions.ts`; `User.can()` and `PolicyGuard` use it. Deny by default.
5. `ChartRepository` has no update or delete method; the DB blocks it too (FR12).
6. Form content is data in `forms/`; a new nature of call changes only `FormDefinitionService` rules.
7. Nothing imports from `legacy/`. The ETL reads the legacy **database**, not the code.
8. Synthetic data only in the repo, tests and dev.

---

## Part 3: Prototype

Bare minimum; Goal: DB → API → web list and detail of charts.
Must also include tests;

```
apps/
├── api/
│   ├── src/
│   │   ├── main.ts                    PR-07  /healthz runs SELECT 1
│   │   ├── config/                    PR-07
│   │   ├── http/routes/charts.ts      PR-10  GET /charts, GET /charts/:uuid; CORS PR-11
│   │   ├── services/ChartService.ts   PR-09  search, get (calls repository only)
│   │   ├── repositories/ChartRepository.ts  PR-08  search, findByUuid (read-only)
│   │   └── infra/db/                  PR-07  pool
│   ├── migrations/0001_init.sql       PR-04  patients, charts (+ optional visit tables)
│   ├── seeds/                         PR-05  ~10 patients, ~15 charts
│   └── test/                          PR-15  GET /charts integration test
└── web/
    └── src/
        ├── api/                       PR-12  client + "API connected"
        ├── features/charts/           PR-13 ChartList, PR-14 ChartDetail
        └── e2e/                       PR-15  list shows expected row count
docker-compose.yml                     PR-03  db only
.env.example                           PR-03
scripts/db-reset.sh                    PR-06  create, migrate, seed
docs/prototype.md                      PR-01, PR-16
```