// Author(s): Isabel Sullivan
// Start date: 2026-11-23
// Last updated: 2026-11-23
// P5: MVP
// Purpose: tests AddendumService rules with a fake repository and
// AddendumRepository's SQL with a fake database (append to chart)

import {
    DummyDriver,
    Kysely,
    MysqlAdapter,
    MysqlIntrospector,
    MysqlQueryCompiler,
    type CompiledQuery
} from "kysely";

import {describe, expect, it} from "vitest";
import type { Database } from  "../src/db/types.js";
import {
    createAddendumRepository,
    type AddendumRepository,
    type NewNote,
    type Note,
} from "../src/repositories/AddendumRepository.js";

import { createAddendumService } from "../src/services/AddendumService.js";

//Fake repository: chart 1 is submitted, chart 2 is a draft
function makeRepository() {
    const saved: NewNote[]=[];
    const charts = new Map<number, {submitted_at: Date | null}>([
        [1, {submitted_at: new Date("2026-11-20T18:00:00Z")}],
        [2, {submitted_at: null}]
    ]);

    const existingNote: Note = {note_id: 5, chart_id: 1, user_id: null, note: "Patient called back, pain improved", 
        reason: "Follow-up", date_added: new Date("2026-11-21T09:00:00Z"),
    };

    const repository: AddendumRepository = {
        findChart: async (chartId)=> charts.get(chartId),
        addNote: async (note) => {
            saved.push(note);
            return 9;
        },
        listNotes: async (chartId) => (chartId === 1 ? [existingNote] : []),
    };
    return {repository, saved, existingNote};
}

function makeDb(){
    const queries: CompiledQuery[] = [];
    const db = new Kysely<Database>({
        dialect: {
            createAdapter: () => new MysqlAdapter(),
            createDriver: () => new DummyDriver(),
            createIntrospector: (kysely) => new MysqlIntrospector(kysely),
            createQueryCompiler: () => new MysqlQueryCompiler()
    },
    log: (event) => {
        if(event.level === "query"){
            queries.push(event.query);
        }
    }
    });
    return {db, queries};
}

describe("AddendumService.addNote", () => {
    it("adds a note to a submitted chart", async()=> {
        const {repository, saved} = makeRepository();
        const result = await createAddendumService(repository).addNote(1, null, {note: "Wound image reviewed", reason: "Late documentation"});

        expect(result).toEqual({ok: true, noteId: 9});
        expect(saved).toEqual([
            {chart_id: 1, user_id: null, note: "Wound image reviewed", reason: "Late documentation"}
        ]);
    });

    it("trims spaces around the note and reason", async()=> {
        const {repository, saved} = makeRepository();
        await createAddendumService(repository).addNote(1,3,{note: " Family were called ", reason: " Follow-up\n"});

        expect(saved[0]).toEqual({chart_id: 1, user_id: 3, note: "Family were called", reason: "Follow-up"});
    });

    it("refuses a chart that has not been submitted", async() => {
        const {repository, saved} = makeRepository();
        const result = await createAddendumService(repository).addNote(2, null, {note: "x", reason: "y"});
        
        expect(result).toEqual({ok: false, error: "chart_not_submitted"});
        expect(saved).toHaveLength(0);
    });

    it("refuses a chart that does not exist", async()=> {
        const {repository, saved} = makeRepository();
        const result = await createAddendumService(repository).addNote(99, null, {note: "x", reason: "y"});

        expect(result).toEqual({ok: false, error: "chart_not_found"});
        expect(saved).toHaveLength(0);
    });
});

describe("AddendumRepository SQL", ()=> {
    it("checks a charts submitted_at with the id as a parameter", async()=> {
        const {db, queries} = makeDb();
        await createAddendumRepository(db).findChart(4);

        expect(queries[0].sql).toBe("select `submitted_at` from `charts` where `chart_id` = ?");
        expect(queries[0].parameters).toEqual([4]);
    });

    it("lists a chart's notes starting with oldest first", async()=> {
        const {db, queries} = makeDb();
        await createAddendumRepository(db).listNotes(4);

        expect(queries[0].sql).toContain("from `notes` where `chart_id` = ?");
        expect(queries[0].sql).toContain("order by `date_added` asc, `note_id` asc");
        expect(queries[0].parameters).toEqual([4]);
    });

    it("passes note text as a parameter, never inside the SQL", async() => {
        const {db, queries} = makeDb();
        const injection = "'); DROP TABLE notes; --";

        await createAddendumRepository(db)
            .addNote({chart_id: 4, user_id: null, note: injection, reason: "test"})
            .catch(() => undefined);

            expect(queries[0].sql).toBe("insert into `notes` (`chart_id`, `user_id`, `note`, `reason`) values (?, ?, ?, ?)");
            expect(queries[0].parameters).toEqual([4, null, injection, "test"]);
    });
});

describe("AddendumService.listNotes", () => {
    it("lists a chart's notes", async () => {
        const { repository, existingNote } = makeRepository();

        expect(await createAddendumService(repository).listNotes(1)).toEqual({ ok: true, notes: [existingNote] });
    });

    it("lists notes on a draft chart too (it just has none yet)", async () => {
        const { repository } = makeRepository();

        expect(await createAddendumService(repository).listNotes(2)).toEqual({ ok: true, notes: [] });
    });

    it("reports a chart that does not exist", async () => {
        const { repository } = makeRepository();

        expect(await createAddendumService(repository).listNotes(99)).toEqual({ok: false, error: "chart_not_found",});
    });
});