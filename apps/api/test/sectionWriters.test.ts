// Author(s): Kaitlyn Clevidence
// Started: 11-17-2026
// P5: MVP
// Purpose: tests the chart section writers with a fake database. They check
// the values each writer would send, not the real tables (that is covered by
// the integration tests).

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
import {
  writeChartPatientInfo,
  writeConsentForms,
  writeFluidIntakeOutput,
  writeMedicationsGiven,
  writeObstetrics,
  writePhysicalExam,
  writeProceduresPerformed,
  writeTransport,
  writeVitals,
} from "../src/repositories/chart/sectionWriters.js";

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

describe("many-row writers skip an empty list", () => {
  it("sends no query for any of them", async () => {
    const { db, queries } = makeDb();

    await writeVitals(db, 1, []);
    await writeMedicationsGiven(db, 1, []);
    await writeConsentForms(db, 1, []);
    await writeProceduresPerformed(db, 1, []);
    await writeFluidIntakeOutput(db, 1, []);
    await writePhysicalExam(db, 1, []);

    expect(queries).toEqual([]);
  });
});

describe("writeObstetrics", () => {
  it("keeps an unanswered yes/no as NULL and a real answer as 1 or 0", async () => {
    const { db, queries } = makeDb();

    await writeObstetrics(db, 1, {
      vaginal_bleeding: false,
      bag_of_water_ruptured: true,
    });

    // parameters follow the column order: chart_id, gravida, para, abortion,
    // due_date, gestation, vaginal_bleeding, ...
    const p = queries[0].parameters;
    expect(p[6]).toBe(0); // vaginal_bleeding: answered no
    expect(p[10]).toBe(1); // bag_of_water_ruptured: answered yes
    expect(p[11]).toBeNull(); // feels_baby_moving: never asked
    expect(p[13]).toBeNull(); // placenta_delivered: never asked
  });
});

describe("writeTransport", () => {
  it("writes one row for the chart", async () => {
    const { db, queries } = makeDb();

    await writeTransport(db, 7, { destination: "Carson Tahoe" });

    expect(queries).toHaveLength(1);
    expect(queries[0].parameters).toEqual([7, "Carson Tahoe", null, null]);
  });
});

describe("writeProceduresPerformed", () => {
  it("stores details as JSON text", async () => {
    const { db, queries } = makeDb();

    await writeProceduresPerformed(db, 1, [
      {
        procedure_code: "oxygen",
        performed_at: new Date("2026-11-17T10:00:00Z"),
        performed_by: 4,
        details: { liters_per_minute: 4 },
      },
    ]);

    expect(queries[0].parameters).toContain('{"liters_per_minute":4}');
  });
});

describe("fields the database requires but the domain leaves optional", () => {
  it("rejects patient info with no history of present illness, before any query", async () => {
    const { db, queries } = makeDb();

    await expect(
      writeChartPatientInfo(db, 1, { medication_allergies: "penicillin" })
    ).rejects.toThrow("history_of_present_illness");
    expect(queries).toEqual([]);
  });

  it("rejects a medication with no given_at, before any query", async () => {
    const { db, queries } = makeDb();

    await expect(
      writeMedicationsGiven(db, 1, [{ medication_name: "ketorolac" }])
    ).rejects.toThrow("given_at");
    expect(queries).toEqual([]);
  });

  it("rejects a consent form that has a signature, since attachments are not written yet", async () => {
    const { db, queries } = makeDb();

    await expect(
      writeConsentForms(db, 1, [
        {
          form_type: "consent",
          language: "es",
          signer_name: "Test Person",
          signed_at: new Date(),
          text_version: 1,
          signature_key: "drafts/abc/signature.png",
        },
      ])
    ).rejects.toThrow("signature");
    expect(queries).toEqual([]);
  });
});
