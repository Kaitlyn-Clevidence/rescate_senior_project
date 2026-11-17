//  Author(s): Kaitlyn Clevidence, Isabel Sullivan
//  P5: MVP
//  Purpose: Kysely types for every table in migrations 0001-0004.
//  Conventions (mysql2 defaults):
//   - BOOLEAN columns arrive as 0/1
//   - DECIMAL columns arrive as strings (see NullableDecimal below)
//   - SET columns arrive as comma-separated strings; repositories convert to arrays
//   - JSON columns arrive already parsed

import type { ColumnType, Generated } from "kysely";

// DECIMAL: read as string, write as number or string
type NullableDecimal = ColumnType<
  string | null,
  number | string | null | undefined,
  number | string | null
>;
type GeneratedDecimal = ColumnType<string, number | string | undefined, number | string>;

export type CallType = "clinic" | "ambulance";
export type Role = "admin" | "provider" | "board" | "trainee";
export type Language = "en" | "es";

// ---- 0001 ----
export interface PatientsTable {
  patient_id: Generated<number>;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  home_address: string | null;
  birth_date: Date | null;
  gender: string; // CHAR(1)
}

export interface ChartsTable {
  chart_id: Generated<number>;
  chart_uuid: string | null;
  legacy_chart_id: number | null;
  incident_number: string | null;
  patient_id: number;
  trauma_cause_id: number | null;
  created_by: number | null;
  trauma_cause_id: number | null;
  created_by: number | null;
  nature_of_call: string;
  call_type: CallType;
  encounter_date: Date;
  is_completed: Generated<number>;
  is_practice: Generated<number>;
  form_version: Generated<number>;
  needs_review: Generated<number>;
  created_at: Generated<Date>;
  submitted_at: Date | null;
}

// ---- 0002 ----
export interface UsersTable {
  user_id: Generated<number>;
  username: string;
  password_hash: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: Generated<Role>;
  certifications: string | null;
  language_preferred: Generated<Language>;
  is_active: Generated<number>;
}

export interface AmbulanceCallsTable {
  chart_id: number;
  incident_location: string | null; // added in 0003
  incident_address: string | null;  // added in 0003
  call_category: "scene" | "transfer";
  mass_casualty_incident: Generated<number>;
  patient_count: number | null;
  agencies: string | null;
  disposition: string | null;
  unit_number: string | null;
  triage_color: string | null;
  care_level: string | null;
  dispatch_at: Date | null;
  enroute_at: Date | null;
  arrive_scene_at: Date | null;
  patient_contact_at: Date | null;
  depart_scene_at: Date | null;
}

export interface ClinicVisitsTable {
  chart_id: number;
  intake_time: Date | null;
  discharge_time: Date | null;
  reason_for_visit: string | null;
  discharge_instructions: string | null;
}

export interface VitalsTable {
  vital_id: Generated<number>;
  chart_id: number;
  recorded_at: Date;
  heart_rate: number | null;
  respiratory_rate: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  spo2: number | null;
  etco2: number | null;
  gcs_eyes: number | null;
  gcs_motor: number | null;
  gcs_verbal: number | null;
  temperature: NullableDecimal;
  pain: number | null;
}

export interface NotesTable {
  note_id: Generated<number>;
  chart_id: number;
  user_id: number | null;
  note: string;
  date_added: Generated<Date>;
}

export interface AttachmentsTable {
  attachment_id: Generated<number>;
  attachment_uuid: string;
  chart_id: number;
  storage_key: string;
  file_type: string | null;
  uploaded_by: number | null;
  time_captured: Date | null;
}

export interface ObstetricsTable {
  chart_id: number;
  gravida: number | null;
  para: number | null;
  abortion: number | null;
  due_date: Date | null;
  gestation: number | null;
  vaginal_bleeding: number | null;
  contraction_onset: Date | null;
  frequency: number | null;
  duration: number | null;
  bag_of_water_ruptured: number | null;
  feels_baby_moving: number | null;
  delivery_time: Date | null;
  placenta_delivered: number | null;
  baby_sex: string | null; // CHAR(1)
  born: "alive" | "dead" | null;
  apgar_1min: number | null;
  apgar_5min: number | null;
  apgar_10min: number | null;
}

export interface ChartPatientInfoTable {
  chart_id: number;
  weight: NullableDecimal;
  classification: "adult" | "senior_adult" | "pediatric" | "neonatal" | null;
  braslow_color:
    | "Gray" | "Pink" | "Red" | "Yellow" | "Purple"
    | "White" | "Blue" | "Orange" | "Green"
    | null;
  estimated_age: number | null;
  history_given_by: string | null; // SET('patient','family','other')
  history_of_present_illness: string;
  medication_allergies: string | null;
  environmental_allergies: string | null;
  immunizations: string | null;
  past_medical_history: string | null;
  regular_medicines: string | null;
}

