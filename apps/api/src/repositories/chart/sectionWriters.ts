// Author(s): Kaitlyn Clevidence
// Started: 11-16-2026
// Updated: 11-17-2026
// P5: MVP
// Purpose: one small writer per chart section. Each takes the domain object
// and inserts its rows. They take a Kysely handle (a transaction in practice) 
// Rules every writer follows:
//  - a missing optional field is written as NULL (?? null)
//  - a nullable yes/no column keeps "not answered" as NULL (boolToDb)
//  - many-row writers return early on an empty list, because Kysely rejects
//    an insert with no rows
//  - a field the database requires but the domain leaves optional throws a
//    clear error before any query is sent
//  - a field the sponsor requires but the database has no column for yet is
//    refused with a clear error instead of being silently dropped

import type { Kysely } from "kysely";
import type { Database } from "../../db/types.js";
import type {
  AmbulanceCall,
  Assessment,
  ChartPatientInfo,
  ClinicVisit,
  ConsentForm,
  CrewMember,
  FluidEntry,
  MedicationGiven,
  Obstetrics,
  PhysicalExamFinding,
  ProcedurePerformed,
  Transport,
  VehicleAccident,
  Vital,
  WoundCare,
} from "../../domain/Chart.js";
import { boolToDb } from "../helpers.js";

// ---- Call-type blocks: exactly one row per chart ----

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

export async function writeAmbulanceCall(
  db: Kysely<Database>,
  chartId: number,
  ambulance: AmbulanceCall
): Promise<void> {
  await db
    .insertInto("ambulance_calls")
    .values({
      chart_id: chartId,
      call_category: ambulance.call_category,
      incident_location: ambulance.incident_location ?? null,
      incident_location_type: ambulance.incident_location_type ?? null,
      incident_address: ambulance.incident_address ?? null,
      // NOT NULL in the DB with a default of false, so unanswered means 0.
      mass_casualty_incident: ambulance.mass_casualty_incident ? 1 : 0,
      patient_count: ambulance.patient_count ?? null,
      agencies: ambulance.agencies ?? null,
      disposition: ambulance.disposition ?? null,
      unit_number: ambulance.unit_number ?? null,
      triage_color: ambulance.triage_color ?? null,
      care_level: ambulance.care_level ?? null,
      dispatch_at: ambulance.dispatch_at ?? null,
      enroute_at: ambulance.enroute_at ?? null,
      arrive_scene_at: ambulance.arrive_scene_at ?? null,
      patient_contact_at: ambulance.patient_contact_at ?? null,
      depart_scene_at: ambulance.depart_scene_at ?? null,
    })
    .execute();
}

// ---- Sections with many rows per chart ----

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
        responsiveness: v.responsiveness ?? null,
        rass: v.rass ?? null,
        mean_arterial_pressure: v.mean_arterial_pressure ?? null,
        bp_method: v.bp_method ?? null,
        heart_rate_method: v.heart_rate_method ?? null,
        ecg: v.ecg ?? null,
        blood_glucose: v.blood_glucose ?? null,
      }))
    )
    .execute();
}

export async function writeMedicationsGiven(
  db: Kysely<Database>,
  chartId: number,
  medications: MedicationGiven[]
): Promise<void> {
  if (medications.length === 0) return;
  await db
    .insertInto("medications_given")
    .values(
      medications.map((m) => ({
        chart_id: chartId,
        medication_name: m.medication_name,
        dose: m.dose ?? null,
        unit: m.unit ?? null,
        route: m.route ?? null,
        // NOT NULL in the DB with a default of false, so unanswered means 0.
        is_infusion: m.is_infusion ? 1 : 0,
        infusion_rate: m.infusion_rate ?? null,
        infusion_rate_unit: m.infusion_rate_unit ?? null,
        infusion_stopped_at: m.infusion_stopped_at ?? null,
        given_at: m.given_at,
        given_by: m.given_by ?? null,
        ordered_by: m.ordered_by ?? null,
        results: m.results ?? null,
        complications: m.complications ?? null,
      }))
    )
    .execute();
}

