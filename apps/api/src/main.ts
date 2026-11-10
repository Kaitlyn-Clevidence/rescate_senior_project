// Author(s): Sophia Koshy & Kaitlyn Clevidence
// Start date: 2026-11-06
// Last updated: 2026-11-07
// P4: Prototype 
// Purpose: entry point to connect the real database repository to the Fastify app

import { config } from "./config/index.js";
import { createDb } from "./db/index.js";
import { createChartRepository } from "./repositories/ChartRepository.js";
import { createPatientRepository } from "./repositories/PatientRepository.js";
import { buildApp } from "./http/app.js";

const db = createDb(config.db);
const app = buildApp({
  charts: createChartRepository(db),
  patients: createPatientRepository(db),
});
try {
  await app.listen({ port: config.port, host: "127.0.0.1" });
} catch (error) {
  app.log.error(error);
  await db.destroy();
  process.exit(1);
}
