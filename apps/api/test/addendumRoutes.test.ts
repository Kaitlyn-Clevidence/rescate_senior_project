// Author(s): Isabel Sullivan
// Start date: 2026-11-23
// Last updated: 2026-11-23
// P5: MVP
// Purpose: tests the append-to-chart note routes with a fake AddendumService,
// checking status codes, error codes and input checking

import {afterEach, beforeEach, describe, it, expect} from "vitest";
import {buildApp, type Repositories} from "../src/http/app.js";
import type { AddendumService, AddNoteResult, ListNotesResult, NoteRequest } from "../src/services/AddendumService.js";

// No chart and patient routes are returned here, so return nothing
const repositories: Repositories = {
    charts: {
        listCharts: async ()=> [],
        getChartById: async () => undefined,
        listChartsByPatientId: async() => []
    },
    patients: {getPatientById: async ()=> undefined}
};

function makeAddenda() {
    const calls = {
        added: [] as {chartId: number; userId: number | null; request: NoteRequest}[],
        listed: [] as number[]
    };
    let addResult: AddNoteResult = {ok: true, noteId: 9};
    let listResult: ListNotesResult = {ok: true, notes: []};

    const addendum: AddendumService = {
        addNote: async (chartId, userId, request)=> {
            calls.added.push({chartId, userId, request});
            return addResult;
        },
        listNotes: async(chartId)=> {
            calls.listed.push(chartId);
            return listResult;
        }
    };
    return {
        addendum, calls, setAddResult: (r: AddNoteResult) => (addResult = r), setListResult: (r: ListNotesResult) => (listResult = r)
    };
}

let app: ReturnType<typeof buildApp>;
let fake: ReturnType<typeof makeAddenda>;

afterEach(async() => {
    await app.close();
});

beforeEach(() => {
    fake = makeAddenda();
    app = buildApp(repositories, {addenda: fake.addendum});
});

const note = { note: "Patient called back, pain improved", reason: "Follow-up"};

describe("POST /charts/:id/notes", ()=> {
    it("returns 201 with the new note's id", async()=>{
        const res = await app.inject({method: "POST", url: "/charts/1/notes", payload: note});

        expect(res.statusCode).toBe(201);
        expect(res.json()).toEqual({note_id: 9});
        expect(fake.calls.added[0]).toEqual({chartId: 1, userId: null, request: note});
    });

    it("returns 404 when the chart doesn't exist", async()=>{
        fake.setAddResult({ok: false, error: "chart_not_found"});

        const res = await app.inject({method: "POST", url: "/charts/99/notes", payload: note});
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({error: "chart_not_found"});
    });

    it("returns 409 when the chart is not submitted", async()=> {
        fake.setAddResult({ok: false, error: "chart_not_submitted"});
        const res = await app.inject({method: "POST", url:"/charts/2/notes", payload: note});

        expect(res.statusCode).toBe(409);
        expect(res.json()).toEqual({error: "chart_not_submitted"});
    });

    it.each([
        ["a missing note", { reason: "Follow-up" }],
        ["a missing reason", { note: "Called family" }],
        ["an empty note", { ...note, note: "" }],
        ["a note of only spaces", { ...note, note: "  " }],
        ["a reason of only spaces", { ...note, reason: "  " }],
        ["a note over 5000 characters", { ...note, note: "a".repeat(5001) }],
        ["a reason over 255 characters", { ...note, reason: "a".repeat(256) }],
    ])("returns 400 for %s without calling the service", async (_label, payload) => {
        
    const res = await app.inject({ method: "POST", url: "/charts/1/notes", payload });
    expect (res.statusCode).toBe(400);
    expect(fake.calls.added).toHaveLength(0);
    });

    it.each(["0","abc"])("returns 400 for chart id %s", async(id)=>{
        const res = await app.inject({method: "POST", url: `/charts/${id}/notes`, payload: note});

        expect (res.statusCode).toBe(400);
        expect(fake.calls.added).toHaveLength(0);
    });
});

describe("GET /charts/:id/notes", () => {
    it("returns the chart's notes", async()=> {
        fake.setListResult({ok: true,
            notes: [{
                note_id: 5,
                chart_id: 1,
                user_id: null,
                note: "Called family",
                reason: "Follow-up",
                date_added: new Date("2026-11-22T09:00:00.000Z")
            }],
        });
        const res = await app.inject({method: "GET", url: "/charts/1/notes"});
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual([{
            note_id: 5,
            chart_id: 1,
            user_id: null,
            note: "Called family",
            reason: "Follow-up",
            date_added: "2026-11-22T09:00:00.000Z"
        }]);
        expect(fake.calls.listed).toEqual([1]);
    });

    it("returns 404 when a chart does not exist", async()=> {
        fake.setListResult({ok: false, error: "chart_not_found"});
        const res = await app.inject({method: "GET", url: "/charts/99/notes"});

        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({error: "chart_not_found"});
    });
});

describe("without an addendum service", ()=> {
    it("does not add the note routes", async()=>{
        const simple = buildApp(repositories);
        const res = await simple.inject({method: "POST", url: "/charts/1/notes", payload: note});

        expect(res.statusCode).toBe(404);
        await simple.close();
    });
});


