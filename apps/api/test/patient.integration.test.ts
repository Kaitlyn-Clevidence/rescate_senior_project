// Author(s): Kaitlyn Clevidence
// Started: 11-24-2026
// P5: MVP
// Purpose: tests PatientRepository.create and findCandidates against a real
// MySQL database. Runs only when RUN_DB_TESTS is set. Every patient it makes
// carries a unique marker as the last name, and only those rows are deleted.

import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { config } from "../src/config/index.js";
import { createDb } from "../src/db/index.js";
import { createPatientRepository } from "../src/repositories/PatientRepository.js";

describe.skipIf(!process.env.RUN_DB_TESTS)("PatientRepository against MySQL", () => {
  const db = createDb(config.db);
  const patients = createPatientRepository(db);
  const marker = `PatientTest-${randomUUID().slice(0, 8)}`;
  const anonymousIds: number[] = [];

  afterAll(async () => {
    await db.deleteFrom("patients").where("last_name", "=", marker).execute();
    if (anonymousIds.length > 0) {
      await db.deleteFrom("patients").where("patient_id", "in", anonymousIds).execute();
    }
    await db.destroy();
  });

  it("creates a patient and returns only the public columns", async () => {
    const created = await patients.create({
      first_name: "Maria",
      last_name: marker,
      birth_date: new Date("1985-08-20T12:00:00"),
      gender: "F",
      phone: "775-555-0100",
      email: "maria@example.test",
      home_address: "1 Test Street",
    });

    expect(created.patient_id).toBeGreaterThan(0);
    expect(created).toMatchObject({ first_name: "Maria", last_name: marker, gender: "F" });
    expect(created).not.toHaveProperty("phone");
    expect(created).not.toHaveProperty("email");
    expect(created).not.toHaveProperty("home_address");

    // reads hide the contact details, but they must still have been saved
    const stored = await db
      .selectFrom("patients")
      .select(["phone", "email", "home_address", "birth_date"])
      .where("patient_id", "=", created.patient_id)
      .executeTakeFirstOrThrow();
    expect(stored).toMatchObject({
      phone: "775-555-0100",
      email: "maria@example.test",
      home_address: "1 Test Street",
    });
    expect(stored.birth_date).toBeInstanceOf(Date);
  });

  it("creates an anonymous patient with only an estimated age", async () => {
    const created = await patients.create({ estimated_age: 40 });
    anonymousIds.push(created.patient_id);

    expect(created).toMatchObject({
      first_name: null,
      last_name: null,
      gender: null,
      birth_date: null,
      estimated_age: 40,
    });
  });

  it("finds a candidate by name, ignoring case", async () => {
    const found = await patients.findCandidates({
      first_name: "MARIA",
      last_name: marker.toLowerCase(),
    });

    expect(found).toHaveLength(1);
    expect(found[0].last_name).toBe(marker);
  });

  it("narrows by birth date, and finds nothing for a different date", async () => {
    const right = await patients.findCandidates({
      first_name: "Maria",
      last_name: marker,
      birth_date: new Date("1985-08-20T09:30:00"),
    });
    const wrong = await patients.findCandidates({
      first_name: "Maria",
      last_name: marker,
      birth_date: new Date("1990-01-01T12:00:00"),
    });

    expect(right).toHaveLength(1);
    expect(wrong).toEqual([]);
  });

  it("never returns an anonymous patient from a name search", async () => {
    const found = await patients.findCandidates({ first_name: "", last_name: "" });

    expect(found).toEqual([]);
  });

  it("returns at most 10 candidates", async () => {
    for (let i = 0; i < 12; i++) {
      await patients.create({ first_name: "Many", last_name: marker });
    }

    const found = await patients.findCandidates({ first_name: "Many", last_name: marker });

    expect(found).toHaveLength(10);
  });
});