// The witness name and time are saved. Signature attachments (the patient's
// and the witness's) are not built yet, so a form that carries a signature file
// is refused instead of being saved without it.
export async function writeConsentForms(
  db: Kysely<Database>,
  chartId: number,
  forms: ConsentForm[]
): Promise<void> {
  if (forms.length === 0) return;
  await db
    .insertInto("chart_forms")
    .values(
      forms.map((f) => {
        if (f.signature_key !== undefined) {
          throw new Error(
            "writeConsentForms: saving signature attachments is not supported yet"
          );
        }
        if (f.witness_signature_key !== undefined) {
          throw new Error(
            "writeConsentForms: saving the witness signature attachment is not supported yet"
          );
        }
        return {
          chart_id: chartId,
          form_type: f.form_type,
          language: f.language,
          signer_name: f.signer_name,
          signed_at: f.signed_at,
          signature_attachment_id: null,
          text_version: f.text_version,
          witness_name: f.witness_name ?? null,
          witness_signed_at: f.witness_signed_at ?? null,
          witness_signature_attachment_id: null,
        };
      })
    )
    .execute();
}

// Every crew member is a system user. chart_crew points at charts (since
// 0005), so a clinic chart's provider can be saved too.
export async function writeCrew(
  db: Kysely<Database>,
  chartId: number,
  crew: CrewMember[]
): Promise<void> {
  if (crew.length === 0) return;
  await db
    .insertInto("chart_crew")
    .values(
      crew.map((c) => ({
        chart_id: chartId,
        user_id: c.user_id,
        name: null,
        role_on_call: c.role_on_call ?? null,
      }))
    )
    .execute();
}

export async function writeProceduresPerformed(
  db: Kysely<Database>,
  chartId: number,
  procedures: ProcedurePerformed[]
): Promise<void> {
  if (procedures.length === 0) return;
  await db
    .insertInto("procedures_performed")
    .values(
      procedures.map((p) => ({
        chart_id: chartId,
        procedure_code: p.procedure_code,
        performed_at: p.performed_at,
        performed_by: p.performed_by,
        // JSON column: mysql2 does not convert an object for us.
        details: p.details === undefined ? null : JSON.stringify(p.details),
        notes: p.notes ?? null,
      }))
    )
    .execute();
}

export async function writeFluidIntakeOutput(
  db: Kysely<Database>,
  chartId: number,
  fluidEntries: FluidEntry[]
): Promise<void> {
  if (fluidEntries.length === 0) return;
  await db
    .insertInto("fluid_intake_output")
    .values(
      fluidEntries.map((f) => ({
        chart_id: chartId,
        kind: f.kind,
        phase: f.phase,
        amount: f.amount,
      }))
    )
    .execute();
}

export async function writePhysicalExam(
  db: Kysely<Database>,
  chartId: number,
  findings: PhysicalExamFinding[]
): Promise<void> {
  if (findings.length === 0) return;
  await db
    .insertInto("physical_exam")
    .values(
      findings.map((f) => ({
        chart_id: chartId,
        region: f.region,
        side: f.side ?? "none",
        finding: f.finding,
      }))
    )
    .execute();
}

// ---- Sections with one row per chart ----

export async function writeChartPatientInfo(
  db: Kysely<Database>,
  chartId: number,
  patientInfo: ChartPatientInfo
): Promise<void> {
  // TODO: history_of_present_illness is NOT NULL in the DB but the short
  // forms never collect it. Remove this check once the column is nullable.
  if (patientInfo.history_of_present_illness === undefined) {
    throw new Error(
      "writeChartPatientInfo: history_of_present_illness is required by the database"
    );
  }
  await db
    .insertInto("chart_patient_info")
    .values({
      chart_id: chartId,
      weight: patientInfo.weight ?? null,
      classification: patientInfo.classification ?? null,
      braslow_color: patientInfo.braslow_color ?? null,
      // SET column: stored as comma-separated text
      history_given_by: patientInfo.history_given_by?.join(",") ?? null,
      history_of_present_illness: patientInfo.history_of_present_illness,
      medication_allergies: patientInfo.medication_allergies ?? null,
      immunizations: patientInfo.immunizations ?? null,
      past_medical_history: patientInfo.past_medical_history ?? null,
      regular_medicines: patientInfo.regular_medicines ?? null,
      alcohol_use: patientInfo.alcohol_use ?? null,
      drug_use: patientInfo.drug_use ?? null,
      invasive_airway_indications: patientInfo.invasive_airway_indications ?? null,
    })
    .execute();
}

