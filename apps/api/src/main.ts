// Author(s): Sophia Koshy
// Start date: 2026-11-06
// Last updated: 2026-11-06
// P4: Prototype 
// Purpose: entry point to connect the real database repository to the Fastify app
import mysql from "mysql2/promise";
import { config } from "./config";
import { createChartRepository } from "./repositories/ChartRepository";
import { buildApp } from "./http/app";

const pool = mysql.createPool(config.db);

const repository = createChartRepository(pool);

const app = buildApp(repository);

try {
  await app.listen({
    port: config.port,
    host: "127.0.0.1",
  });
} 
catch (error) {
  app.log.error(error);
  await pool.end();
  process.exit(1);
}
