// Author(s): Kaitlyn Clevidence
// Started: 11-24-2026
// P5: MVP
// Purpose: shared helpers for tests that use a fake database. rowsOf turns an
// insert into { column: value } objects, so a test can say "the column
// in_transport_at got this value" instead of counting positions in a list.

import {
  DummyDriver,
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
  type QueryResult,
} from "kysely";
import type { Database } from "../../src/db/types.js";

function dialectWith(driver: Driver) {
  return {
    createAdapter: () => new MysqlAdapter(),
    createDriver: () => driver,
    createIntrospector: (kysely: Kysely<unknown>) => new MysqlIntrospector(kysely),
    createQueryCompiler: () => new MysqlQueryCompiler(),
  };
}

// A database that accepts every query and records it. Every read returns no rows.
export function makeDb() {
  const queries: CompiledQuery[] = [];
  const db = new Kysely<Database>({
    dialect: dialectWith(new DummyDriver()),
    log: (event) => {
      if (event.level === "query") queries.push(event.query);
    },
  });
  return { db, queries };
}

function driverFor(connection: DatabaseConnection): Driver {
  return {
    init: async () => {},
    acquireConnection: async () => connection,
    beginTransaction: async () => {},
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    releaseConnection: async () => {},
    destroy: async () => {},
  };
}

// A database whose every query fails with the given error.
export function makeFailingDb(error: unknown) {
  return new Kysely<Database>({
    dialect: dialectWith(
      driverFor({
        executeQuery: async () => {
          throw error;
        },
        streamQuery: () => {
          throw error;
        },
      })
    ),
  });
}

// A database that answers every read with these rows, as mysql2 would hand them
// back. Use it to test how a repository converts what the driver returns.
export function makeDbReturning(rows: Record<string, unknown>[]) {
  return new Kysely<Database>({
    dialect: dialectWith(
      driverFor({
        executeQuery: async <R>(): Promise<QueryResult<R>> => ({ rows: rows as R[] }),
        streamQuery: () => {
          throw new Error("streaming is not used in these tests");
        },
      })
    ),
  });
}

// The rows an INSERT would write, as { column: value } objects (one per row).
export function rowsOf(query: CompiledQuery): Record<string, unknown>[] {
  const match = /^insert into `[^`]+` \((.+?)\) values /.exec(query.sql);
  if (!match) throw new Error(`rowsOf: not an insert: ${query.sql}`);
  const columns = match[1].split(", ").map((c) => c.replaceAll("`", ""));
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < query.parameters.length; i += columns.length) {
    const row: Record<string, unknown> = {};
    columns.forEach((column, j) => {
      row[column] = query.parameters[i + j];
    });
    rows.push(row);
  }
  return rows;
}

export function rowOf(query: CompiledQuery): Record<string, unknown> {
  const rows = rowsOf(query);
  if (rows.length !== 1) throw new Error(`rowOf: expected one row, got ${rows.length}`);
  return rows[0];
}
