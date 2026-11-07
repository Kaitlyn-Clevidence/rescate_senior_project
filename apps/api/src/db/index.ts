//  Author(s): Kaitlyn Clevidence
//  Start date: 2024-11-07
//  Last updated: 2024-11-07
//  P4: Prototype 
//  Purpose: create a Kysely database connection to the MySQL database;

import { Kysely, MysqlDialect } from "kysely";
import { createPool } from "mysql2";
import type { Database } from "./types.js";
import type { config } from "../config/index.js";

export function createDb(dbConfig: typeof config.db) {
  return new Kysely<Database>({
    dialect: new MysqlDialect({ pool: createPool(dbConfig) }),
  });
}