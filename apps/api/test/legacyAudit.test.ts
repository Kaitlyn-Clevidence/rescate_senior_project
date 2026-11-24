// Author(s): Kaitlyn Clevidence
// Started: 11-24-2026
// P5: MVP
// Purpose: tests LegacyArchiveRepository, AuditRepository and the duplicate-key
// helper with a fake database. They check the SQL that would be sent and the
// guards that reject bad input before any query. Real rows are covered by
// legacyAudit.integration.test.ts.

import {
  DummyDriver,
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
} from "kysely";
import { describe, expect, it } from "vitest";
import type { Database } from "../src/db/types.js";
import { createAuditRepository } from "../src/repositories/AuditRepository.js";
import { insertAuditEvent } from "../src/repositories/auditWriter.js";
import { isDuplicateKeyError } from "../src/repositories/helpers.js";
import { createLegacyArchiveRepository } from "../src/repositories/LegacyArchiveRepository.js";
import { makeDbReturning } from "./support/fakeDb.js";

function makeDb() {
  const queries: CompiledQuery[] = [];
  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new MysqlAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (kysely) => new MysqlIntrospector(kysely),
      createQueryCompiler: () => new MysqlQueryCompiler(),
    },
    log: (event) => {
      if (event.level === "query") queries.push(event.query);
    },
  });
  return { db, queries };
}

// A database whose every query fails with the given error.
function makeFailingDb(error: unknown) {
  const connection: DatabaseConnection = {
    executeQuery: async () => {
      throw error;
    },
    streamQuery: () => {
      throw error;
    },
  };
  const driver: Driver = {
    init: async () => {},
    acquireConnection: async () => connection,
    beginTransaction: async () => {},
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    releaseConnection: async () => {},
    destroy: async () => {},
  };
  return new Kysely<Database>({
    dialect: {
      createAdapter: () => new MysqlAdapter(),
      createDriver: () => driver,
      createIntrospector: (kysely) => new MysqlIntrospector(kysely),
      createQueryCompiler: () => new MysqlQueryCompiler(),
    },
  });
}

describe("isDuplicateKeyError", () => {
  it("recognises MySQL's duplicate entry error by number or code", () => {
    expect(isDuplicateKeyError({ errno: 1062 })).toBe(true);
    expect(isDuplicateKeyError({ code: "ER_DUP_ENTRY" })).toBe(true);
  });

  it("says no to other errors and non-errors", () => {
    expect(isDuplicateKeyError({ errno: 1452 })).toBe(false);
    expect(isDuplicateKeyError(new Error("boom"))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError("ER_DUP_ENTRY")).toBe(false);
  });
});

describe("LegacyArchiveRepository", () => {
  it("saves the row as JSON text", async () => {
    const { db, queries } = makeDb();

    const saved = await createLegacyArchiveRepository(db).insertRaw("charts", 5, { fname: "José", n: 1 });

    expect(saved).toBe(true);
    expect(queries[0].sql).toContain("insert into `charts_v1_archive`");
    expect(queries[0].parameters).toEqual(["charts", 5, '{"fname":"José","n":1}']);
  });

  it("returns false instead of failing when the row was already archived", async () => {
    const db = makeFailingDb({ errno: 1062, code: "ER_DUP_ENTRY" });

    expect(await createLegacyArchiveRepository(db).insertRaw("charts", 5, {})).toBe(false);
  });

  it("still fails on any other database error", async () => {
    const db = makeFailingDb(new Error("connection lost"));

    await expect(createLegacyArchiveRepository(db).insertRaw("charts", 5, {})).rejects.toThrow(
      "connection lost"
    );
  });

  it.each([
    ["an empty entity", "  ", 5, {}],
    ["a zero id", "charts", 0, {}],
    ["a decimal id", "charts", 1.5, {}],
    ["a negative id", "charts", -2, {}],
    ["a row JSON cannot hold", "charts", 5, undefined],
  ])("rejects %s before any query", async (_name, entity, id, row) => {
    const { db, queries } = makeDb();

    await expect(createLegacyArchiveRepository(db).insertRaw(entity, id, row)).rejects.toThrow();
    expect(queries).toEqual([]);
  });

  it("looks up by entity and legacy id as parameters", async () => {
    const { db, queries } = makeDb();

    await createLegacyArchiveRepository(db).findByLegacyId("charts", 9);

    expect(queries[0].sql).toContain("where `entity` = ? and `legacy_id` = ?");
    expect(queries[0].parameters).toEqual(["charts", 9]);
  });

  it("counts rows per entity", async () => {
    const { db, queries } = makeDb();

    await createLegacyArchiveRepository(db).countByEntity();

    expect(queries[0].sql).toContain("group by `entity`");
  });

  it("turns the counts the driver hands back (strings, when big numbers are on) into numbers", async () => {
    const db = makeDbReturning([
      { entity: "charts", count: "3" },
      { entity: "patients", count: "12" },
    ]);

    expect(await createLegacyArchiveRepository(db).countByEntity()).toEqual([
      { entity: "charts", count: 3 },
      { entity: "patients", count: 12 },
    ]);
  });

  it("has no way to change or remove an archived row", () => {
    const { db } = makeDb();

    expect(Object.keys(createLegacyArchiveRepository(db)).sort()).toEqual([
      "countByEntity",
      "findByLegacyId",
      "insertRaw",
    ]);
  });
});

