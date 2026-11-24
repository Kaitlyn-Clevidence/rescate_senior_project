// Author(s): Isabel Sullivan
// Start date: 2026-11-21
// Last updated: 2026-11-21
// P5: MVP
// Purpose: rules for appending to a chart; a note can only be added
// to a chart that exists and has been submitted, and addenda are never
// edited or deleted, only added

import type { AddendumRepository, Note } from "../repositories/AddendumRepository.js";

export interface NoteRequest {
    note: string;
    reason: string;
}

export type AddNoteResult =
    | { ok: true; noteId: number }
    | { ok: false; error: "chart_not_found" | "chart_not_submitted" };

export type ListNotesResult =
    | { ok: true; notes: Note[] }
    | { ok: false; error: "chart_not_found" };

export interface AddendumService {
    addNote(chartId: number, userId: number | null, request: NoteRequest): Promise<AddNoteResult>;
    listNotes(chartId: number): Promise<ListNotesResult>;
}

export function createAddendumService(addenda: AddendumRepository): AddendumService {
    return {
        async addNote(chartId, userId, request) {
            const chart = await addenda.findChart(chartId);
            if(!chart){
                return {ok: false, error: "chart_not_found"};
            }
            if(!chart.submitted_at) {
                return {ok: false, error: "chart_not_submitted"};
            }

            const noteId = await addenda.addNote({
                chart_id: chartId,
                user_id: userId,
                note: request.note.trim(),
                reason: request.reason.trim(),
            });
            return {ok: true, noteId};
        },

        async listNotes(chartId) {
            const chart = await addenda.findChart(chartId);
            if (!chart) {
                return {ok: false, error: "chart_not_found"};
            }
            return {ok: true, notes: await addenda.listNotes(chartId)};
        },
    };
}