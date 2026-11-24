// Author(s): Kaitlyn Clevidence
// Started: 11-16-2026
// Updated: 11-24-2026
// P5: MVP
// Purpose: saves one submitted chart (patient, chart row, call-type block and
// every section) in a single transaction. If any step fails nothing is saved.

import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type { NewChart, PatientRef } from "../../domain/Chart.js";
import { allowedSections } from "../../domain/sections.js";
import { insertedId } from "../helpers.js";
import { insertPatient } from "../patientWriter.js";
import {
  writeAmbulanceCall,
  writeAssessment,
  writeChartPatientInfo,
  writeClinicVisit,
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
  writeWoundCare,
} from "./sectionWriters.js";

export interface SavedChart {
  chart_id: number;
  chart_uuid: string;
}

// Checks that run before anything is written, so a bad chart fails without
// touching the database. (A failure later, inside the transaction, also saves
// nothing, but this way it fails fast with a clear message.)
function assertWritable(chart: NewChart): void {
  // A section must be one the registry allows on this call type. That rejects
  // a vehicle accident on a clinic chart, and a misspelled section name,
  // instead of silently dropping it.
  const allowed: string[] = allowedSections(chart.call_type);
  for (const [key, value] of Object.entries(chart.sections)) {
    if (value !== undefined && !allowed.includes(key)) {
      throw new Error(
        `insertSubmitted: section "${key}" is not allowed on a ${chart.call_type} chart`
      );
    }
  }

  // Signature files are not saved yet (attachments are not wired in), so
  // refuse them instead of saving a consent form that lost its signature.
  for (const form of chart.sections.consent_forms ?? []) {
    if (form.signature_key !== undefined || form.witness_signature_key !== undefined) {
      throw new Error("insertSubmitted: saving signature files is not supported yet");
    }
  }
}

async function resolvePatientId(
  db: Kysely<Database>,
  ref: PatientRef
): Promise<number> {
  if ("patient_id" in ref) return ref.patient_id;
  return insertPatient(db, ref.new_patient);
}

export async function insertSubmittedChart(
  db: Kysely<Database>,
  chart: NewChart
): Promise<SavedChart> {
  assertWritable(chart);
  const chartUuid = randomUUID();

  const chartId = await db.transaction().execute(async (trx) => {
    const patientId = await resolvePatientId(trx, chart.patient);

    const result = await trx
      .insertInto("charts")
      .values({
        chart_uuid: chartUuid,
        legacy_chart_id: null,
        patient_id: patientId,
        // TODO: stored value for nature of call is undecided (code vs label)
        nature_of_call: chart.nature_of_call,
        call_type: chart.call_type,
        encounter_date: chart.encounter_date,
        incident_number: chart.incident_number ?? null,
        trauma_cause_id: chart.trauma_cause_id ?? null,
        created_by: chart.created_by,
        narrative: chart.narrative,
        // Practice charts (trainees) are discarded before this point, and the
        // is_practice column no longer exists (dropped in 0005).
        // A chart only reaches this repository once it is submitted.
        is_completed: 1,
        submitted_at: new Date(),
      })
      .executeTakeFirstOrThrow();
    const id = insertedId(result);

    // Every table below has a foreign key to the chart, so the chart row must
    // exist first. The order after that does not matter to the database;
    // consent forms go last because their signatures will point at
    // attachment rows (not saved yet).
    if (chart.call_type === "clinic") {
      await writeClinicVisit(trx, id, chart.clinic);
    } else {
      await writeAmbulanceCall(trx, id, chart.ambulance);
    }

    const s = chart.sections;
    if (s.crew) await writeCrew(trx, id, s.crew);
    if (s.vehicle_accident) await writeVehicleAccident(trx, id, s.vehicle_accident);
    if (s.chart_patient_info) await writeChartPatientInfo(trx, id, s.chart_patient_info);
    if (s.vitals) await writeVitals(trx, id, s.vitals);
    if (s.medications_given) await writeMedicationsGiven(trx, id, s.medications_given);
    if (s.wound_care) await writeWoundCare(trx, id, s.wound_care);
    if (s.obstetrics) await writeObstetrics(trx, id, s.obstetrics);
    if (s.transport) await writeTransport(trx, id, s.transport);
    if (s.procedures_performed) await writeProceduresPerformed(trx, id, s.procedures_performed);
    if (s.fluid_intake_output) await writeFluidIntakeOutput(trx, id, s.fluid_intake_output);
    if (s.physical_exam) await writePhysicalExam(trx, id, s.physical_exam);
    if (s.assessments) await writeAssessment(trx, id, s.assessments);
    if (s.consent_forms) await writeConsentForms(trx, id, s.consent_forms);

    return id;
  });

  return { chart_id: chartId, chart_uuid: chartUuid };
}