describe("insertAuditEvent", () => {
  it("saves the event with details as JSON text and the entity id as text", async () => {
    const { db, queries } = makeDb();

    await insertAuditEvent(db, {
      user_id: 3,
      action: "chart.submit",
      entity: "chart",
      entity_id: 42,
      ip_address: "10.0.0.1",
      user_agent: "test-agent",
      details: { nature: "bp_check" },
    });

    expect(queries[0].sql).toContain("insert into `audit_log`");
    expect(queries[0].parameters).toEqual([
      3, "chart.submit", "chart", "42", "10.0.0.1", "test-agent", '{"nature":"bp_check"}',
    ]);
  });

  it("writes NULL for everything left out", async () => {
    const { db, queries } = makeDb();

    await insertAuditEvent(db, { action: "auth.login_failed" });

    expect(queries[0].parameters).toEqual([null, "auth.login_failed", null, null, null, null, null]);
  });

  it("cuts an over-long user agent and IP so the audit row is not lost", async () => {
    const { db, queries } = makeDb();

    await insertAuditEvent(db, {
      action: "auth.login",
      ip_address: "1".repeat(100),
      user_agent: "x".repeat(1000),
    });

    const [, , , , ip, agent] = queries[0].parameters as string[];
    expect(ip).toHaveLength(45);
    expect(agent).toHaveLength(255);
  });

  it.each([
    ["an empty action", { action: " " }],
    ["an action over 50 characters", { action: "a".repeat(51) }],
    ["an entity over 50 characters", { action: "x", entity: "e".repeat(51) }],
    ["an entity id over 50 characters", { action: "x", entity_id: "i".repeat(51) }],
  ])("rejects %s before any query", async (_name, event) => {
    const { db, queries } = makeDb();

    await expect(insertAuditEvent(db, event)).rejects.toThrow();
    expect(queries).toEqual([]);
  });
});

describe("AuditRepository.query", () => {
  it("lists newest first with the user's name joined in, and caps the page at 50 by default", async () => {
    const { db, queries } = makeDb();

    await createAuditRepository(db).query();

    const { sql, parameters } = queries[0];
    expect(sql).toContain("left join `users`");
    expect(sql).toContain("`users`.`name` as `user_name`");
    expect(sql).toContain("order by `audit_log`.`created_at` desc, `audit_log`.`audit_id` desc");
    expect(sql).not.toContain("where");
    expect(parameters).toEqual([50, 0]);
  });

  it("adds a condition only for each filter that is given", async () => {
    const { db, queries } = makeDb();
    const from = new Date("2026-11-01T00:00:00Z");
    const to = new Date("2026-12-01T00:00:00Z");

    await createAuditRepository(db).query({
      user_id: 3,
      action: "chart.submit",
      entity: "chart",
      entity_id: 42,
      from,
      to,
    });

    const { sql, parameters } = queries[0];
    expect(sql).toContain("`audit_log`.`user_id` = ?");
    expect(sql).toContain("`audit_log`.`action` = ?");
    expect(sql).toContain("`audit_log`.`entity` = ?");
    expect(sql).toContain("`audit_log`.`entity_id` = ?");
    expect(sql).toContain("`audit_log`.`created_at` >= ?");
    expect(sql).toContain("`audit_log`.`created_at` < ?");
    expect(parameters).toEqual([3, "chart.submit", "chart", "42", from, to, 50, 0]);
  });

  it("caps the page size at 200 and keeps the offset a whole number of at least 0", async () => {
    const { db, queries } = makeDb();
    const repo = createAuditRepository(db);

    await repo.query({}, { limit: 100000, offset: -5 });
    await repo.query({}, { limit: 0, offset: 7.9 });

    expect(queries[0].parameters).toEqual([200, 0]);
    expect(queries[1].parameters).toEqual([1, 7]);
  });

  it("never puts hostile input into the SQL text", async () => {
    const { db, queries } = makeDb();

    await createAuditRepository(db).query({ action: "x'; DROP TABLE audit_log; --" });

    expect(queries[0].sql).not.toContain("DROP");
  });

  it("has no way to change or remove an audit entry", () => {
    const { db } = makeDb();

    expect(Object.keys(createAuditRepository(db)).sort()).toEqual(["query", "record"]);
  });
});
