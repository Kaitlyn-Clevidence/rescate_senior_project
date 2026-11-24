// Author(s): Kaitlyn Clevidence
// Started: 11-24-2026
// P5: MVP
// Purpose: checks that each section writer puts every field into the right
// column, and that a field left out is stored as NULL (or the database default).
// Each test fills in every field with a different value, so a field that is
// dropped, swapped, or written to the wrong column makes a test fail.
// Whether MySQL accepts these rows is checked by the real-database tests.

import { describe, expect, it } from "vitest";
import {
  writeAmbulanceCall,
  writeAssessment,
  writeChartPatientInfo,
  writeClinicVisit,
  writeCrew,
  writeFluidIntakeOutput,
  writeMedicationsGiven,
  writeObstetrics,
  writePhysicalExam,
  writeTransport,
  writeVehicleAccident,
  writeWoundCare,
} from "../src/repositories/chart/sectionWriters.js";
import { makeDb, rowOf, rowsOf } from "./support/fakeDb.js";

const t1 = new Date("2026-11-24T10:00:00Z");
const t2 = new Date("2026-11-24T10:05:00Z");
const t3 = new Date("2026-11-24T10:10:00Z");
const t4 = new Date("2026-11-24T10:15:00Z");
const t5 = new Date("2026-11-24T10:20:00Z");

describe("writeClinicVisit", () => {
  it("writes every field", async () => {
    const { db, queries } = makeDb();

    await writeClinicVisit(db, 9, {
      intake_time: t1,
      discharge_time: t2,
      reason_for_visit: "headache",
      discharge_instructions: "rest and fluids",
    });

    expect(rowOf(queries[0])).toEqual({
      chart_id: 9,
      intake_time: t1,
      discharge_time: t2,
      reason_for_visit: "headache",
      discharge_instructions: "rest and fluids",
    });
  });
});

describe("writeAmbulanceCall", () => {
  it("writes every field", async () => {
    const { db, queries } = makeDb();

    await writeAmbulanceCall(db, 9, {
      call_category: "transfer",
      incident_location: "Lake Tahoe",
      incident_location_type: "recreation",
      incident_address: "1 Shore Rd",
      mass_casualty_incident: true,
      patient_count: 3,
      agencies: "fire, sheriff",
      disposition: "transported",
      unit_number: "A-12",
      triage_color: "red",
      care_level: "ALS",
      dispatch_at: t1,
      enroute_at: t2,
      arrive_scene_at: t3,
      patient_contact_at: t4,
      depart_scene_at: t5,
    });

    expect(rowOf(queries[0])).toEqual({
      chart_id: 9,
      call_category: "transfer",
      incident_location: "Lake Tahoe",
      incident_location_type: "recreation",
      incident_address: "1 Shore Rd",
      mass_casualty_incident: 1,
      patient_count: 3,
      agencies: "fire, sheriff",
      disposition: "transported",
      unit_number: "A-12",
      triage_color: "red",
      care_level: "ALS",
      dispatch_at: t1,
      enroute_at: t2,
      arrive_scene_at: t3,
      patient_contact_at: t4,
      depart_scene_at: t5,
    });
  });

  it("stores everything left out as NULL, and mass casualty as 0 (the database default)", async () => {
    const { db, queries } = makeDb();

    await writeAmbulanceCall(db, 9, { call_category: "scene" });

    const row = rowOf(queries[0]);
    expect(row.mass_casualty_incident).toBe(0);
    expect(row.incident_location_type).toBeNull();
    expect(row.dispatch_at).toBeNull();
    expect(row.patient_count).toBeNull();
  });
});

describe("writeTransport", () => {
  it("writes every field", async () => {
    const { db, queries } = makeDb();

    await writeTransport(db, 9, {
      destination: "Carson Tahoe",
      in_transport_at: t1,
      arrive_destination_at: t2,
      transfer_of_care_at: t3,
      transferred_to_doctor: "Dr. Ruiz",
    });

    expect(rowOf(queries[0])).toEqual({
      chart_id: 9,
      destination: "Carson Tahoe",
      in_transport_at: t1,
      arrive_destination_at: t2,
      transfer_of_care_at: t3,
      transferred_to_doctor: "Dr. Ruiz",
    });
  });
});

