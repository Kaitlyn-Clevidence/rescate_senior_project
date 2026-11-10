//  Author(s): Kaitlyn Clevidence, Isabel Sullivan
//  Start date: 2024-11-07
//  Last updated: 2026-11-09
//  P4: Prototype 
//  Purpose: define kysely types for the database tables; 
//  used to type the database connection and queries; 
//  currently only for prototype tables, ie. patients and charts

import type { Generated } from "kysely";

export interface PatientsTable {
  patient_id: Generated<number>;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null; 
  home_address: string | null;
  birth_date: Date | null;
  gender: string;
}

export interface ChartsTable {
  chart_id: Generated<number>;
  legacy_chart_id: number | null;
  patient_id: number;
  trauma_cause_id: number | null;
  created_by: number | null;
  nature_of_call: string;
  call_type: "clinic" | "ambulance";
  encounter_date: Date;
  is_completed: Generated<number>; // MySQL booleans arrive as 0/1
  is_practice: Generated<number>;
  form_version: Generated<number>;
  created_at: Generated<Date>;
  submitted_at: Date | null;
}

export interface Database {
  patients: PatientsTable;
  charts: ChartsTable;
}