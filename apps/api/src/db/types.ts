//  Author(s): Kaitlyn Clevidence, Isabel Sullivan
//  Start date: 2024-11-07
//  Last updated: 2026-11-24
//  P4: Prototype 
//  Purpose: define kysely types for the database tables; 
//  used to type the database connection and queries; 

import type { Generated } from "kysely";

export interface PatientsTable {
  patient_id: Generated<number>;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null; 
  home_address: string | null;
  birth_date: Date | null;
  gender: string | null;
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
  form_version: Generated<number>;
  created_at: Generated<Date>;
  submitted_at: Date | null;
  chart_uuid: string | null;
  incident_number: string | null;
  needs_review: Generated<number>;
  narrative: string | null;
}

//Addendum notes that are added to a chart after submission
export interface NotesTable {
  note_id: Generated<number>;
  chart_id: number;
  user_id: number | null;
  note: string;
  reason: string;
  date_added: Generated<Date>;
}

export interface AttachmentsTable {
  attachment_uuid: string;
  attachment_id: Generated<number>;
  storage_key: string;
  chart_id: number;
  file_type: string | null;
  original_name: string | null;
  size_bytes: number | null;
  uploaded_by: number | null;
  time_captured: Date | null;
  uploaded_at: Generated<Date>;
}

export interface Database {
  patients: PatientsTable;
  charts: ChartsTable;
  notes: NotesTable;
  attachments: AttachmentsTable;
}