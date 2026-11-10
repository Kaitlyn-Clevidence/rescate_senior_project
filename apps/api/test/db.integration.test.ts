// Author(s): Kaitlyn Clevidence
// Start date: 2026-11-07
// Last updated: 2026-11-07
// P4: Prototype 
// Purpose: tests the database repositories against a real MySQL database; 
// requires the environment variable RUN_DB_TESTS to be set to "true" to run

import { afterAll, describe, expect, it } from "vitest";
import { config } from "../src/config/index.js";
import { createDb } from "../src/db/index.js";
import { createChartRepository } from "../src/repositories/ChartRepository.js";
import { createPatientRepository } from "../src/repositories/PatientRepository.js";

describe.skipIf(!process.env.RUN_DB_TESTS)("repositories against MySQL", () => {
  const db = createDb(config.db);
  const charts = createChartRepository(db);
  const patients = createPatientRepository(db);

  afterAll(async () => {
    await db.destroy();
  });

  it("finds a seeded patient and hides contact details", async () => {
    const patient = await patients.getPatientById(3);

    expect(patient).toMatchObject({ first_name: "Aidan", last_name: "Madonna" });
    expect(patient).not.toHaveProperty("email");
    expect(patient).not.toHaveProperty("phone");
  });

  it("returns undefined for a patient that does not exist", async () => {
    expect(await patients.getPatientById(99999)).toBeUndefined();
  });

  it("joins the patient name onto a chart", async () => {
    const chart = await charts.getChartById(1);

    expect(chart).toMatchObject({ chart_id: 1, patient_name: "Izzy Sullivan" });
  });

  it("lists a patient's charts", async () => {
    const list = await charts.listChartsByPatientId(3);

    expect(list.length).toBeGreaterThan(0);
    expect(list.every((c) => c.patient_name === "Aidan Madonna")).toBe(true);
  });

  it("lists all charts newest first", async () => {
    const list = await charts.listCharts();
    const times = list.map((c) => new Date(c.encounter_date).getTime());

    expect(times).toEqual([...times].sort((a, b) => b - a));
  });
});