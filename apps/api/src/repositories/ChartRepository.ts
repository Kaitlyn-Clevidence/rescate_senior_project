// Author(s): Kaitlyn Clevidence & Sophia Koshy
// Start date: 2024-06-05
// Last updated: 2026-11-06
// P4: Prototype 
// Purpose: data layer repository for chart table; 
// contains queries to the chart table and methods to interract with chart

import { sql, type Kysely } from "kysely";
import type { Database } from "../db/types.js";

export interface Chart {
  chart_id: number;
  encounter_date: Date;
  nature_of_call: string;
  patient_name: string;
}

export interface ChartRepository {
  listCharts(): Promise<Chart[]>;
  getChartById(id: number): Promise<Chart | undefined>;
}

export function createChartRepository(
  db: Kysely<Database>
): ChartRepository {
  // shared base SELECT, same idea as before; a function so each call starts fresh
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
  };
}