describe("writeObstetrics", () => {
  it("writes every field, with yes/no answers as 1 and 0", async () => {
    const { db, queries } = makeDb();

    await writeObstetrics(db, 9, {
      gravida: 3,
      para: 2,
      abortion: 1,
      due_date: t1,
      gestation: 38,
      vaginal_bleeding: true,
      contraction_onset: t2,
      frequency: 5,
      duration: 60,
      bag_of_water_ruptured: false,
      feels_baby_moving: true,
      delivery_time: t3,
      placenta_delivered: false,
      baby_sex: "F",
      born: "alive",
      apgar_1min: 7,
      apgar_5min: 9,
      apgar_10min: 10,
    });

    expect(rowOf(queries[0])).toEqual({
      chart_id: 9,
      gravida: 3,
      para: 2,
      abortion: 1,
      due_date: t1,
      gestation: 38,
      vaginal_bleeding: 1,
      contraction_onset: t2,
      frequency: 5,
      duration: 60,
      bag_of_water_ruptured: 0,
      feels_baby_moving: 1,
      delivery_time: t3,
      placenta_delivered: 0,
      baby_sex: "F",
      born: "alive",
      apgar_1min: 7,
      apgar_5min: 9,
      apgar_10min: 10,
    });
  });

  it("keeps a yes/no nobody answered as NULL, never as 0 (no)", async () => {
    const { db, queries } = makeDb();

    await writeObstetrics(db, 9, { gravida: 1 });

    const row = rowOf(queries[0]);
    expect(row.vaginal_bleeding).toBeNull();
    expect(row.bag_of_water_ruptured).toBeNull();
    expect(row.feels_baby_moving).toBeNull();
    expect(row.placenta_delivered).toBeNull();
  });
});

describe("writeChartPatientInfo", () => {
  it("writes every field, with the SET column as comma-separated text", async () => {
    const { db, queries } = makeDb();

    await writeChartPatientInfo(db, 9, {
      weight: 70.5,
      classification: "senior_adult",
      braslow_color: "Blue",
      history_given_by: ["patient", "family"],
      history_of_present_illness: "chest pain for two hours",
      medication_allergies: "penicillin",
      immunizations: "tetanus 2020",
      past_medical_history: "hypertension",
      regular_medicines: "lisinopril",
      alcohol_use: "weekly",
      drug_use: "none",
      invasive_airway_indications: "GCS below 8",
    });

    expect(rowOf(queries[0])).toEqual({
      chart_id: 9,
      weight: 70.5,
      classification: "senior_adult",
      braslow_color: "Blue",
      history_given_by: "patient,family",
      history_of_present_illness: "chest pain for two hours",
      medication_allergies: "penicillin",
      immunizations: "tetanus 2020",
      past_medical_history: "hypertension",
      regular_medicines: "lisinopril",
      alcohol_use: "weekly",
      drug_use: "none",
      invasive_airway_indications: "GCS below 8",
    });
  });
});

describe("writeMedicationsGiven", () => {
  it("writes every field for each medication, one row per medication", async () => {
    const { db, queries } = makeDb();

    await writeMedicationsGiven(db, 9, [
      {
        medication_name: "norepinephrine",
        dose: 5,
        unit: "mcg/min",
        route: "IV",
        is_infusion: true,
        infusion_rate: 2.5,
        infusion_rate_unit: "mL/h",
        infusion_stopped_at: t2,
        given_at: t1,
        given_by: 4,
        ordered_by: "Dr. Ruiz",
        results: "BP improved",
        complications: "none",
      },
      { medication_name: "saline", given_at: t3 },
    ]);

    const [infusion, plain] = rowsOf(queries[0]);
    expect(infusion).toEqual({
      chart_id: 9,
      medication_name: "norepinephrine",
      dose: 5,
      unit: "mcg/min",
      route: "IV",
      is_infusion: 1,
      infusion_rate: 2.5,
      infusion_rate_unit: "mL/h",
      infusion_stopped_at: t2,
      given_at: t1,
      given_by: 4,
      ordered_by: "Dr. Ruiz",
      results: "BP improved",
      complications: "none",
    });
    // a medication with nothing else filled in: not an infusion, the rest NULL
    expect(plain).toMatchObject({
      medication_name: "saline",
      is_infusion: 0,
      infusion_rate: null,
      dose: null,
      complications: null,
      given_at: t3,
    });
  });
});

