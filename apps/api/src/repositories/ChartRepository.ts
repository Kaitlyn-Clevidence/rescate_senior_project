// Author(s): Kaitlyn Clevidence & Sophia Koshy
// Start date: 2024-06-05
// Last updated: 2026-11-05
// P4: Prototype 
// Purpose: data layer repository for chart table; 
// contains queries to the chart table and methods to interract with chart

import type mysql from "mysql2/promise";

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
