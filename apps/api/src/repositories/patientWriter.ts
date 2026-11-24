import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import type { NewPatient } from "../domain/Chart.js";
import { insertedId } from "./helpers.js";

// Inserts one patient row and returns the new patient_id. Takes any Kysely
// handle, so it works on its own or inside a transaction.
export async function insertPatient(
  db: Kysely<Database>,
  patient: NewPatient
): Promise<number> {
  const result = await db
    .insertInto("patients")
    .values({
      // Names and gender are optional (unconscious patients, children).
      first_name: patient.first_name ?? null,
      last_name: patient.last_name ?? null,
      phone: patient.phone ?? null,
      email: patient.email ?? null,
      home_address: patient.home_address ?? null,
      birth_date: patient.birth_date ?? null,
      // A chart needs a birth date or an estimated age (checked in the service).
      estimated_age: patient.estimated_age ?? null,
      gender: patient.gender ?? null,
    })
    .executeTakeFirstOrThrow();
  return insertedId(result);
}