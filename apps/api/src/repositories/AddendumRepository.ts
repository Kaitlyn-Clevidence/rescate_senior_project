// Author(s): Isabel Sullivan
// Start date: 2026-11-21
// Last updated: 2026-11-21
// P5: MVP
// Purpose: data layer repository for appending to a chart
// saves and lists notes added to a chart after it is submitted

import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";

// One addendum note as the app gets it back
export interface Note {
    note_id: number;
    chart_id: number;
    user_id: number | null;
    note: string;
    reason: string;
    date_added: Date;
}

export interface NewNote {
    chart_id: number;
    user_id: number | null; // null until login exists
    note: string;
    reason: string;
}

export interface AddendumRepository {
    findChart(chartId: number): Promise<{submitted_at: Date | null} | undefined>;
    addNote(note: NewNote): Promise<number>;
    listNotes(chartId: number): Promise<Note[]>;
}

export function createAddendumRepository(db: Kysely<Database>): AddendumRepository {
    return {
        findChart:(chartId) =>
            db
                .selectFrom("charts")
                .select("submitted_at")
                .where("chart_id","=", chartId)
                .executeTakeFirst(),
        
        async addNote(note) {
            const result = await db
                .insertInto("notes")
                .values({
                    chart_id: note.chart_id,
                    user_id: note.user_id,
                    note: note.note,
                    reason: note.reason,
                })
                .executeTakeFirstOrThrow();
            return Number(result.insertId); 
        },

        listNotes: (chartId) =>
            db
                .selectFrom("notes")
                .select(["note_id","chart_id","user_id","note","reason","date_added"])
                .where("chart_id","=", chartId)
                .orderBy("date_added", "asc")
                .orderBy("note_id", "asc")
                .execute(),

                
    };
}