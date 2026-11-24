// Author(s): Kaitlyn Clevidence
// Started: 11-16-2026
// P5: MVP
// Purpose: tests ChartRepository.insertSubmitted against a real MySQL
// database, including that a failure partway through saves nothing.

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../src/config/index.js";
import { createDb } from "../src/db/index.js";
import type { NewClinicChart } from "../src/domain/Chart.js";
import { createChartRepository } from "../src/repositories/ChartRepository.js";

describe.skipIf(!process.env.RUN_DB_TESTS)("insertSubmitted against MySQL", () => {
  const db = createDb(config.db);
  const charts = createChartRepository(db);
  const marker = `SliceTest-${randomUUID().slice(0, 8)}`;
  const createdChartIds: number[] = [];
  // patients with no name cannot be found by the marker, so track their ids
  const createdPatientIds: number[] = [];
  // charts.created_by points at users, so the tests need a real provider.
  let testUserId = 0;

  beforeAll(async () => {
    const result = await db
      .insertInto("users")
      .values({
        username: marker,
        password_hash: "not-a-real-hash",
        email: null,
        phone: null,
        name: "Slice Test Provider",
        certifications: null,
      })
      .executeTakeFirstOrThrow();
    testUserId = Number(result.insertId);
  });

  function makeChart(overrides: Partial<NewClinicChart> = {}): NewClinicChart {
    return {
      call_type: "clinic",
      nature_of_call: "bp_check",
      encounter_date: new Date("2026-11-16T10:00:00Z"),
      created_by: testUserId,
      narrative: "Patient came in for a blood pressure check and left stable.",
      patient: {
        new_patient: { first_name: "Test", last_name: marker, gender: "F" },
      },
      clinic: { reason_for_visit: "blood pressure check" },
      sections: {
        vitals: [
          { recorded_at: new Date("2026-11-16T10:05:00Z"), heart_rate: 72, temperature: 36.8 },
          { recorded_at: new Date("2026-11-16T10:20:00Z"), heart_rate: 70 },
        ],
      },
      ...overrides,
    };
  }

  // Count only this file's own rows, so other test files running against the
  // same database at the same time cannot change the numbers.
  async function count(table: "charts" | "patients") {
    if (table === "charts") {
      const row = await db
        .selectFrom("charts")
        .where("created_by", "=", testUserId)
        .select((eb) => eb.fn.countAll<string>().as("n"))
        .executeTakeFirstOrThrow();
      return Number(row.n);
    }
    const row = await db
      .selectFrom("patients")
      .where("last_name", "like", `${marker}%`)
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  afterAll(async () => {
    if (createdChartIds.length > 0) {
      await db.deleteFrom("charts").where("chart_id", "in", createdChartIds).execute();
    }
    await db.deleteFrom("patients").where("last_name", "=", marker).execute();
    if (createdPatientIds.length > 0) {
      await db.deleteFrom("patients").where("patient_id", "in", createdPatientIds).execute();
    }
    await db.deleteFrom("users").where("username", "=", marker).execute();
    await db.destroy();
  });

  it("saves the patient, chart, clinic row and vitals together", async () => {
    const saved = await charts.insertSubmitted(makeChart({ incident_number: "INC-TEST" }));
    createdChartIds.push(saved.chart_id);

    expect(saved.chart_uuid).toMatch(/^[0-9a-f-]{36}$/);

    const chart = await db
      .selectFrom("charts")
      .selectAll()
      .where("chart_id", "=", saved.chart_id)
      .executeTakeFirstOrThrow();
    expect(chart).toMatchObject({
      chart_uuid: saved.chart_uuid,
      nature_of_call: "bp_check",
      call_type: "clinic",
      created_by: testUserId,
      incident_number: "INC-TEST",
      is_completed: 1,
      narrative: "Patient came in for a blood pressure check and left stable.",
    });
    expect(chart.submitted_at).not.toBeNull();

    const patient = await db
      .selectFrom("patients")
      .selectAll()
      .where("patient_id", "=", chart.patient_id)
      .executeTakeFirstOrThrow();
    expect(patient.last_name).toBe(marker);

    const clinic = await db
      .selectFrom("clinic_visits")
      .selectAll()
      .where("chart_id", "=", saved.chart_id)
      .executeTakeFirstOrThrow();
    expect(clinic.reason_for_visit).toBe("blood pressure check");

    const vitals = await db
      .selectFrom("vitals")
      .selectAll()
      .where("chart_id", "=", saved.chart_id)
      .orderBy("recorded_at")
      .execute();
    expect(vitals).toHaveLength(2);
    expect(vitals[0]).toMatchObject({ heart_rate: 72, temperature: "36.8" });
    expect(vitals[1].temperature).toBeNull();
  });

  it("saves a chart for a patient with no name or gender", async () => {
    const saved = await charts.insertSubmitted(
      makeChart({ patient: { new_patient: {} } })
    );
    createdChartIds.push(saved.chart_id);

    const chart = await db
      .selectFrom("charts")
      .select("patient_id")
      .where("chart_id", "=", saved.chart_id)
      .executeTakeFirstOrThrow();
    createdPatientIds.push(chart.patient_id);

    const patient = await db
      .selectFrom("patients")
      .selectAll()
      .where("patient_id", "=", chart.patient_id)
      .executeTakeFirstOrThrow();
    expect(patient.first_name).toBeNull();
    expect(patient.last_name).toBeNull();
    expect(patient.gender).toBeNull();
  });

  it("saves the estimated age and blood glucose", async () => {
    const saved = await charts.insertSubmitted(
      makeChart({
        patient: { new_patient: { last_name: marker, estimated_age: 40 } },
        sections: {
          vitals: [{ recorded_at: new Date("2026-11-24T10:00:00Z"), blood_glucose: 95 }],
        },
      })
    );
    createdChartIds.push(saved.chart_id);

    const chart = await db
      .selectFrom("charts")
      .select("patient_id")
      .where("chart_id", "=", saved.chart_id)
      .executeTakeFirstOrThrow();
    const patient = await db
      .selectFrom("patients")
      .select("estimated_age")
      .where("patient_id", "=", chart.patient_id)
      .executeTakeFirstOrThrow();
    expect(patient.estimated_age).toBe(40);

    const vital = await db
      .selectFrom("vitals")
      .select("blood_glucose")
      .where("chart_id", "=", saved.chart_id)
      .executeTakeFirstOrThrow();
    expect(vital.blood_glucose).toBe(95);
  });

  it("reuses an existing patient without creating a new one", async () => {
    const before = await count("patients");
    const existing = await db
      .selectFrom("patients")
      .select("patient_id")
      .where("last_name", "=", marker)
      .executeTakeFirstOrThrow();

    const saved = await charts.insertSubmitted(
      makeChart({ patient: { patient_id: existing.patient_id } })
    );
    createdChartIds.push(saved.chart_id);

    expect(await count("patients")).toBe(before);
  });

  it("saves nothing at all when a later insert fails", async () => {
    const rollbackMarker = `${marker}-rollback`;
    const chartsBefore = await count("charts");
    const patientsBefore = await count("patients");

    await expect(
      charts.insertSubmitted(
        makeChart({
          patient: {
            new_patient: { first_name: "Test", last_name: rollbackMarker, gender: "F" },
          },
          // Negative value is out of range for an unsigned column, so the
          // vitals insert fails after the patient, chart and clinic rows.
          sections: { vitals: [{ recorded_at: new Date(), heart_rate: -5 }] },
        })
      )
    ).rejects.toThrow();

    expect(await count("charts")).toBe(chartsBefore);
    expect(await count("patients")).toBe(patientsBefore);
    const orphan = await db
      .selectFrom("patients")
      .select("patient_id")
      .where("last_name", "=", rollbackMarker)
      .executeTakeFirst();
    expect(orphan).toBeUndefined();
  });
});
