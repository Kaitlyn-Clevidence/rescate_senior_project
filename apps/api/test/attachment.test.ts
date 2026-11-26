// Author(s): Isabel Sullivan
// Start date: 2026-11-24
// Last updated: 2026-11-24
// P5: MVP
// Purpose: tests file type detection, AttachmentService rules with fakes,
// and local file storage in a temporary folder

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AttachmentRepository, NewAttachment, StoredAttachment } from "../src/repositories/AttachmentRepository.js";
import { createAttachmentService, detectFileType } from "../src/services/AttachmentService.js";
import { createLocalStorage, type StorageService } from "../src/services/StorageService.js";

// The first bytes of a JPEG, padded to look like a real file
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);

function makeService(options: {failInsert?: boolean} = {}){
    const files = new Map<string, Buffer>();
    const rows: NewAttachment[]=[];
    const chartRows = new Map<number, {submitted_at: Date | null }>([
        [1, {submitted_at: new Date("2026-11-22T18:00:00Z")}],
        [2, {submitted_at: null}]
    ]);

    const repository: AttachmentRepository = {
        add: async (row) => {
            if(options.failInsert){
                throw new Error("database unavailable");
            }
            rows.push(row);
            },
            listByChart: async ()=>[],
            findByUuid: async (uuid) => {
                const row = rows.find((r)=>r.attachment_uuid===uuid);
                return row ? ({...row, uploaded_at: new Date()} as StoredAttachment): undefined;
            }
        }

    const storage: StorageService = {
        save: async (key, data) => void files.set(key,data),
        read: async (key) => files.get(key)!,
        remove: async (key) => void files.delete(key),
        };
        const charts = {findChart: async(chartId: number)=>chartRows.get(chartId)};
        return {service: createAttachmentService(charts, repository, storage), files, rows};
}

const upload = {data: JPEG, originalName: "wound.jpg", timeCaptured: null};
describe ("AttachmentService", ()=> {
    it("saves the file and its details for a submitted chart", async()=> {
        const {service, files, rows} = makeService();
        const result = await service.upload(1, null, upload);

        expect(result).toMatchObject({ok: true, attachment: {file_type: "image/jpeg", size_bytes: JPEG.length}});
        expect(rows[0]).toMatchObject({chart_id: 1, original_name: "wound.jpg", file_type: "image/jpeg"});
        expect(files.get(rows[0].storage_key)).toEqual(JPEG);
    });

    it.each([
        ["a chart that isnt submitted", 2, upload, "chart_not_submitted"],
        ["a file that isn't a photo or PDF", 1, {...upload, data: Buffer.from("MZ program")}, "unsupported_file_type"],
        ["an empty file", 1, {...upload, data: Buffer.alloc(0)}, "empty_file"]
    ])("refuses %s and saves nothing", async (_label, chartId, request, error) => {
        const {service, files} = makeService();

        expect(await service.upload(chartId, null, request)).toEqual({ok: false, error});
        expect(files.size).toBe(0);
    });

    it("deletes the saved file if it fails to insert into the database", async()=> {
        const {service, files} = makeService({failInsert: true});

        await expect(service.upload(1,null, upload)).rejects.toThrow("database unavailable");
        expect(files.size).toBe(0);
    });

    it("sends back an uploaded file, and reports one that does not exist", async()=>{
        const {service} = makeService();
        const uploaded = await service.upload(1, null, upload);
        const uuid = uploaded.ok ? uploaded.attachment.attachment_uuid : "";

        expect(await service.download(uuid)).toMatchObject({ok: true, data: JPEG, fileType: "image/jpeg"});
        expect(await service.download("00000000-0000-4000-8000-000000000000")).toEqual({ok: false, error: "attachment_not_found"});
    });

    it("lists a charts attachments and reports a chart that does not exist", async() => {
        const {service} = makeService();

        expect(await service.list(1)).toEqual({ok: true, attachments: []});
        expect(await service.list(99)).toEqual({ok: false, error: "chart_not_found"});
    })
});

describe("detectFileType", () => {
    it("recognizes a JPEG and a PDF", () => {
        expect(detectFileType(JPEG)).toEqual({ mime: "image/jpeg", extension: "jpg" });
        expect(detectFileType(Buffer.from("%PDF-1.7"))).toEqual({ mime: "application/pdf", extension: "pdf" });
    });

    it("refuses a file that isn't a photo or PDF", () => {
        expect(detectFileType(Buffer.from("MZ program"))).toBeUndefined();
    });
});

describe("local storage", ()=> {
    it("saves, reads and removes a file, and refuses a key from outside the folder", async()=> {
        const key = "0b9e3c51-2f4a-4c8e-9d7b-1a2b3c4d5e6f.jpg";
        const folder = await mkdtemp(join(tmpdir(), "rescate-test-"));
        const storage = createLocalStorage(folder);
        await storage.save(key, JPEG);

        expect(await storage.read(key)).toEqual(JPEG);
        await storage.remove(key);
        await expect(storage.read("../.env")).rejects.toThrow("Invalid storage key");
        await rm(folder, {recursive: true, force: true});
    });
});

