// Author(s): Kaitlyn Clevidence
// Started: 11-24-2026
// P5: MVP
// Purpose: tests NoteRepository and AttachmentRepository with a fake database.
// They check the SQL that would be sent and the guards that reject bad input
// before any query. Real rows are covered by noteAttachment.integration.test.ts.

import {
  DummyDriver,
  Kysely,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  type CompiledQuery,
} from "kysely";
import { describe, expect, it } from "vitest";
import type { Database } from "../src/db/types.js";
import { insertAttachment } from "../src/repositories/attachmentWriter.js";
import { createAttachmentRepository } from "../src/repositories/AttachmentRepository.js";
import { createNoteRepository } from "../src/repositories/NoteRepository.js";

function makeDb() {
  const queries: CompiledQuery[] = [];
  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new MysqlAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (kysely) => new MysqlIntrospector(kysely),
      createQueryCompiler: () => new MysqlQueryCompiler(),
    },
    log: (event) => {
      if (event.level === "query") queries.push(event.query);
    },
  });
  return { db, queries };
}

describe("NoteRepository", () => {
  it("lists a chart's notes oldest first, with the author's name joined in", async () => {
    const { db, queries } = makeDb();

    await createNoteRepository(db).listByChart(7);

    const { sql, parameters } = queries[0];
    expect(sql).toContain("left join `users`");
    expect(sql).toContain("`users`.`name` as `author_name`");
    expect(sql).toContain("where `notes`.`chart_id` = ?");
    expect(sql).toContain("order by `notes`.`date_added`, `notes`.`note_id`");
    expect(parameters).toEqual([7]);
  });

  it("never selects the author's email, phone or password", async () => {
    const { db, queries } = makeDb();

    await createNoteRepository(db).listByChart(7);

    for (const hidden of ["email", "phone", "password", "*"]) {
      expect(queries[0].sql).not.toContain(hidden);
    }
  });

  it("rejects an empty note before any query", async () => {
    const { db, queries } = makeDb();

    await expect(
      createNoteRepository(db).insert({ chart_id: 1, user_id: 2, note: "   ", reason: "typo" })
    ).rejects.toThrow("cannot be empty");
    expect(queries).toEqual([]);
  });

  it("rejects a missing reason before any query", async () => {
    const { db, queries } = makeDb();

    await expect(
      createNoteRepository(db).insert({ chart_id: 1, user_id: 2, note: "Added vitals", reason: "" })
    ).rejects.toThrow("reason is required");
    expect(queries).toEqual([]);
  });

  it("has no way to change or remove a note", () => {
    const { db } = makeDb();

    expect(Object.keys(createNoteRepository(db)).sort()).toEqual(["insert", "listByChart"]);
  });
});

describe("AttachmentRepository", () => {
  it("looks up by uuid with the value as a parameter", async () => {
    const { db, queries } = makeDb();

    await createAttachmentRepository(db).findByUuid("abc-123");

    const { sql, parameters } = queries[0];
    expect(sql).toContain("where `attachment_uuid` = ?");
    expect(parameters).toEqual(["abc-123"]);
  });

  it("lists a chart's attachments in the order they were added", async () => {
    const { db, queries } = makeDb();

    await createAttachmentRepository(db).listByChart(7);

    const { sql, parameters } = queries[0];
    expect(sql).toContain("where `chart_id` = ?");
    expect(sql).toContain("order by `attachment_id`");
    expect(parameters).toEqual([7]);
  });

  it("never puts hostile input into the SQL text", async () => {
    const { db, queries } = makeDb();

    await createAttachmentRepository(db).findByUuid("x'; DROP TABLE attachments; --");

    expect(queries[0].sql).not.toContain("DROP");
  });

  it("has no way to change or remove an attachment", () => {
    const { db } = makeDb();

    expect(Object.keys(createAttachmentRepository(db)).sort()).toEqual([
      "findByUuid",
      "insert",
      "listByChart",
    ]);
  });
});

describe("insertAttachment", () => {
  it("generates a random uuid for each attachment", async () => {
    const { db, queries } = makeDb();

    // the fake driver returns no insert id, so each call fails after its query
    await expect(insertAttachment(db, { chart_id: 1, storage_key: "a" })).rejects.toThrow(
      "did not return a new id"
    );
    await expect(insertAttachment(db, { chart_id: 1, storage_key: "b" })).rejects.toThrow(
      "did not return a new id"
    );

    const uuids = queries.map((q) => q.parameters[0]);
    expect(uuids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuids[0]).not.toBe(uuids[1]);
  });

  it("rejects an empty storage key before any query", async () => {
    const { db, queries } = makeDb();

    await expect(insertAttachment(db, { chart_id: 1, storage_key: "  " })).rejects.toThrow(
      "storage_key is required"
    );
    expect(queries).toEqual([]);
  });
});
