// Author(s): Kaitlyn Clevidence
// Started: 11-16-2026
// P5: MVP
// Purpose: saves one submitted chart (patient, chart row, call-type block and
// sections) in a single transaction. If any step fails nothing is saved.

import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type {
  NewChart,
  NewClinicChart,
  PatientRef,
} from "../../domain/Chart.js";
import { insertedId } from "./helpers.js";
import { writeClinicVisit, writeVitals } from "./sectionWriters.js";

export interface SavedChart {
  chart_id: number;
  chart_uuid: string;
}

// Sections this repository can write so far.
const WRITABLE_SECTIONS = new Set<string>(["vitals"]);

function assertWritable(chart: NewChart): asserts chart is NewClinicChart {
  if (chart.call_type === "ambulance") {
    throw new Error("insertSubmitted: ambulance charts are not supported yet");
  }
  for (const [key, value] of Object.entries(chart.sections)) {
    if (value !== undefined && !WRITABLE_SECTIONS.has(key)) {
      throw new Error(`insertSubmitted: no writer for section "${key}" yet`);
    }
  }
}

async function resolvePatientId(
  db: Kysely<Database>,
  ref: PatientRef
): Promise<number> {
  if ("patient_id" in ref) return ref.patient_id;

  const p = ref.new_patient;
  const result = await db
    .insertInto("patients")
    .values({
      first_name: p.first_name,
      last_name: p.last_name,
      phone: p.phone ?? null,
      email: p.email ?? null,
      home_address: p.home_address ?? null,
      birth_date: p.birth_date ?? null,
      gender: p.gender,
    })
    .executeTakeFirstOrThrow();
  return insertedId(result);
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
        created_by: chart.created_by ?? null,
        is_practice: chart.is_practice ? 1 : 0,
        // A chart only reaches this repository once it is submitted.
        is_completed: 1,
        submitted_at: new Date(),
      })
      .executeTakeFirstOrThrow();
    const newChartId = insertedId(result);

    await writeClinicVisit(trx, newChartId, chart.clinic);
    if (chart.sections.vitals) {
      await writeVitals(trx, newChartId, chart.sections.vitals);
    }
    return newChartId;
  });

  return { chart_id: chartId, chart_uuid: chartUuid };
}
