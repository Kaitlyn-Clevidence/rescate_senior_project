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
      first_name: patient.first_name,
      last_name: patient.last_name,
      phone: patient.phone ?? null,
      email: patient.email ?? null,
      home_address: patient.home_address ?? null,
      birth_date: patient.birth_date ?? null,
      gender: patient.gender,
    })
    .executeTakeFirstOrThrow();
  return insertedId(result);
}