# Prototype (P4)

Goal: prove the stack end to end. DB → API → web, with a chart list and chart detail.

```
Browser (React + Vite)  →  Fastify route  →  Service  →  Repository  →  MySQL 8 (Docker)  
```

### P4 minimum

| PR | What | Done when |
|---|---|---|
| PR-03 | `docker-compose.yml` (db only, named volume), `.env.example` | Container starts; `mysql` client connects |
| PR-04 | `apps/api/migrations/0001_init.sql` (patients, charts, both with uuid) | Tables exist after running it |
| PR-05 | Seed data. 2–3 rows is enough for P4; ~10 patients / ~15 charts later | Select returns the rows |
| PR-07 | API config, DB pool, `GET /healthz` runs `SELECT 1` | `/healthz` returns OK with DB up |
| PR-08 | `ChartRepository` (search, findByUuid), read-only, only file with SQL | Returns rows from the DB |
| PR-10 | `GET /charts` (and `GET /charts/:uuid` if time) | JSON visible in browser |
| PR-11 | CORS, allowed origin from config | Web app can call the API |
| PR-12 | Web API client (fetch helper); "API connected" indicator is optional | List page can fetch |
| PR-13 | `ChartList` page | Table shows seeded charts |
| PR-15 (reduced) | One API unit test and one web component test | `npm test` passes in both apps |
| PR-16 | Screenshots, README run steps, release tag | Tag pushed |

CORS (PR-11) is required, not polish: the web app is on a different origin than the API.

### After P4

| PR | What | Why it can wait |
|---|---|---|
| PR-06 | `scripts/db-reset.sh` (drop, create, migrate, seed) | Re-running the SQL by hand works for a few rows |
| PR-09 | `ChartService` (stub search filter) | Route can call the repository directly for now |
| PR-14 | `ChartDetail` page and the router (`/` and `/charts/:uuid`) | List page already proves all layers |
| PR-10 (rest) | UUID format validation, 404 handling polish | Basic route is enough to demo |
| PR-15 (rest) | Service unit test with fake repo, `GET /charts` integration test against seeded DB, detail test | One unit test per app satisfies P4 |
| Extra | Playwright browser test (`apps/web/e2e`) | Largest setup cost; optional |
| Extra | Full seed volume; `packages/shared` types | Add once the data shape settles |

---

## 3. Target layout

```
rescate_senior_project/
├── docker-compose.yml             
├── .env.example                   
├── README.md                      startup order: DB → (reset) → API → web
├── docs/prototype.md              
├── scripts/db-reset.sh            
└── apps/
    ├── api/
    │   ├── migrations/0001_init.sql        
    │   ├── seeds/001_sample_data.sql       
    │   ├── src/
    │   │   ├── main.ts                     
    │   │   ├── config/                     
    │   │   ├── infra/db/                   
    │   │   ├── repositories/ChartRepository.ts   
    │   │   ├── services/ChartService.ts    
    │   │   └── http/routes/{health,charts}.ts    
    │   └── test/                           
    └── web/
        └── src/
            ├── api/                        
            └── features/charts/            
```

`legacy/` stays frozen; nothing imports from it.

---

## 4. How to run:

1. `docker compose up -d`
2. Apply the migration and seed (manually until PR-06 exists)
3. API: `cd apps/api && npm run dev`
4. Web: `cd apps/web && npm run dev`, open the Vite URL
5. Tests: `npm test` in each app (the API integration test needs the seeded DB)

---

## 5. UI snapshots (PR-16)

Checklist of screenshots to capture, each with a one-line caption:

- [ ] Chart list page after load
- [ ] Chart detail page (if built)
- [ ] API terminal showing structured JSON request logs
- [ ] `npm test` passing in api and web
- [ ] MySQL query result from the container

## 6. Known knowns / unknowns

Seed list of known unknowns: hosting and compliance for real patient data, backup strategy, auth, migration tooling choice, offline support (see `apps/web/src/offline`).

## 7. Release tag

After the P4 minimum is merged: annotated tag `v0.1-prototype` on `3-prototype`, pushed to origin.
