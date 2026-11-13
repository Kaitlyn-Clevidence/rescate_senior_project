// Author(s): Kaitlyn Clevidence, Isabel Sullivan
// Start date: 2026-11-07
// Last updated: 2026-11-12
// P4: Prototype 
// Purpose: tests the data layer repositories for the API app using a fake in-memory database

import {
  DummyDriver,
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  type CompiledQuery,
} from "kysely";
import { describe, expect, it } from "vitest";
import type { Database } from "../src/db/types.js";
import { createChartRepository } from "../src/repositories/ChartRepository.js";
import { createPatientRepository } from "../src/repositories/PatientRepository.js";
import { createUserRepository } from "../src/repositories/UserRepository.js";

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

describe("ChartRepository", () => {
  it("lists charts newest first, joined to the patient name", async () => {
    const { db, queries } = makeDb();

    await createChartRepository(db).listCharts();

    const { sql, parameters } = queries[0];
    expect(sql).toContain("from `charts` inner join `patients`");
    expect(sql).toContain("concat(patients.first_name, ' ', patients.last_name) as `patient_name`");
    expect(sql).toContain("order by `charts`.`encounter_date` desc");
    expect(parameters).toEqual([]);
  });

  it("looks up one chart with the id as a parameter", async () => {
    const { db, queries } = makeDb();

    await createChartRepository(db).getChartById(7);

    const { sql, parameters } = queries[0];
    expect(sql).toContain("where `charts`.`chart_id` = ?");
    expect(parameters).toEqual([7]);
  });

  it("returns undefined when no chart matches", async () => {
    const { db } = makeDb();

    expect(await createChartRepository(db).getChartById(7)).toBeUndefined();
  });

  it("filters charts by patient id, newest first", async () => {
    const { db, queries } = makeDb();

    await createChartRepository(db).listChartsByPatientId(3);

    const { sql, parameters } = queries[0];
    expect(sql).toContain("where `charts`.`patient_id` = ?");
    expect(sql).toContain("order by `charts`.`encounter_date` desc");
    expect(parameters).toEqual([3]);
  });

  it("returns an empty list when the patient has no charts", async () => {
    const { db } = makeDb();

    expect(await createChartRepository(db).listChartsByPatientId(3)).toEqual([]);
  });

  it("never puts hostile input into the SQL text", async () => {
    const { db, queries } = makeDb();
    const hostile = "1; DROP TABLE charts" as unknown as number;

    await createChartRepository(db).getChartById(hostile);

    expect(queries[0].sql).not.toContain("DROP");
    expect(queries[0].parameters).toEqual([hostile]);
  });
});

describe("PatientRepository", () => {
  it("looks up one patient with the id as a parameter", async () => {
    const { db, queries } = makeDb();

    await createPatientRepository(db).getPatientById(4);

    const { sql, parameters } = queries[0];
    expect(sql).toContain("from `patients`");
    expect(sql).toContain("where `patient_id` = ?");
    expect(parameters).toEqual([4]);
  });

  it("selects only the public columns, never contact details", async () => {
    const { db, queries } = makeDb();

    await createPatientRepository(db).getPatientById(4);

    const { sql } = queries[0];
    for (const column of ["patient_id", "first_name", "last_name", "birth_date", "gender"]) {
      expect(sql).toContain(`\`${column}\``);
    }
    for (const hidden of ["email", "phone", "home_address", "*"]) {
      expect(sql).not.toContain(hidden);
    }
  });

  it("returns undefined when no patient matches", async () => {
    const { db } = makeDb();

    expect(await createPatientRepository(db).getPatientById(4)).toBeUndefined();
  });
});

// Izzy's tests for UserRepository.ts
// Can move to their own separate file if better for organization

describe("UserRepository", () => {
  it("finds a user by email with the email as a parameter", async () => {
    const { db, queries } = makeDb();
    await createUserRepository(db).findByEmail("provider@example.com");

    const { sql, parameters } = queries[0];
    expect(sql).toContain("from `users`");
    expect(sql).toContain("where `email` = ?");
    expect(parameters).toEqual(["provider@example.com"]);
  });

  it("creates an invited user with only email, role, language, and inviter", async () => {
    const { db, queries } = makeDb();
    await createUserRepository(db)
      .create({ email: "new@example.com", role: "provider", language_preferred: "es", invited_by: 1 })
      .catch(() => { }); //fake db returns no insert id, so ignore that error

    const { sql, parameters } = queries[0];
    expect(sql).toContain("insert into `users`");
    expect(sql).not.toContain("password_hash");
    expect(parameters).toEqual(["new@example.com", "provider", "es", 1]);
  });

  it("never selects the password hash", async () => {
    const { db, queries } = makeDb();
    await createUserRepository(db).findByEmail("provider@example.com");
    expect(queries[0].sql).not.toContain("password_hash");
    expect(queries[0].sql).not.toContain("*");
  });

  it("saves only the token hash with its expiry and purpose", async () => {
    const { db, queries } = makeDb();
    const expires = new Date("2026-11-12T12:00:00Z");
    await createUserRepository(db).saveToken(2, "a".repeat(64), "setup", expires);

    const { sql, parameters } = queries[0];
    expect(sql).toContain("insert into `user_tokens`");
    expect(parameters).toEqual([2, "a".repeat(64), "setup", expires]);
  });

  it("only uses up a token that matches, is unused and has not expired", async () => {
    const { db, queries } = makeDb();
    const now = new Date("2026-11-12T12:00:00Z");
    await createUserRepository(db).consumeToken("a".repeat(64), "setup", now);

    const { sql } = queries[0];
    expect(sql).toContain("update `user_tokens` set `used_at` = ?");
    expect(sql).toContain("`token_hash` = ?");
    expect(sql).toContain("`purpose` = ?");
    expect(sql).toContain("`used_at` is null");
    expect(sql).toContain("`expires_at` > ?");
  });

  it("returns undefined when no token was used up", async () => {
    const { db, queries } = makeDb();
    const result = await createUserRepository(db).consumeToken("a".repeat(64), "setup", new Date());

    expect(result).toBeUndefined();
    expect(queries).toHaveLength(1);
  });

  it("completes setup for one user only", async () => {
    const { db, queries } = makeDb();
    const now = new Date("2026-11-12T12:00:00Z");
    await createUserRepository(db).completeSetup(5, { name: "Izzy Sullivan", username: null, phone: null, password_hash: "hashed" }, now);

    const { sql, parameters } = queries[0];
    expect(sql).toContain("update `users` set");
    expect(sql).toContain("where `user_id` = ?");
    expect(parameters.at(-1)).toBe(5);
  });

  it("keeps a SQL injection attempt out of the SQL text", async () => {
    const { db, queries } = makeDb();
    const attempt = "x' OR '1'='1";

    await createUserRepository(db).findByEmail(attempt);
    expect(queries[0].sql).not.toContain("OR '1'='1");
    expect(queries[0].parameters).toEqual([attempt]);
  });

});