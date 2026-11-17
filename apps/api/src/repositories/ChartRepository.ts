// Author(s): Kaitlyn Clevidence & Sophia Koshy
// Start date: 2026-11-05
// Last updated: 2026-11-07
// Purpose: data layer repository for chart table; 
// contains queries to the chart table and methods to interract with chart

import { sql, type Kysely } from "kysely";
import type { Database } from "../db/types.js";
import type { NewChart } from "../domain/Chart.js";
import {
  insertSubmittedChart,
  type SavedChart,
} from "./chart/insertSubmitted.js";

// One row of the chart list. The full chart is the Chart type in domain/.
export interface ChartSummary {
  chart_id: number;
  encounter_date: Date;
  nature_of_call: string;
  patient_name: string;
}

export interface ChartRepository {
  listCharts(): Promise<ChartSummary[]>;
  getChartById(id: number): Promise<ChartSummary | undefined>;
  listChartsByPatientId(patientId: number): Promise<ChartSummary[]>;
  // Saves a whole submitted chart in one transaction. Insert only: there is
  // deliberately no update or delete (FR12).
  insertSubmitted(chart: NewChart): Promise<SavedChart>;
}

export function createChartRepository(
  db: Kysely<Database>
): ChartRepository {
  // shared base SELECT;  each call starts fresh
  const baseQuery = () =>
    db
      .selectFrom("charts")
      .innerJoin("patients", "patients.patient_id", "charts.patient_id")
      .select([
        "charts.chart_id",
        "charts.encounter_date",
        "charts.nature_of_call",
        sql<string>`concat(patients.first_name, ' ', patients.last_name)`.as(
          "patient_name"
        ),
      ]);

  return {
    listCharts: () =>
      baseQuery().orderBy("charts.encounter_date", "desc").execute(),

    getChartById: (id: number) =>
      baseQuery().where("charts.chart_id", "=", id).executeTakeFirst(),

    listChartsByPatientId: (patientId: number) =>
      baseQuery()
        .where("charts.patient_id", "=", patientId)
        .orderBy("charts.encounter_date", "desc")
        .execute(),

    insertSubmitted: (chart: NewChart) => insertSubmittedChart(db, chart),
  };
}