describe("writeWoundCare", () => {
  it("writes every field", async () => {
    const { db, queries } = makeDb();

    await writeWoundCare(db, 9, {
      injury_occurred_at: t1,
      wound_location: "left hand",
      wound_type: "laceration",
      wound_size: "3 cm",
      wound_treatment: "sutured",
      wound_appearance: "clean",
      suture_location: "left hand",
      suture_date_placed: t2,
      sutures_removed: 4,
    });

    expect(rowOf(queries[0])).toEqual({
      chart_id: 9,
      injury_occurred_at: t1,
      wound_location: "left hand",
      wound_type: "laceration",
      wound_size: "3 cm",
      wound_treatment: "sutured",
      wound_appearance: "clean",
      suture_location: "left hand",
      suture_date_placed: t2,
      sutures_removed: 4,
    });
  });
});

describe("writeCrew", () => {
  it("writes one row per crew member, as system users with no free-text name", async () => {
    const { db, queries } = makeDb();

    await writeCrew(db, 9, [{ user_id: 2, role_on_call: "driver" }, { user_id: 3 }]);

    expect(rowsOf(queries[0])).toEqual([
      { chart_id: 9, user_id: 2, name: null, role_on_call: "driver" },
      { chart_id: 9, user_id: 3, name: null, role_on_call: null },
    ]);
  });
});

describe("writeVehicleAccident", () => {
  it("writes every field, with SET columns as comma-separated text", async () => {
    const { db, queries } = makeDb();

    await writeVehicleAccident(db, 9, {
      type: "motorcycle",
      impact: ["side", "roll_over"],
      estimated_speed: 45,
      safety_equipment: ["helmet", "protective_clothing"],
      ejection: false,
    });

    expect(rowOf(queries[0])).toEqual({
      chart_id: 9,
      type: "motorcycle",
      impact: "side,roll_over",
      estimated_speed: 45,
      safety_equipment: "helmet,protective_clothing",
      ejection: 0,
    });
  });

  it("keeps an unanswered ejection as NULL", async () => {
    const { db, queries } = makeDb();

    await writeVehicleAccident(db, 9, { type: "atv" });

    expect(rowOf(queries[0]).ejection).toBeNull();
  });
});

describe("writeFluidIntakeOutput", () => {
  it("writes one row per entry", async () => {
    const { db, queries } = makeDb();

    await writeFluidIntakeOutput(db, 9, [
      { kind: "iv fluids", phase: "transport", amount: 500 },
      { kind: "bleeding", phase: "pre transport", amount: 120 },
    ]);

    expect(rowsOf(queries[0])).toEqual([
      { chart_id: 9, kind: "iv fluids", phase: "transport", amount: 500 },
      { chart_id: 9, kind: "bleeding", phase: "pre transport", amount: 120 },
    ]);
  });
});

describe("writePhysicalExam", () => {
  it("writes one row per finding, with the side defaulting to none", async () => {
    const { db, queries } = makeDb();

    await writePhysicalExam(db, 9, [
      { region: "abdomen", finding: "tender" },
      { region: "lower_arm", side: "left", finding: "swollen" },
    ]);

    expect(rowsOf(queries[0])).toEqual([
      { chart_id: 9, region: "abdomen", side: "none", finding: "tender" },
      { chart_id: 9, region: "lower_arm", side: "left", finding: "swollen" },
    ]);
  });
});

describe("writeAssessment", () => {
  it("writes every field, with yes/no answers as 1 and 0", async () => {
    const { db, queries } = makeDb();

    await writeAssessment(db, 9, {
      pulse_strength: "weak",
      pulse_rate: "irregular",
      burn_calculation: 18.5,
      stroke_time: t1,
      stroke_facial_droop: true,
      stroke_arm_drift: false,
      stroke_abnormal_speech: true,
      extra_findings: "slurred speech",
    });

    expect(rowOf(queries[0])).toEqual({
      chart_id: 9,
      pulse_strength: "weak",
      pulse_rate: "irregular",
      burn_calculation: 18.5,
      stroke_time: t1,
      stroke_facial_droop: 1,
      stroke_arm_drift: 0,
      stroke_abnormal_speech: 1,
      extra_findings: "slurred speech",
    });
  });

  it("keeps unanswered stroke checks as NULL and leaves the burn calculation to the database default", async () => {
    const { db, queries } = makeDb();

    await writeAssessment(db, 9, { pulse_rate: "regular" });

    const row = rowOf(queries[0]);
    expect(row.stroke_facial_droop).toBeNull();
    expect(row.stroke_arm_drift).toBeNull();
    expect(row.stroke_abnormal_speech).toBeNull();
    // not sent as NULL, because the column is NOT NULL DEFAULT 0
    expect(row.burn_calculation).toBeUndefined();
  });
});