export interface TransportsTable {
  chart_id: number;
  destination: string | null;
  arrive_destination_at: Date | null;
  transfer_of_care_at: Date | null;
}

export interface VehicleAccidentTable {
  chart_id: number;
  type:
    | "auto_into_object" | "auto_into_auto" | "motorcycle"
    | "atv" | "boat" | "aviation"
    | null;
  impact: string | null;           // SET('head_on','side','rear','roll_over')
  estimated_speed: number | null;
  safety_equipment: string | null; // SET('none','seatbelt','helmet',...)
  ejection: number | null;
}

export interface ChartFormsTable {
  chart_form_id: Generated<number>;
  chart_id: number;
  form_type: "consent" | "ama";
  language: Language;
  signer_name: string;
  signed_at: Date;
  signature_attachment_id: number | null;
  text_version: number;
}

export interface ChartCrewTable {
  crew_member_id: Generated<number>;
  chart_id: number; // references ambulance_calls.chart_id
  user_id: number | null;
  name: string | null;
  role_on_call: string | null;
}

export interface WoundCareTable {
  chart_id: number;
  injury_occurred_at: Date | null;
  wound_location: string | null;
  wound_type: string | null;
  wound_size: string | null;
  wound_treatment: string | null;
  wound_appearance: string | null;
  suture_location: string | null;
  suture_date_placed: Date | null;
  sutures_removed: number | null;
}

export interface MedicationsGivenTable {
  medication_given_id: Generated<number>;
  chart_id: number;
  medication_name: string;
  dose: NullableDecimal;
  unit: string | null;
  route: string | null;
  given_at: Date;
  given_by: number | null;
  ordered_by: string | null;
  results: string | null;
}

export interface ProceduresPerformedTable {
  procedure_performed_id: Generated<number>;
  chart_id: number;
  procedure_code: string;
  performed_at: Date;
  performed_by: number;
  details: unknown | null; // JSON, shape depends on procedure_code
  notes: string | null;
}

export interface FluidIntakeOutputTable {
  fluid_entry_id: Generated<number>;
  chart_id: number;
  kind: "bleeding" | "iv fluids" | "oral fluids" | "vomit";
  phase: "pre transport" | "transport";
  amount: number;
}

export interface PhysicalExamTable {
  physical_exam_id: Generated<number>;
  chart_id: number;
  region:
    | "skin" | "mental" | "neurological" | "head" | "neck" | "chest"
    | "abdomen" | "pelvis" | "back" | "upper_arm" | "lower_arm"
    | "hand_wrist" | "upper_leg" | "lower_leg" | "ankle_foot";
  side: Generated<"none" | "left" | "right">;
  finding: string;
}

export interface AssessmentsTable {
  chart_id: number;
  pulse_strength: "normal" | "weak" | "absent" | "bounding" | null;
  pulse_rate: "regular" | "irregular" | null;
  burn_calculation: GeneratedDecimal;
  stroke_time: Date | null;
  stroke_facial_droop: number | null;
  stroke_arm_drift: number | null;
  stroke_abnormal_speech: number | null;
  extra_findings: string | null;
}

export interface TraumaCausesTable {
  trauma_cause_id: Generated<number>;
  code: string;
  name_en: string;
  name_es: string;
  is_active: Generated<number>;
}

export interface ChartsV1ArchiveTable {
  archive_id: Generated<number>;
  entity: string;
  legacy_id: number;
  raw_row: unknown; // JSON
  archived_at: Generated<Date>;
}

// ---- 0004 (proposed) ----
export interface PasswordTokensTable {
  token_id: Generated<number>;
  user_id: number;
  token_hash: string; // SHA-256 hex, never the raw token
  purpose: "setup" | "reset";
  expires_at: Date;
  used_at: Date | null;
  created_at: Generated<Date>;
}

export interface AuditLogTable {
  audit_id: Generated<number>;
  user_id: number | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: unknown | null; // JSON; never put PHI here
  created_at: Generated<Date>;
}

export interface Database {
  patients: PatientsTable;
  charts: ChartsTable;
  users: UsersTable;
  ambulance_calls: AmbulanceCallsTable;
  clinic_visits: ClinicVisitsTable;
  vitals: VitalsTable;
  notes: NotesTable;
  attachments: AttachmentsTable;
  obstetrics: ObstetricsTable;
  chart_patient_info: ChartPatientInfoTable;
  transports: TransportsTable;
  vehicle_accident: VehicleAccidentTable;
  chart_forms: ChartFormsTable;
  chart_crew: ChartCrewTable;
  wound_care: WoundCareTable;
  medications_given: MedicationsGivenTable;
  procedures_performed: ProceduresPerformedTable;
  fluid_intake_output: FluidIntakeOutputTable;
  physical_exam: PhysicalExamTable;
  assessments: AssessmentsTable;
  trauma_causes: TraumaCausesTable;
  charts_v1_archive: ChartsV1ArchiveTable;
  password_tokens: PasswordTokensTable;
  audit_log: AuditLogTable;
}