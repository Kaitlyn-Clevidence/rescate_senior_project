// Author(s): Kaitlyn Clevidence & Sophia Koshy
// Start date: 2024-06-05
// Last updated: 2026-11-06
// P4: Prototype 
// Purpose: data layer repository for chart table; 
// contains queries to the chart table and methods to interract with chart

import type mysql from "mysql2/promise";

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
  pool: mysql.Pool
): ChartRepository {
  const baseQuery = `
    SELECT
      charts.chart_id,
      charts.encounter_date,
      charts.nature_of_call,
      patients.patient_name
    FROM charts
    JOIN patients
      ON charts.patient_id = patients.patient_id
  `;

  return {
    async listCharts() {
      const [rows] = await pool.execute(
        `${baseQuery} ORDER BY charts.encounter_date DESC`
      );

      return rows as Chart[];
    },

    async getChartById(id: number) {
      const [rows] = await pool.execute(
        `${baseQuery} WHERE charts.chart_id = ?`,
        [id]
      );

      const charts = rows as Chart[];
      return charts[0] ?? undefined;
    },
  };
}

export async function getPatientById(
  pool: mysql.Pool,
  id: number
) {
  const [rows] = await pool.execute(
    "SELECT * FROM patients WHERE id = ?",
    [id]
  );

  const patients = rows as mysql.RowDataPacket[];

  return patients[0] ?? undefined;
}