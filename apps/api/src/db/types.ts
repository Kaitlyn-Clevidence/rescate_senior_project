//  Author(s): Kaitlyn Clevidence
//  Start date: 2024-11-07
//  Last updated: 2024-11-07
//  P4: Prototype 
//  Purpose: define kysely types for the database tables; 
//  used to type the database connection and queries; 
//  currently only for prototype tables, ie. patients and charts

import type { Generated } from "kysely";

export interface PatientsTable {
  patient_id: Generated<number>;
  first_name: string;
  last_name: string;
  phone: string;
  email: string; 
  home_address: string;
  birth_date: Date | null;
  gender: string;
}

export interface ChartsTable {
  chart_id: Generated<number>;
  legacy_chart_id: number | null;
  patient_id: number;
  nature_of_call: string;
  call_type: "clinic" | "ambulance";
  encounter_date: Date;
  is_completed: Generated<number>; // MySQL booleans arrive as 0/1
  is_practice: Generated<number>;
  form_version: Generated<number>;
}

export interface UsersTable {
  user_id: Generated<number>;
  username: string | null;
  password_hash: string | null;
  email: string;
  phone: string | null;
  name: string | null;
  role: Generated<"admin" | "provider" | "board" | "trainee">;
  certifications: string | null;
  language_preferred: Generated<"en" | "es">;
  is_active: Generated<number>
  invited_by: number | null;
  created_at: Generated<Date>;
  password_set_at: Date | null;
  last_login_at: Date | null;
}

export interface UserTokensTable {
  token_id: Generated<number>;
  user_id: number;
  token_hash: string;
  purpose: "setup" | "reset";
  expires_at: Date;
  used_at: Date | null;
  created_at: Generated<Date>;
}

export interface Database {
  patients: PatientsTable;
  charts: ChartsTable;
  users: UsersTable;
  user_tokens: UserTokensTable;
}