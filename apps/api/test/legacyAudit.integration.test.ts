// Author(s): Kaitlyn Clevidence
// Started: 11-24-2026
// P5: MVP
// Purpose: tests LegacyArchiveRepository and AuditRepository against a real
// MySQL database. Runs only when RUN_DB_TESTS is set. Every row it makes is
// tagged with a unique marker, and only those rows are deleted.
// NOTE: deleting audit rows here works because the test connects as a user
// with full rights. The app's own user must not be able to (see 0006).

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "../src/config/index.js";
import { createDb } from "../src/db/index.js";
import { createAuditRepository } from "../src/repositories/AuditRepository.js";
import { createLegacyArchiveRepository } from "../src/repositories/LegacyArchiveRepository.js";

describe.skipIf(!process.env.RUN_DB_TESTS)("legacy archive and audit log against MySQL", () => {
  const db = createDb(config.db);
  const archive = createLegacyArchiveRepository(db);
  const audit = createAuditRepository(db);
  const id = randomUUID().slice(0, 8);
  const entityA = `t_${id}_a`;
  const entityB = `t_${id}_b`;
  const actionPrefix = `audit_test_${id}`;
  let userId = 0;

  beforeAll(async () => {
    const user = await db
      .insertInto("users")
      .values({
        username: `AuditTest-${id}`,
        password_hash: "not-a-real-hash",
        email: null,
        phone: null,
        name: "Audit Test Admin",
        certifications: null,
      })
      .executeTakeFirstOrThrow();
    userId = Number(user.insertId);
  });

  afterAll(async () => {
    await db.deleteFrom("charts_v1_archive").where("entity", "like", `t_${id}%`).execute();
    await db.deleteFrom("audit_log").where("action", "like", `${actionPrefix}%`).execute();
    await db.deleteFrom("users").where("user_id", "=", userId).execute();
    await db.destroy();
  });

  describe("legacy archive", () => {
    const original = { fname: "José", lname: "Ñandú", notes: "dolor abdominal", vitals: [{ hr: 72 }] };

    it("saves a row and reads it back exactly, accents included", async () => {
      expect(await archive.insertRaw(entityA, 101, original)).toBe(true);

      const found = await archive.findByLegacyId(entityA, 101);

      expect(found?.raw_row).toEqual(original);
      expect(found?.entity).toBe(entityA);
      expect(found?.legacy_id).toBe(101);
      expect(found?.archived_at).toBeInstanceOf(Date);
    });

    it("keeps the first copy when the same legacy row is archived again", async () => {
      const second = await archive.insertRaw(entityA, 101, { fname: "Changed" });

      expect(second).toBe(false);
      expect((await archive.findByLegacyId(entityA, 101))?.raw_row).toEqual(original);
    });

    it("treats the same legacy id under a different entity as a different row", async () => {
      expect(await archive.insertRaw(entityB, 101, { other: true })).toBe(true);
    });

    it("returns undefined for a row that was never archived", async () => {
      expect(await archive.findByLegacyId(entityA, 99999)).toBeUndefined();
    });

    it("counts archived rows per entity", async () => {
      await archive.insertRaw(entityA, 102, {});

      const counts = await archive.countByEntity();

      expect(counts.find((c) => c.entity === entityA)?.count).toBe(2);
      expect(counts.find((c) => c.entity === entityB)?.count).toBe(1);
    });
  });

  describe("audit log", () => {
    it("records events and lists them newest first with the user's name", async () => {
      await audit.record({
        user_id: userId,
        action: `${actionPrefix}.one`,
        entity: "chart",
        entity_id: "abc-123",
        ip_address: "10.0.0.1",
        user_agent: "test-agent",
        details: { nature: "bp_check", count: 2 },
      });
      await audit.record({ action: `${actionPrefix}.two`, entity: "chart", entity_id: 7 });

      const list = await audit.query({ action: `${actionPrefix}.one` });
      const all = await audit.query({ entity: "chart" }, { limit: 200 });
      const mine = all.filter((e) => e.action.startsWith(actionPrefix));

      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        user_id: userId,
        user_name: "Audit Test Admin",
        entity: "chart",
        entity_id: "abc-123",
        ip_address: "10.0.0.1",
        user_agent: "test-agent",
        details: { nature: "bp_check", count: 2 },
      });
      expect(list[0].created_at).toBeInstanceOf(Date);
      // newest first: the second event was recorded last
      expect(mine.map((e) => e.action)).toEqual([`${actionPrefix}.two`, `${actionPrefix}.one`]);
    });

    it("keeps an event with no user, and its details as NULL", async () => {
      await audit.record({ action: `${actionPrefix}.nouser` });

      const [entry] = await audit.query({ action: `${actionPrefix}.nouser` });

      expect(entry.user_id).toBeNull();
      expect(entry.user_name).toBeNull();
      expect(entry.details).toBeNull();
    });

    it("filters by user, by entity id and by time", async () => {
      const byUser = await audit.query({ user_id: userId, action: `${actionPrefix}.one` });
      const byEntityId = await audit.query({ entity: "chart", entity_id: 7 });
      const dayMs = 24 * 60 * 60 * 1000;
      const recent = await audit.query({
        action: `${actionPrefix}.one`,
        from: new Date(Date.now() - 2 * dayMs),
        to: new Date(Date.now() + 2 * dayMs),
      });
      const longAgo = await audit.query({
        action: `${actionPrefix}.one`,
        to: new Date("2000-01-01T00:00:00Z"),
      });

      expect(byUser).toHaveLength(1);
      expect(byEntityId.some((e) => e.action === `${actionPrefix}.two`)).toBe(true);
      expect(recent).toHaveLength(1);
      expect(longAgo).toEqual([]);
    });

    it("pages through the results", async () => {
      for (let i = 0; i < 5; i++) {
        await audit.record({ action: `${actionPrefix}.page`, entity_id: i });
      }

      const first = await audit.query({ action: `${actionPrefix}.page` }, { limit: 2, offset: 0 });
      const second = await audit.query({ action: `${actionPrefix}.page` }, { limit: 2, offset: 2 });
      const last = await audit.query({ action: `${actionPrefix}.page` }, { limit: 2, offset: 4 });

      expect(first.map((e) => e.entity_id)).toEqual(["4", "3"]);
      expect(second.map((e) => e.entity_id)).toEqual(["2", "1"]);
      expect(last.map((e) => e.entity_id)).toEqual(["0"]);
    });

    it("cuts an over-long user agent instead of losing the event", async () => {
      await audit.record({ action: `${actionPrefix}.long`, user_agent: "x".repeat(1000) });

      const [entry] = await audit.query({ action: `${actionPrefix}.long` });

      expect(entry.user_agent).toHaveLength(255);
    });

    it("refuses an event for a user that does not exist", async () => {
      await expect(
        audit.record({ user_id: 99999999, action: `${actionPrefix}.bad` })
      ).rejects.toThrow();
    });
  });
});
