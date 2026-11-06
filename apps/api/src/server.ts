// Author(s): Sophia Koshy
// Start date: 2026-11-05
// Last updated: 2026-11-05
// P4: Prototype 
// Purpose: creates the MySQL pool, connects the real repository, and starts the server.

import "dotenv/config";
import mysql from "mysql2/promise";
import { buildApp } from "./app";
import { getPatientById } from "./repository";

async function start() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
  });

  const repository = {
    getPatientById: (id: number) => getPatientById(pool, id),
  };

  const app = buildApp(repository);

  try {
    await app.listen({
      port: 3000,
      host: "0.0.0.0",
    });

    app.log.info("Server running on port 3000");
  } catch (error) {
    app.log.error(error);
    await pool.end();
    process.exit(1);
  }
}

start();
