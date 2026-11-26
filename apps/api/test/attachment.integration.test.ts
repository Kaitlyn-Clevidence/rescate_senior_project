// Author(s): Isabel Sullivan
// Start date: 2026-11-25
// Last updated: 2026-11-25
// P5: MVP
// Purpose: tests AttachmentRepository against a real MySQL database
// requires RUN_DB_TESTS to be set and migrations 0001-0006 to be run

import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { config } from "../src/config/index.js";
import { createDb } from "../src/db/index.js";
import { createAttachmentRepository } from "../src/repositories/AttachmentRepository.js";

describe.skipIf(!process.env.RUN_DB_TESTS)("AttachmentRepository against MySQL", () => {
    const db = createDb(config.db);
    const attachments = createAttachmentRepository(db);
    let patientId: number;

    //Deleting the chart deletes the attachments with it
    afterAll(async () => {
        await db.deleteFrom("charts").where("patient_id", "=", patientId).execute();
        await db.deleteFrom("patients").where("patient_id", "=", patientId).execute();
        await db.destroy();
    });

    it("saves an attachments, lists it, and finds it with its storage key", async ()=> {
        const patient = await db
            .insertInto("patients")
            .values({first_name: "Attachment", last_name: "Test"})
            .executeTakeFirstOrThrow();
        
        patientId = Number(patient.insertId);
        const chart = await db
            .insertInto("charts")
            .values({
                patient_id: patientId,
                nature_of_call: "Attachment test",
                call_type: "clinic",
                encounter_date: new Date("2026-11-22T18:00:00Z"),
                submitted_at: new Date("2026-11-22T19:00:00Z"),
            })
            .executeTakeFirstOrThrow();
        const chartId = Number(chart.insertId);
        const uuid = randomUUID();

        await attachments.add({
            attachment_uuid: uuid,
            chart_id: chartId,
            storage_key: `${uuid}.jpg`,
            file_type: "image/jpeg",
            original_name: "wound.jpg",
            size_bytes: 1200,
            uploaded_by: null,
            time_captured: null,
        });

        const listed = await attachments.listByChart(chartId);
        expect(listed).toHaveLength(1);
        expect(listed[0]).toMatchObject({attachment_uuid: uuid, original_name: "wound.jpg", size_bytes: 1200});
        expect(listed[0]).not.toHaveProperty("storage_key");
        expect(await attachments.findByUuid(uuid)).toMatchObject({storage_key: `${uuid}.jpg`});
    });
});