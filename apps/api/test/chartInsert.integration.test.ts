// Author(s): Kaitlyn Clevidence
// Started: 11-16-2026
// P5: MVP
// Purpose: tests ChartRepository.insertSubmitted against a real MySQL
// database, including that a failure partway through saves nothing.

import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { config } from "../src/config/index.js";
import { createDb } from "../src/db/index.js";
import type { NewClinicChart } from "../src/domain/Chart.js";
import { createChartRepository } from "../src/repositories/ChartRepository.js";

describe.skipIf(!process.env.RUN_DB_TESTS)("insertSubmitted against MySQL", () => {
  const db = createDb(config.db);
  const charts = createChartRepository(db);
  const marker = `SliceTest-${randomUUID().slice(0, 8)}`;
  const createdChartIds: number[] = [];

  function makeChart(overrides: Partial<NewClinicChart> = {}): NewClinicChart {
    return {
      call_type: "clinic",
      nature_of_call: "bp_check",
      encounter_date: new Date("2026-11-16T10:00:00Z"),
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

  async function count(table: "charts" | "patients") {
    const row = await db
      .selectFrom(table)
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .executeTakeFirstOrThrow();
    return Number(row.n);
  }

  afterAll(async () => {
    if (createdChartIds.length > 0) {
      await db.deleteFrom("charts").where("chart_id", "in", createdChartIds).execute();
    }
    await db.deleteFrom("patients").where("last_name", "=", marker).execute();
    await db.destroy();
  });

  it("saves the patient, chart, clinic row and vitals together", async () => {
    const saved = await charts.insertSubmitted(makeChart());
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
      is_completed: 1,
      is_practice: 0,
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
