// Author(s): Kaitlyn Clevidence
// Start date: 2026-11-16
// Last updated: 2026-11-24
// P5: MVP
// Purpose: data layer repository for the notes table. A note is an addendum
// added after a chart is submitted, logged with who wrote it, when, and why.
// Insert and read only: there is no update or delete, so an addendum can never
// be changed or removed (FR12). Only providers and admins may add one; that is
// checked in the service, not here.

import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";

export interface NewNote {
  chart_id: number;
  user_id: number; // who wrote it; the database allows NULL only for legacy notes
  note: string;
  reason: string; // why the addendum was added
}

export interface Note {
  note_id: number;
  chart_id: number;
  user_id: number | null;
  author_name: string | null; // from users; NULL for a legacy note with no user
  note: string;
  reason: string;
  date_added: Date;
}

export interface NoteRepository {
  insert(note: NewNote): Promise<Note>;
  // Oldest first, so the addenda read in the order they were added.
  listByChart(chartId: number): Promise<Note[]>;
}

export function createNoteRepository(db: Kysely<Database>): NoteRepository {
  // Shared base SELECT (a function, so each call starts fresh). The author's
  // name is joined in, but never their email, phone or password.
  const baseQuery = () =>
    db
      .selectFrom("notes")
      .leftJoin("users", "users.user_id", "notes.user_id")
      .select([
        "notes.note_id",
        "notes.chart_id",
        "notes.user_id",
        "users.name as author_name",
        "notes.note",
        "notes.reason",
        "notes.date_added",
      ]);

  return {
    insert: async (newNote) => {
      // An empty string would pass the NOT NULL columns, so check it here.
      if (newNote.note.trim() === "") {
        throw new Error("NoteRepository.insert: the note cannot be empty");
      }
      if (newNote.reason.trim() === "") {
        throw new Error("NoteRepository.insert: a reason is required");
      }

      const result = await db
        .insertInto("notes")
        .values({
          chart_id: newNote.chart_id,
          user_id: newNote.user_id,
          note: newNote.note.trim(),
          reason: newNote.reason.trim(),
        })
        .executeTakeFirstOrThrow();

      return baseQuery()
        .where("notes.note_id", "=", Number(result.insertId))
        .executeTakeFirstOrThrow();
    },

    listByChart: (chartId) =>
      baseQuery()
        .where("notes.chart_id", "=", chartId)
        .orderBy("notes.date_added")
        .orderBy("notes.note_id")
        .execute(),
  };
}
