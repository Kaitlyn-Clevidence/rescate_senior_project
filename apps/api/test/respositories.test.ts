// Author(s): Kaitlyn Clevidence
// Start date: 2026-11-07
// Last updated: 2026-11-07
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