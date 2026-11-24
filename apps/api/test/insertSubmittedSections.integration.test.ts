// Author(s): Kaitlyn Clevidence
// Started: 11-24-2026
// P5: MVP
// Purpose: tests that ChartRepository.insertSubmitted saves every section of a
// chart, for both call types, into the right tables of a real MySQL database,
// and that a failure at any point saves nothing. Runs only when RUN_DB_TESTS is
// set. It makes its own users and charts, tagged with a unique marker, and
// deletes only those rows.

import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../src/config/index.js";
import { createDb } from "../src/db/index.js";
import type { ChartSections, NewAmbulanceChart, NewClinicChart } from "../src/domain/Chart.js";
import { createChartRepository } from "../src/repositories/ChartRepository.js";

describe.skipIf(!process.env.RUN_DB_TESTS)("insertSubmitted saves every section to MySQL", () => {
  const db = createDb(config.db);
  const charts = createChartRepository(db);
  const marker = `SectionTest-${randomUUID().slice(0, 8)}`;
  const createdChartIds: number[] = [];
  let providerId = 0;
  let crewUserId = 0;

  const at = (hhmm: string) => new Date(`2026-11-24T${hhmm}:00`);

  beforeAll(async () => {
    async function makeUser(username: string, name: string) {
      const result = await db
        .insertInto("users")
        .values({ username, password_hash: "not-a-real-hash", email: null, phone: null, name, certifications: null })
        .executeTakeFirstOrThrow();
      return Number(result.insertId);
    }
    providerId = await makeUser(marker, "Section Test Provider");
    crewUserId = await makeUser(`${marker}-crew`, "Section Test Crew");
  });

  afterAll(async () => {
    // deleting a chart also removes its section rows (cascade)
    if (createdChartIds.length > 0) {
      await db.deleteFrom("charts").where("chart_id", "in", createdChartIds).execute();
    }
    await db.deleteFrom("patients").where("last_name", "like", `${marker}%`).execute();
    await db.deleteFrom("users").where("username", "like", `${marker}%`).execute();
    await db.destroy();
  });

  // All the rows a chart has in one table, read straight from MySQL.
  async function rowsIn(table: string, chartId: number) {
    const result = await sql<Record<string, unknown>>`
      select * from ${sql.table(table)} where chart_id = ${chartId}
    `.execute(db);
    return result.rows;
  }

  // Every section a chart can have, filled in. Vehicle accident is for
  // ambulance charts only, so it is left out unless asked for.
  function allSections(options: { vehicleAccident: boolean }): ChartSections {
    return {
      crew: [{ user_id: crewUserId, role_on_call: "driver" }],
      ...(options.vehicleAccident
        ? {
            vehicle_accident: {
              type: "auto_into_auto" as const,
              impact: ["side", "roll_over"] as ("side" | "roll_over")[],
              estimated_speed: 45,
              safety_equipment: ["seatbelt", "airbags_deployed"] as ("seatbelt" | "airbags_deployed")[],
              ejection: false,
            },
          }
        : {}),
      chart_patient_info: {
        weight: 70.5,
        classification: "adult",
        history_given_by: ["patient", "family"],
        history_of_present_illness: "chest pain for two hours",
        medication_allergies: "penicillin",
        alcohol_use: "weekly",
        drug_use: "none",
        invasive_airway_indications: "GCS below 8",
      },
      vitals: [
        { recorded_at: at("10:00"), heart_rate: 88, blood_glucose: 95, responsiveness: "alert", rass: -2 },
        { recorded_at: at("10:15"), heart_rate: 80 },
      ],
      medications_given: [
        {
          medication_name: "norepinephrine",
          dose: 5,
          unit: "mcg/min",
          is_infusion: true,
          infusion_rate: 2.5,
          infusion_rate_unit: "mL/h",
          given_at: at("10:05"),
          complications: "none",
        },
      ],
      wound_care: { wound_location: "left hand", wound_type: "laceration", sutures_removed: 4 },
      obstetrics: { gravida: 2, vaginal_bleeding: true, apgar_1min: 8 },
      transport: {
        destination: "Carson Tahoe",
        in_transport_at: at("10:30"),
        transferred_to_doctor: "Dr. Ruiz",
      },
      procedures_performed: [
        {
          procedure_code: "oxygen",
          performed_at: at("10:10"),
          performed_by: providerId,
          details: { liters_per_minute: 4 },
          notes: "nasal cannula",
        },
      ],
      fluid_intake_output: [
        { kind: "iv fluids", phase: "transport", amount: 500 },
        { kind: "bleeding", phase: "pre transport", amount: 120 },
      ],
      physical_exam: [
        { region: "abdomen", finding: "tender" },
        { region: "lower_arm", side: "left", finding: "swollen" },
      ],
      assessments: { pulse_strength: "weak", burn_calculation: 18.5, stroke_facial_droop: true },
      consent_forms: [
        {
          form_type: "ama",
          language: "es",
          signer_name: "Test Person",
          signed_at: at("10:40"),
          text_version: 2,
          witness_name: "Test Witness",
          witness_signed_at: at("10:41"),
        },
      ],
    };
  }

  function clinicChart(overrides: Partial<NewClinicChart> = {}): NewClinicChart {
    return {
      call_type: "clinic",
      nature_of_call: "cardiac",
      encounter_date: at("09:50"),
      created_by: providerId,
      narrative: "Walked in with chest pain, treated and monitored.",
      patient: { new_patient: { first_name: "Test", last_name: marker, estimated_age: 55 } },
      clinic: { reason_for_visit: "chest pain" },
      sections: {},
      ...overrides,
    };
  }

  function ambulanceChart(overrides: Partial<NewAmbulanceChart> = {}): NewAmbulanceChart {
    return {
      call_type: "ambulance",
      nature_of_call: "trauma",
      encounter_date: at("09:50"),
      created_by: providerId,
      narrative: "Called to the highway for a two-car collision.",
      patient: { new_patient: { last_name: marker, estimated_age: 30 } },
      ambulance: {
        call_category: "scene",
        incident_location: "Hwy 50",
        incident_location_type: "street_highway",
        mass_casualty_incident: true,
        patient_count: 2,
        unit_number: "A-12",
        dispatch_at: at("09:40"),
      },
      sections: {},
      ...overrides,
    };
  }

  async function countsFor(userId: number) {
    const chartRows = await db
      .selectFrom("charts")
      .where("created_by", "=", userId)
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .executeTakeFirstOrThrow();
    const vitalRows = await db
      .selectFrom("vitals")
      .innerJoin("charts", "charts.chart_id", "vitals.chart_id")
      .where("charts.created_by", "=", userId)
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .executeTakeFirstOrThrow();
    const patientRows = await db
      .selectFrom("patients")
      .where("last_name", "like", `${marker}%`)
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .executeTakeFirstOrThrow();
    return { charts: Number(chartRows.n), vitals: Number(vitalRows.n), patients: Number(patientRows.n) };
  }

  it("saves a full ambulance chart: the call block and every section, each in its own table", async () => {
    const saved = await charts.insertSubmitted(
      ambulanceChart({ sections: allSections({ vehicleAccident: true }) })
    );
    createdChartIds.push(saved.chart_id);
    const id = saved.chart_id;

    expect(await rowsIn("ambulance_calls", id)).toMatchObject([
      {
        call_category: "scene",
        incident_location: "Hwy 50",
        incident_location_type: "street_highway",
        mass_casualty_incident: 1,
        patient_count: 2,
        unit_number: "A-12",
      },
    ]);
    expect(await rowsIn("chart_crew", id)).toMatchObject([
      { user_id: crewUserId, role_on_call: "driver", name: null },
    ]);
    expect(await rowsIn("vehicle_accident", id)).toMatchObject([
      {
        type: "auto_into_auto",
        impact: "side,roll_over",
        estimated_speed: 45,
        safety_equipment: "seatbelt,airbags_deployed",
        ejection: 0,
      },
    ]);
    expect(await rowsIn("chart_patient_info", id)).toMatchObject([
      {
        weight: "70.5",
        classification: "adult",
        history_given_by: "patient,family",
        history_of_present_illness: "chest pain for two hours",
        alcohol_use: "weekly",
        drug_use: "none",
        invasive_airway_indications: "GCS below 8",
      },
    ]);
    const vitals = await rowsIn("vitals", id);
    expect(vitals).toHaveLength(2);
    expect(vitals[0]).toMatchObject({ heart_rate: 88, blood_glucose: 95, responsiveness: "alert", rass: -2 });
    expect(await rowsIn("medications_given", id)).toMatchObject([
      {
        medication_name: "norepinephrine",
        dose: "5.00",
        is_infusion: 1,
        infusion_rate: "2.50",
        complications: "none",
        given_at: at("10:05"),
      },
    ]);
    expect(await rowsIn("wound_care", id)).toMatchObject([
      { wound_location: "left hand", wound_type: "laceration", sutures_removed: 4 },
    ]);
    expect(await rowsIn("obstetrics", id)).toMatchObject([
      { gravida: 2, vaginal_bleeding: 1, feels_baby_moving: null, apgar_1min: 8 },
    ]);
    expect(await rowsIn("transports", id)).toMatchObject([
      { destination: "Carson Tahoe", in_transport_at: at("10:30"), transferred_to_doctor: "Dr. Ruiz" },
    ]);
    expect(await rowsIn("procedures_performed", id)).toMatchObject([
      {
        procedure_code: "oxygen",
        performed_by: providerId,
        details: { liters_per_minute: 4 },
        notes: "nasal cannula",
      },
    ]);
    expect(await rowsIn("fluid_intake_output", id)).toHaveLength(2);
    expect(await rowsIn("physical_exam", id)).toMatchObject([
      { region: "abdomen", side: "none", finding: "tender" },
      { region: "lower_arm", side: "left", finding: "swollen" },
    ]);
    expect(await rowsIn("assessments", id)).toMatchObject([
      { pulse_strength: "weak", burn_calculation: "18.50", stroke_facial_droop: 1, stroke_arm_drift: null },
    ]);
    expect(await rowsIn("chart_forms", id)).toMatchObject([
      {
        form_type: "ama",
        language: "es",
        signer_name: "Test Person",
        text_version: 2,
        witness_name: "Test Witness",
        witness_signed_at: at("10:41"),
        signature_attachment_id: null,
      },
    ]);
  });

  it("saves a full clinic chart, including the provider in the crew table", async () => {
    const saved = await charts.insertSubmitted(
      clinicChart({ sections: allSections({ vehicleAccident: false }) })
    );
    createdChartIds.push(saved.chart_id);
    const id = saved.chart_id;

    expect(await rowsIn("clinic_visits", id)).toMatchObject([{ reason_for_visit: "chest pain" }]);
    expect(await rowsIn("ambulance_calls", id)).toEqual([]);
    // a clinic chart's provider needs chart_crew to point at charts (0005)
    expect(await rowsIn("chart_crew", id)).toMatchObject([{ user_id: crewUserId }]);
    expect(await rowsIn("vehicle_accident", id)).toEqual([]);
    expect(await rowsIn("vitals", id)).toHaveLength(2);
    expect(await rowsIn("chart_forms", id)).toHaveLength(1);
  });

  it("stores the narrative and the patient's estimated age", async () => {
    const saved = await charts.insertSubmitted(clinicChart());
    createdChartIds.push(saved.chart_id);

    const chart = await db
      .selectFrom("charts")
      .innerJoin("patients", "patients.patient_id", "charts.patient_id")
      .select(["charts.narrative", "patients.estimated_age"])
      .where("charts.chart_id", "=", saved.chart_id)
      .executeTakeFirstOrThrow();

    expect(chart.narrative).toBe("Walked in with chest pain, treated and monitored.");
    expect(chart.estimated_age).toBe(55);
  });

  it("saves a chart whose sections are empty lists, with no rows for them", async () => {
    const saved = await charts.insertSubmitted(
      clinicChart({ sections: { vitals: [], medications_given: [], crew: [] } })
    );
    createdChartIds.push(saved.chart_id);

    expect(await rowsIn("vitals", saved.chart_id)).toEqual([]);
    expect(await rowsIn("medications_given", saved.chart_id)).toEqual([]);
    expect(await rowsIn("clinic_visits", saved.chart_id)).toHaveLength(1);
  });

  describe("a failure saves nothing at all", () => {
    it("when the last section fails after every other section was written", async () => {
      const before = await countsFor(providerId);
      const sections = allSections({ vehicleAccident: false });
      // The last section written is the consent form. A text_version of -1 is
      // out of range for an unsigned column, so MySQL rejects it.
      sections.consent_forms = [{ ...sections.consent_forms![0], text_version: -1 }];

      await expect(charts.insertSubmitted(clinicChart({ sections }))).rejects.toThrow();

      expect(await countsFor(providerId)).toEqual(before);
    });

    it("when a middle section fails", async () => {
      const before = await countsFor(providerId);
      const sections = allSections({ vehicleAccident: false });
      sections.fluid_intake_output = [{ kind: "iv fluids", phase: "transport", amount: -1 }];

      await expect(charts.insertSubmitted(clinicChart({ sections }))).rejects.toThrow();

      expect(await countsFor(providerId)).toEqual(before);
    });

    it("when a crew member is a user that does not exist", async () => {
      const before = await countsFor(providerId);
      const sections = allSections({ vehicleAccident: false });
      sections.crew = [{ user_id: 99999999 }];

      await expect(charts.insertSubmitted(clinicChart({ sections }))).rejects.toThrow();

      expect(await countsFor(providerId)).toEqual(before);
    });

    it("when the ambulance block is rejected by the database", async () => {
      const before = await countsFor(providerId);

      await expect(
        charts.insertSubmitted(
          ambulanceChart({ ambulance: { call_category: "scene", patient_count: -3 } })
        )
      ).rejects.toThrow();

      expect(await countsFor(providerId)).toEqual(before);
    });

    it("when the history of present illness is missing for patient info", async () => {
      const before = await countsFor(providerId);

      await expect(
        charts.insertSubmitted(
          clinicChart({ sections: { chart_patient_info: { medication_allergies: "penicillin" } } })
        )
      ).rejects.toThrow("history_of_present_illness");

      expect(await countsFor(providerId)).toEqual(before);
    });
  });
});
