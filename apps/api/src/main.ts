// Author(s): Sophia Koshy, Isabel Sullivan, Kaitlyn Clevidence
// Start date: 2026-11-06
// Last updated: 2026-11-20
// P5: MVP
// Purpose: entry point to connect the real database repository to the Fastify app
// also creates the mail and account services for invites and setup

import { config } from "./config/index.js";
import { createDb } from "./db/index.js";
import { createChartRepository } from "./repositories/ChartRepository.js";
import { createPatientRepository } from "./repositories/PatientRepository.js";
import { createUserRepository } from "./repositories/UserRepository.js";
import { createAccountService } from "./services/AccountService.js";
import { createMailService, createMailTransport } from "./services/MailService.js";
import { buildApp } from "./http/app.js";

const SETUP_LINK_MINUTES = 60 * 24;

const db = createDb(config.db);
const mail = createMailService(createMailTransport(config.mail), config.mail.from);
const accounts = createAccountService(createUserRepository(db), mail, {
  appUrl: config.appUrl,
  setupLinkMinutes: SETUP_LINK_MINUTES,
});

const app = buildApp({
  charts: createChartRepository(db),
  patients: createPatientRepository(db),
},
  { accounts }
);
try {
  await app.listen({ port: config.port, host: "127.0.0.1" });
} catch (error) {
  app.log.error(error);
  await db.destroy();
  process.exit(1);
}
