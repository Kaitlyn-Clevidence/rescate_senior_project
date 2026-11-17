// Author(s): Kaitlyn Clevidence
// Started: 11-12-2026
// Updated: 11-16-2026
// P5: MVP
// Purpose: the chart aggregate. One object that holds a whole chart as it
// moves through the backend. Field names are snake_case and match the
// database column names, so repositories need no renaming.

export const CALL_TYPES = ["clinic", "ambulance"] as const;
export type CallType = (typeof CALL_TYPES)[number];

// TODO confirm the full list of natures of call with the sponsor.
export const NATURES_OF_CALL = [
  "bp_check",
  "injection",
  "cardiac",
  "ob",
  "pulmonary",
  "trauma",
  "minor_wound",
  "suture_removal",
  "significant_injury_or_illness",
  "medical_other",
] as const;
export type NatureOfCall = (typeof NATURES_OF_CALL)[number];

// ---- Call-type blocks (exactly one per chart) ----
export interface ClinicVisit {
  intake_time?: Date;
  discharge_time?: Date;
  reason_for_visit?: string;
  discharge_instructions?: string;
}

export interface AmbulanceCall {
  call_category: "scene" | "transfer";
  dispatch_at?: Date;
  enroute_at?: Date;
  arrive_scene_at?: Date;
  patient_contact_at?: Date;
  depart_scene_at?: Date;
}

// ---- Sections (present only when the nature of call needs them) ----
export interface Vital {
  recorded_at: Date;
  heart_rate?: number;
  respiratory_rate?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  spo2?: number;
  etco2?: number;
  gcs_eyes?: number;
  gcs_motor?: number;
  gcs_verbal?: number;
  temperature?: number; // DECIMAL(4,1) in the DB, number here
  pain?: number;
}

export interface Obstetrics {
  gravida?: number;
  para?: number;
  abortion?: number;
  due_date?: Date;
  gestation?: number;
  vaginal_bleeding?: boolean;
  contraction_onset?: Date;
  frequency?: number;
  duration?: number;
  bag_of_water_ruptured?: boolean;
  feels_baby_moving?: boolean;
  delivery_time?: Date;
  placenta_delivered?: boolean;
  baby_sex?: string;
  born?: "alive" | "dead";
  apgar_1min?: number;
  apgar_5min?: number;
  apgar_10min?: number;
}

export interface ChartPatientInfo {
  weight?: number;
  classification?: "adult" | "senior_adult" | "pediatric" | "neonatal";
  braslow_color?:
    | "Gray" | "Pink" | "Red" | "Yellow" | "Purple"
    | "White" | "Blue" | "Orange" | "Green";
  estimated_age?: number;
  history_given_by?: ("patient" | "family" | "other")[];
  // NOT NULL in the DB today, but the injection and B/P short forms never
  // collect it. Optional here until the schema is settled with your teammate.
  history_of_present_illness?: string;
  medication_allergies?: string;
  environmental_allergies?: string;
  immunizations?: string;
  past_medical_history?: string;
  regular_medicines?: string;
}

export interface Transport {
  destination?: string;
  arrive_destination_at?: Date;
  transfer_of_care_at?: Date;
}

export interface MedicationGiven {
  medication_name: string;
  dose?: number;
  unit?: string;
  route?: string;
  // NOT NULL in the DB, but the injection short form has no time field.
  given_at?: Date;
  given_by?: number;
  ordered_by?: string;
  results?: string;
}

export interface WoundCare {
  injury_occurred_at?: Date;
  wound_location?: string;
  wound_type?: string;
  wound_size?: string;
  wound_treatment?: string;
  wound_appearance?: string;
  suture_location?: string;
  suture_date_placed?: Date;
  sutures_removed?: number;
}

export interface ConsentForm {
  form_type: "consent" | "ama";
  language: "en" | "es";
  signer_name: string;
  signed_at: Date;
  text_version: number;
  // Storage key of the signature file uploaded during the draft. The
  // repository creates the attachment row at submit, then links it here.
  signature_key?: string;
}

// One slot per section. One-row sections are objects, many-row are arrays.
export interface ChartSections {
  chart_patient_info?: ChartPatientInfo;
  vitals?: Vital[];
  medications_given?: MedicationGiven[];
  wound_care?: WoundCare;
  obstetrics?: Obstetrics;
  transport?: Transport;
  consent_forms?: ConsentForm[];
}

// ---- Patient ----
export interface NewPatient {
  first_name: string;
  last_name: string;
  age?: number;
  phone?: string;
  email?: string;
  home_address?: string;
  birth_date?: Date;
  gender: string; // CHAR(1)
}

// Either an existing patient or data for a new one, so insertSubmitted can
// create the patient inside its own transaction.
export type PatientRef =
  | { patient_id: number }
  | { new_patient: NewPatient };

// ---- The aggregate ----

interface NewChartBase {
  nature_of_call: NatureOfCall;
  encounter_date: Date;
  patient: PatientRef;
  created_by?: number;
  incident_number?: string;
  trauma_cause_id?: number;
  is_practice?: boolean;
  sections: ChartSections;
}

export interface NewClinicChart extends NewChartBase {
  call_type: "clinic";
  clinic: ClinicVisit;
}

export interface NewAmbulanceChart extends NewChartBase {
  call_type: "ambulance";
  ambulance: AmbulanceCall;
}

// What insertSubmitted accepts. The call_type field picks the block, so an
// ambulance chart with a clinic block is a compile error.
export type NewChart = NewClinicChart | NewAmbulanceChart;

// Fields the database generates. Added when a chart is read back.
export interface StoredFields {
  chart_id: number;
  chart_uuid: string;
  created_at: Date;
  submitted_at: Date | null;
}

// What findByUuid returns.
export type Chart = NewChart & StoredFields;
