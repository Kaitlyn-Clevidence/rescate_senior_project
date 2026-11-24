// Author(s): Isabel Sullivan
// Start date: 2026-11-21
// Last updated: 2026-11-21
// P5: MVP
// Purpose: HTTP routes for appending to a chart. POST adds a note to a
// submitted chart, GET lists a chart's notes

import type { FastifyInstance } from "fastify";
import type { AddendumService, NoteRequest } from "../../services/AddendumService.js";

const chartIdParams = {
    type: "object",
    required: ["id"],
    properties: {id: {type: "integer", minimum: 1}},
} as const;

const noteSchema = {
    params: chartIdParams,
    body: {
        type: "object",
        required: ["note", "reason"],
        properties: {
            note: {type: "string", minLength: 1, maxLength: 5000, pattern: "\\S"},
            reason: {type: "string", minLength: 1, maxLength: 255, pattern: "\\S"},
        },
    },
} as const;

//Add a note
export function registerAddendumRoutes(app: FastifyInstance, addenda: AddendumService) {
    app.post<{ Params: { id: number }; Body: NoteRequest }>(
        "/charts/:id/notes",
        { schema: noteSchema },
        async (request, reply) => {
            // TODO: once login exists, pass the logged-in user's user_id instead of null
            const result = await addenda.addNote(request.params.id, null, request.body);

            if (!result.ok) {
                const status = result.error === "chart_not_found" ? 404 : 409;
                return reply.code(status).send({ error: result.error });
            }
            return reply.code(201).send({ note_id: result.noteId });
        }
    );

    // List a chart's notes, oldest first
    app.get<{ Params: { id: number } }>(
        "/charts/:id/notes",
        { schema: { params: chartIdParams } },
        async (request, reply) => {
            const result = await addenda.listNotes(request.params.id);

            if (!result.ok) return reply.code(404).send({ error: result.error });
            return result.notes;
        }
    );
}