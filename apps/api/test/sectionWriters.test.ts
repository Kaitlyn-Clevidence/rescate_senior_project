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
import { insertPatient } from "../src/repositories/patientWriter.js";
import {
  writeChartPatientInfo,
  writeConsentForms,
  writeCrew,
  writeFluidIntakeOutput,
  writeMedicationsGiven,
  writeObstetrics,
  writePhysicalExam,
  writeProceduresPerformed,
  writeTransport,
  writeVehicleAccident,
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
    // chart_id, destination, in_transport_at, arrive_destination_at,
    // transfer_of_care_at, transferred_to_doctor
    expect(queries[0].parameters).toEqual([7, "Carson Tahoe", null, null, null, null]);
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

describe("writeCrew", () => {
  it("writes one row per crew member, as system users", async () => {
    const { db, queries } = makeDb();

    await writeCrew(db, 5, [
      { user_id: 2, role_on_call: "driver" },
      { user_id: 3 },
    ]);

    expect(queries).toHaveLength(1);
    expect(queries[0].parameters).toEqual([5, 2, null, "driver", 5, 3, null, null]);
  });
});

describe("writeVehicleAccident", () => {
  it("stores SET columns as comma-separated text and keeps unanswered ejection NULL", async () => {
    const { db, queries } = makeDb();

    await writeVehicleAccident(db, 5, {
      type: "motorcycle",
      impact: ["side", "roll_over"],
      safety_equipment: ["helmet"],
    });

    const p = queries[0].parameters;
    expect(p).toContain("side,roll_over");
    expect(p).toContain("helmet");
    expect(p[p.length - 1]).toBeNull(); // ejection never answered
  });
});

describe("witness on a consent form", () => {
  const signedAt = new Date("2026-11-18T10:00:00Z");
  const form = {
    form_type: "ama" as const,
    language: "es" as const,
    signer_name: "Test Person",
    signed_at: signedAt,
    text_version: 1,
  };

  it("saves the witness name and time", async () => {
    const { db, queries } = makeDb();

    await writeConsentForms(db, 1, [
      { ...form, witness_name: "Test Witness", witness_signed_at: signedAt },
    ]);

    expect(queries[0].parameters).toContain("Test Witness");
    expect(queries[0].parameters.filter((v) => v === signedAt)).toHaveLength(2);
  });

  it("rejects a witness signature file, since attachments are not written yet", async () => {
    const { db, queries } = makeDb();

    await expect(
      writeConsentForms(db, 1, [
        { ...form, witness_name: "Test Witness", witness_signature_key: "drafts/x.png" },
      ])
    ).rejects.toThrow("witness signature");
    expect(queries).toEqual([]);
  });
});

describe("insertPatient", () => {
  it("saves the estimated age and keeps everything else NULL for an anonymous patient", async () => {
    const { db, queries } = makeDb();

    // the fake driver returns no insert id, so the call fails after the query
    await expect(insertPatient(db, { estimated_age: 40 })).rejects.toThrow(
      "did not return a new id"
    );

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain("`estimated_age`");
    expect(queries[0].parameters).toContain(40);
    expect(queries[0].parameters.filter((v) => v === null)).toHaveLength(7);
  });
});

describe("columns added in 0005 and 0006", () => {
  it("writes blood glucose", async () => {
    const { db, queries } = makeDb();

    await writeVitals(db, 1, [
      { recorded_at: new Date("2026-11-24T10:00:00Z"), blood_glucose: 95 },
    ]);

    expect(queries[0].parameters).toContain(95);
  });

  it("writes the new vitals fields", async () => {
    const { db, queries } = makeDb();

    await writeVitals(db, 1, [
      {
        recorded_at: new Date("2026-11-18T10:00:00Z"),
        responsiveness: "alert",
        rass: -2,
        mean_arterial_pressure: 90,
        bp_method: "manual",
        heart_rate_method: "palpated",
        ecg: "sinus rhythm",
      },
    ]);

    const p = queries[0].parameters;
    expect(p).toEqual(expect.arrayContaining(["alert", -2, 90, "manual", "palpated", "sinus rhythm"]));
  });

  it("writes substance use and airway indications instead of environmental allergies", async () => {
    const { db, queries } = makeDb();

    await writeChartPatientInfo(db, 1, {
      history_of_present_illness: "chest pain",
      alcohol_use: "weekly",
      drug_use: "none",
      invasive_airway_indications: "GCS below 8",
    });

    expect(queries[0].sql).not.toContain("environmental_allergies");
    expect(queries[0].parameters).toEqual(
      expect.arrayContaining(["weekly", "none", "GCS below 8"])
    );
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
