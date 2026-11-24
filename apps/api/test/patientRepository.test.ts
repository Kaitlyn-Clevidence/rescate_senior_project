// Author(s): Kaitlyn Clevidence
// Started: 11-24-2026
// P5: MVP
// Purpose: tests PatientRepository.findCandidates with a fake database. It
// checks the SQL that would be sent, not real rows (see
// patient.integration.test.ts for that).

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
import { createPatientRepository } from "../src/repositories/PatientRepository.js";

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

describe("PatientRepository.findCandidates", () => {
  it("matches on both names, with the values as parameters", async () => {
    const { db, queries } = makeDb();

    await createPatientRepository(db).findCandidates({
      first_name: "Maria",
      last_name: "Lopez",
    });

    const { sql, parameters } = queries[0];
    expect(sql).toContain("`first_name` = ?");
    expect(sql).toContain("`last_name` = ?");
    expect(parameters).toEqual(["Maria", "Lopez", 10]);
  });

  it("trims spaces around the names", async () => {
    const { db, queries } = makeDb();

    await createPatientRepository(db).findCandidates({
      first_name: "  Maria ",
      last_name: " Lopez  ",
    });

    expect(queries[0].parameters.slice(0, 2)).toEqual(["Maria", "Lopez"]);
  });

  it("only adds the birth date condition when one is given", async () => {
    const { db, queries } = makeDb();
    const repo = createPatientRepository(db);

    await repo.findCandidates({ first_name: "Maria", last_name: "Lopez" });
    await repo.findCandidates({
      first_name: "Maria",
      last_name: "Lopez",
      birth_date: new Date("1985-08-20T12:00:00"),
    });

    expect(queries[0].sql).not.toContain("date(?)");
    expect(queries[1].sql).toContain("birth_date = date(?)");
  });

  it("caps the result at 10 and sorts by name", async () => {
    const { db, queries } = makeDb();

    await createPatientRepository(db).findCandidates({
      first_name: "Maria",
      last_name: "Lopez",
    });

    const { sql } = queries[0];
    expect(sql).toContain("order by `last_name`, `first_name`");
    expect(sql).toContain("limit ?");
  });

  it("never puts hostile input into the SQL text", async () => {
    const { db, queries } = makeDb();

    await createPatientRepository(db).findCandidates({
      first_name: "x'; DROP TABLE patients; --",
      last_name: "y",
    });

    expect(queries[0].sql).not.toContain("DROP");
    expect(queries[0].parameters).toContain("x'; DROP TABLE patients; --");
  });
});

describe("PatientRepository reads", () => {
  it("includes the estimated age but still hides contact details", async () => {
    const { db, queries } = makeDb();

    await createPatientRepository(db).getPatientById(4);

    const { sql } = queries[0];
    expect(sql).toContain("`estimated_age`");
    for (const hidden of ["email", "phone", "home_address", "*"]) {
      expect(sql).not.toContain(hidden);
    }
  });
});
