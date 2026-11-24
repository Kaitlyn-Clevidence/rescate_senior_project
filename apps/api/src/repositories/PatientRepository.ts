// Author(s): Kaitlyn Clevidence & Sophia Koshy
// Start date: 2026-11-07
// Last updated: 2026-11-24
// P5: MVP
// Purpose: data layer repository for patient table. Reads return only the
// public columns, never phone, email or home address.

import { sql, type Kysely } from "kysely";
import type { Database } from "../db/types.js";
import type { NewPatient } from "../domain/Chart.js";
import { insertPatient } from "./patientWriter.js";

const PATIENT_COLUMNS = [
  "patient_id", "first_name", "last_name", "birth_date", "estimated_age", "gender",
] as const;

// Names and gender can be NULL (unconscious patients, children). Every chart
// needs a birth date or an estimated age, but that is checked in the service.
export interface Patient {
  patient_id: number;
  first_name: string | null;
  last_name: string | null;
  birth_date: Date | null;
  estimated_age: number | null;
  gender: string | null;
}

// Both names are needed to search, so an anonymous patient (no name) is never
// returned by findCandidates; the form should create a new patient for them.
export interface PatientSearch {
  first_name: string;
  last_name: string;
  birth_date?: Date; // optional: narrows the match when the medic knows it
}

export interface PatientRepository {
  getPatientById(id: number): Promise<Patient | undefined>;
  create(patient: NewPatient): Promise<Patient>;
  findCandidates(search: PatientSearch): Promise<Patient[]>;
}

export function createPatientRepository(
  db: Kysely<Database>
): PatientRepository {
  return {
    getPatientById: (id: number) =>
      db
        .selectFrom("patients")
        .select(PATIENT_COLUMNS)
        .where("patient_id", "=", id)
        .executeTakeFirst(),

    create: async (patient) => {
      const patientId = await insertPatient(db, patient);
      return db
        .selectFrom("patients")
        .select(PATIENT_COLUMNS)
        .where("patient_id", "=", patientId)
        .executeTakeFirstOrThrow();
    },

    findCandidates: ({ first_name, last_name, birth_date }) => {
      let query = db
        .selectFrom("patients")
        .select(PATIENT_COLUMNS)
        .where("first_name", "=", first_name.trim())
        .where("last_name", "=", last_name.trim());

      if (birth_date) {
        query = query.where(
          sql<boolean>`patients.birth_date = date(${birth_date})`
        );
      }

      return query
        .orderBy("last_name")
        .orderBy("first_name")
        .limit(10)
        .execute();
    },
  };
}