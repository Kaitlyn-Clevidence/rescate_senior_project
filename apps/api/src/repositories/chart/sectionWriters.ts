// Author(s): Kaitlyn Clevidence
// Started: 11-16-2026
// P5: MVP
// Purpose: one small writer per chart section. Each takes the domain object
// (snake_case, same names as the columns) and inserts its rows. They take a
// Kysely handle (a transaction in practice) and never open their own
// transaction.

import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type { ClinicVisit, Vital } from "../../domain/Chart.js";

export async function writeClinicVisit(
  db: Kysely<Database>,
  chartId: number,
  clinic: ClinicVisit
): Promise<void> {
  await db
    .insertInto("clinic_visits")
    .values({
      chart_id: chartId,
      intake_time: clinic.intake_time ?? null,
      discharge_time: clinic.discharge_time ?? null,
      reason_for_visit: clinic.reason_for_visit ?? null,
      discharge_instructions: clinic.discharge_instructions ?? null,
    })
    .execute();
}

// Many rows per chart. An empty list writes nothing (Kysely rejects an
// insert with no rows).
export async function writeVitals(
  db: Kysely<Database>,
  chartId: number,
  vitals: Vital[]
): Promise<void> {
  if (vitals.length === 0) return;
  await db
    .insertInto("vitals")
    .values(
      vitals.map((v) => ({
        chart_id: chartId,
        recorded_at: v.recorded_at,
        heart_rate: v.heart_rate ?? null,
        respiratory_rate: v.respiratory_rate ?? null,
        systolic_bp: v.systolic_bp ?? null,
        diastolic_bp: v.diastolic_bp ?? null,
        spo2: v.spo2 ?? null,
        etco2: v.etco2 ?? null,
        gcs_eyes: v.gcs_eyes ?? null,
        gcs_motor: v.gcs_motor ?? null,
        gcs_verbal: v.gcs_verbal ?? null,
        temperature: v.temperature ?? null,
        pain: v.pain ?? null,
      }))
    )
    .execute();
}
