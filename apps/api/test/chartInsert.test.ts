// Author(s): Kaitlyn Clevidence
// Started: 11-16-2026
// P5: MVP
// Purpose: tests the guards in ChartRepository.insertSubmitted using a fake
// database. They must reject unsupported charts before any query is sent.
// The real write and rollback behaviour is in chartInsert.integration.test.ts.

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
import type { NewAmbulanceChart, NewClinicChart } from "../src/domain/Chart.js";
import { createChartRepository } from "../src/repositories/ChartRepository.js";

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

const clinicChart: NewClinicChart = {
  call_type: "clinic",
  nature_of_call: "bp_check",
  encounter_date: new Date("2026-11-16T10:00:00Z"),
  patient: { patient_id: 1 },
  clinic: {},
  sections: {},
};

describe("ChartRepository.insertSubmitted guards", () => {
  it("rejects ambulance charts without touching the database", async () => {
    const { db, queries } = makeDb();
    const ambulanceChart: NewAmbulanceChart = {
      ...clinicChart,
      call_type: "ambulance",
      ambulance: { call_category: "scene" },
    } as NewAmbulanceChart;

    await expect(
      createChartRepository(db).insertSubmitted(ambulanceChart)
    ).rejects.toThrow("ambulance charts are not supported yet");
    expect(queries).toEqual([]);
  });

  it("rejects a section it cannot write yet instead of dropping it", async () => {
    const { db, queries } = makeDb();
    const chart: NewClinicChart = {
      ...clinicChart,
      sections: { wound_care: { wound_location: "left hand" } },
    };

    await expect(
      createChartRepository(db).insertSubmitted(chart)
    ).rejects.toThrow('no writer for section "wound_care"');
    expect(queries).toEqual([]);
  });

  it("ignores sections that are present but undefined", async () => {
    const { db } = makeDb();
    const chart: NewClinicChart = {
      ...clinicChart,
      sections: { wound_care: undefined },
    };

    // The guard passes, so the failure comes later from the fake driver
    // returning no insert id, not from the section check.
    await expect(
      createChartRepository(db).insertSubmitted(chart)
    ).rejects.toThrow("did not return a new id");
  });
});
