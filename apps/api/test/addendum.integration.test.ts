// Author(s): Isabel Sullivan
// Start date: 2026-11-23
// Last updated: 2026-11-23
// P5: MVP
// Purpose: tests AddendumRepository against a real MySQL database for append to chart
// requires RUN_DB_TESTS to be set and migrations 0001-0005 to be run

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../src/config/index.js";
import { createDb } from "../src/db/index.js";
import { createAddendumRepository } from "../src/repositories/AddendumRepository.js";

describe.skipIf(!process.env.RUN_DB_TESTS)("AddendumRepository against MySQL", () => {
    const db = createDb(config.db);
    const addendum = createAddendumRepository(db);
    let draftChart: number;
    let submittedChart: number;
    let patientId: number;

    beforeAll(async()=> {
        const patient = await db
            .insertInto("patients")
            .values({first_name: "Addendum", last_name: "Test"})
            .executeTakeFirstOrThrow();
        patientId = Number(patient.insertId);

        const chart = (submitted_at: Date | null) =>
            db
                .insertInto("charts")
                .values({
                    patient_id: patientId,
                    nature_of_call: "Addendum test",
                    call_type: "clinic",
                    encounter_date: new Date("2026-11-20T18:00:00Z"),
                    submitted_at,
                })
                .executeTakeFirstOrThrow();
        submittedChart = Number((await chart(new Date("2026-11-20T19:00:00Z"))).insertId);
        draftChart = Number((await chart(null)).insertId);
    });

    afterAll(async()=> {
        await db.deleteFrom("charts").where("patient_id", "=", patientId).execute();
        await db.deleteFrom("patients").where("patient_id","=", patientId).execute();
        await db.destroy();
    });

    it("tells a submitted chart from a draft and a missing one", async () => {
        expect((await addendum.findChart(submittedChart))?.submitted_at).toBeInstanceOf(Date);
        expect(await addendum.findChart(draftChart)).toEqual({ submitted_at: null });
        expect(await addendum.findChart(2_000_000_000)).toBeUndefined();
    });

    it("saves notes and lists them from oldest to newest with the time they were added", async() => {
        const first = await addendum.addNote({chart_id: submittedChart, user_id: null, note: "New addendum", reason: "Follow-up"});
        const second = await addendum.addNote({chart_id: submittedChart, user_id: null, note: "Another addendum", reason: "Correction"});
        const notes = await addendum.listNotes(submittedChart);
        
        expect(notes.map((n)=> n.note_id)).toEqual([first, second]);
        expect(notes[0]).toMatchObject({note: "New addendum", reason: "Follow-up", user_id: null});
        expect(notes[0].date_added).toBeInstanceOf(Date);
    });

    it("only lists notes for the requested chart", async()=>{
        expect(await addendum.listNotes(draftChart)).toEqual([]);
    });
});