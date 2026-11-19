// Author(s): Kaitlyn Clevidence & Sophia Koshy
// Start date: 2026-11-07
// Last updated: 2026-11-07
// P4: Prototype 
// Purpose: data layer repository for patient table;

import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";

export interface Patient {
  patient_id: number;
  first_name: string | null;
  last_name: string | null;
  birth_date: Date | null;
  gender: string | null;
}

export interface PatientRepository {
  getPatientById(id: number): Promise<Patient | undefined>;
}

export function createPatientRepository(
  db: Kysely<Database>
): PatientRepository {
  return {
    getPatientById: (id: number) =>
      db
        .selectFrom("patients")
        .select(["patient_id", "first_name", "last_name", "birth_date", "gender"])
        .where("patient_id", "=", id)
        .executeTakeFirst(),
  };
}