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
import type { NewClinicChart } from "../src/domain/Chart.js";
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
  created_by: 1,
  narrative: "Patient came in for a blood pressure check.",
  patient: { patient_id: 1 },
  clinic: {},
  sections: {},
};

describe("ChartRepository.insertSubmitted guards", () => {
  it("rejects a vehicle accident on a clinic chart, before any query", async () => {
    const { db, queries } = makeDb();
    const chart: NewClinicChart = {
      ...clinicChart,
      sections: { vehicle_accident: { type: "motorcycle" } },
    };

    await expect(
      createChartRepository(db).insertSubmitted(chart)
    ).rejects.toThrow('section "vehicle_accident" is not allowed on a clinic chart');
    expect(queries).toEqual([]);
  });

  it("rejects a section name it does not know instead of dropping it", async () => {
    const { db, queries } = makeDb();
    const chart = {
      ...clinicChart,
      sections: { vitalz: [{ recorded_at: new Date() }] },
    } as unknown as NewClinicChart;

    await expect(
      createChartRepository(db).insertSubmitted(chart)
    ).rejects.toThrow('section "vitalz" is not allowed');
    expect(queries).toEqual([]);
  });

  it.each([
    ["a patient signature file", { signature_key: "drafts/a.png" }],
    ["a witness signature file", { witness_signature_key: "drafts/w.png" }],
  ])("rejects %s, since signatures are not saved yet, before any query", async (_name, extra) => {
    const { db, queries } = makeDb();
    const chart: NewClinicChart = {
      ...clinicChart,
      sections: {
        consent_forms: [
          {
            form_type: "consent",
            language: "es",
            signer_name: "Test Person",
            signed_at: new Date("2026-11-16T10:00:00Z"),
            text_version: 1,
            ...extra,
          },
        ],
      },
    };

    await expect(
      createChartRepository(db).insertSubmitted(chart)
    ).rejects.toThrow("signature files is not supported yet");
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
