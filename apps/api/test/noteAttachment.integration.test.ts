// Author(s): Kaitlyn Clevidence
// Started: 11-24-2026
// P5: MVP
// Purpose: tests NoteRepository and AttachmentRepository against a real MySQL
// database. Runs only when RUN_DB_TESTS is set. It makes its own provider user
// and chart, tagged with a unique marker, and deletes only those rows.

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../src/config/index.js";
import { createDb } from "../src/db/index.js";
import { createAttachmentRepository } from "../src/repositories/AttachmentRepository.js";
import { createChartRepository } from "../src/repositories/ChartRepository.js";
import { createNoteRepository } from "../src/repositories/NoteRepository.js";

describe.skipIf(!process.env.RUN_DB_TESTS)("notes and attachments against MySQL", () => {
  const db = createDb(config.db);
  const notes = createNoteRepository(db);
  const attachments = createAttachmentRepository(db);
  const marker = `NoteTest-${randomUUID().slice(0, 8)}`;
  let userId = 0;
  let chartId = 0;

  beforeAll(async () => {
    const user = await db
      .insertInto("users")
      .values({
        username: marker,
        password_hash: "not-a-real-hash",
        email: null,
        phone: null,
        name: "Note Test Provider",
        certifications: null,
      })
      .executeTakeFirstOrThrow();
    userId = Number(user.insertId);

    const saved = await createChartRepository(db).insertSubmitted({
      call_type: "clinic",
      nature_of_call: "bp_check",
      encounter_date: new Date("2026-11-24T10:00:00Z"),
      created_by: userId,
      narrative: "Chart for the note and attachment tests.",
      patient: { new_patient: { first_name: "Test", last_name: marker, gender: "F" } },
      clinic: {},
      sections: {},
    });
    chartId = saved.chart_id;
  });

  afterAll(async () => {
    // deleting the chart also removes its notes and attachments (cascade)
    if (chartId) await db.deleteFrom("charts").where("chart_id", "=", chartId).execute();
    await db.deleteFrom("patients").where("last_name", "=", marker).execute();
    await db.deleteFrom("users").where("username", "=", marker).execute();
    await db.destroy();
  });

  describe("notes", () => {
    it("saves an addendum with its author and reason", async () => {
      const saved = await notes.insert({
        chart_id: chartId,
        user_id: userId,
        note: "  Added the discharge vitals.  ",
        reason: "Left out at submit",
      });

      expect(saved).toMatchObject({
        chart_id: chartId,
        user_id: userId,
        author_name: "Note Test Provider",
        note: "Added the discharge vitals.",
        reason: "Left out at submit",
      });
      expect(saved.note_id).toBeGreaterThan(0);
      expect(saved.date_added).toBeInstanceOf(Date);
    });

    it("lists a chart's addenda oldest first", async () => {
      await notes.insert({ chart_id: chartId, user_id: userId, note: "Second note", reason: "Follow up" });

      const list = await notes.listByChart(chartId);

      expect(list.map((n) => n.note)).toEqual(["Added the discharge vitals.", "Second note"]);
    });

    it("returns an empty list for a chart with no addenda", async () => {
      expect(await notes.listByChart(99999999)).toEqual([]);
    });

    it("refuses a note for a chart that does not exist", async () => {
      await expect(
        notes.insert({ chart_id: 99999999, user_id: userId, note: "x", reason: "y" })
      ).rejects.toThrow();
    });

    it("saves nothing when the reason is missing", async () => {
      const before = (await notes.listByChart(chartId)).length;

      await expect(
        notes.insert({ chart_id: chartId, user_id: userId, note: "x", reason: " " })
      ).rejects.toThrow("reason is required");

      expect((await notes.listByChart(chartId)).length).toBe(before);
    });
  });

  describe("attachments", () => {
    it("saves attachment metadata and gives it a random uuid", async () => {
      const saved = await attachments.insert({
        chart_id: chartId,
        storage_key: `drafts/${marker}/signature.png`,
        file_type: "image/png",
        uploaded_by: userId,
        time_captured: new Date("2026-11-24T10:00:00"),
      });

      expect(saved.attachment_uuid).toMatch(/^[0-9a-f-]{36}$/);
      expect(saved).toMatchObject({
        chart_id: chartId,
        storage_key: `drafts/${marker}/signature.png`,
        file_type: "image/png",
        uploaded_by: userId,
      });
      expect(saved.time_captured).toEqual(new Date("2026-11-24T10:00:00"));
    });

    it("finds an attachment by its uuid, and returns undefined for an unknown one", async () => {
      const saved = await attachments.insert({ chart_id: chartId, storage_key: `drafts/${marker}/photo.jpg` });

      const found = await attachments.findByUuid(saved.attachment_uuid);
      const missing = await attachments.findByUuid(randomUUID());

      expect(found?.attachment_id).toBe(saved.attachment_id);
      expect(missing).toBeUndefined();
    });

    it("lists a chart's attachments in the order they were added", async () => {
      const list = await attachments.listByChart(chartId);

      expect(list.length).toBeGreaterThanOrEqual(2);
      const ids = list.map((a) => a.attachment_id);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
    });

    it("refuses an attachment for a chart that does not exist", async () => {
      await expect(
        attachments.insert({ chart_id: 99999999, storage_key: "x" })
      ).rejects.toThrow();
    });
  });
});