export async function writeTransport(
  db: Kysely<Database>,
  chartId: number,
  transport: Transport
): Promise<void> {
  await db
    .insertInto("transports")
    .values({
      chart_id: chartId,
      destination: transport.destination ?? null,
      in_transport_at: transport.in_transport_at ?? null,
      arrive_destination_at: transport.arrive_destination_at ?? null,
      transfer_of_care_at: transport.transfer_of_care_at ?? null,
      transferred_to_doctor: transport.transferred_to_doctor ?? null,
    })
    .execute();
}

export async function writeVehicleAccident(
  db: Kysely<Database>,
  chartId: number,
  accident: VehicleAccident
): Promise<void> {
  await db
    .insertInto("vehicle_accident")
    .values({
      chart_id: chartId,
      type: accident.type ?? null,
      // SET columns: stored as comma-separated text
      impact: accident.impact?.join(",") ?? null,
      estimated_speed: accident.estimated_speed ?? null,
      safety_equipment: accident.safety_equipment?.join(",") ?? null,
      ejection: boolToDb(accident.ejection),
    })
    .execute();
}

export async function writeWoundCare(
  db: Kysely<Database>,
  chartId: number,
  woundCare: WoundCare
): Promise<void> {
  await db
    .insertInto("wound_care")
    .values({
      chart_id: chartId,
      injury_occurred_at: woundCare.injury_occurred_at ?? null,
      wound_location: woundCare.wound_location ?? null,
      wound_type: woundCare.wound_type ?? null,
      wound_size: woundCare.wound_size ?? null,
      wound_treatment: woundCare.wound_treatment ?? null,
      wound_appearance: woundCare.wound_appearance ?? null,
      suture_location: woundCare.suture_location ?? null,
      suture_date_placed: woundCare.suture_date_placed ?? null,
      sutures_removed: woundCare.sutures_removed ?? null,
    })
    .execute();
}

export async function writeObstetrics(
  db: Kysely<Database>,
  chartId: number,
  obstetrics: Obstetrics
): Promise<void> {
  await db
    .insertInto("obstetrics")
    .values({
      chart_id: chartId,
      gravida: obstetrics.gravida ?? null,
      para: obstetrics.para ?? null,
      abortion: obstetrics.abortion ?? null,
      due_date: obstetrics.due_date ?? null,
      gestation: obstetrics.gestation ?? null,
      vaginal_bleeding: boolToDb(obstetrics.vaginal_bleeding),
      contraction_onset: obstetrics.contraction_onset ?? null,
      frequency: obstetrics.frequency ?? null,
      duration: obstetrics.duration ?? null,
      bag_of_water_ruptured: boolToDb(obstetrics.bag_of_water_ruptured),
      feels_baby_moving: boolToDb(obstetrics.feels_baby_moving),
      delivery_time: obstetrics.delivery_time ?? null,
      placenta_delivered: boolToDb(obstetrics.placenta_delivered),
      baby_sex: obstetrics.baby_sex ?? null,
      born: obstetrics.born ?? null,
      apgar_1min: obstetrics.apgar_1min ?? null,
      apgar_5min: obstetrics.apgar_5min ?? null,
      apgar_10min: obstetrics.apgar_10min ?? null,
    })
    .execute();
}

export async function writeAssessment(
  db: Kysely<Database>,
  chartId: number,
  assessment: Assessment
): Promise<void> {
  await db
    .insertInto("assessments")
    .values({
      chart_id: chartId,
      pulse_strength: assessment.pulse_strength ?? null,
      pulse_rate: assessment.pulse_rate ?? null,
      burn_calculation: assessment.burn_calculation,
      stroke_time: assessment.stroke_time ?? null,
      stroke_facial_droop: boolToDb(assessment.stroke_facial_droop),
      stroke_arm_drift: boolToDb(assessment.stroke_arm_drift),
      stroke_abnormal_speech: boolToDb(assessment.stroke_abnormal_speech),
      extra_findings: assessment.extra_findings ?? null,
    })
    .execute();
}
