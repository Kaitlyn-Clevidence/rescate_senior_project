// Author(s): Isabel Sullivan
// Start date: 2026-11-24
// Last updated: 2026-11-24
// P5: MVP
// Purpose: tests the attachment routes with a fake AttachmentService, sending
// real multipart uploads and checking status codes, error codes and headers

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, type Repositories } from "../src/http/app.js";
import type { AttachmentService, DownloadResult, UploadResult } from "../src/services/AttachmentService.js";

const repositories: Repositories = {
    charts: {listCharts: async () => [], getChartById: async () => undefined, listChartsByPatientId: async () => []},
    patients: { getPatientById: async () => undefined },
};

const UUID = "0b9e3c51-2f4a-4c8e-9d7b-1a2b3c4d5e6f";
const photo = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

// Fake AttachmentService that returns whatever result a test chooses
let uploadResult: UploadResult;
let downloadResult: DownloadResult;

const attachments: AttachmentService = {
    upload: async () => uploadResult,
    list: async (chartId) => (chartId === 1 ? { ok: true, attachments: [] } : { ok: false, error: "chart_not_found" }),
    download: async () => downloadResult,
};

function fileUpload(data: Buffer) {
    const boundary = "----rescateTestBoundary";
    return {
        payload: Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="wound.jpg"\r\n\r\n`),
            data,
            Buffer.from(`\r\n--${boundary}--\r\n`),
        ]),
        headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    };
}

let app: ReturnType<typeof buildApp>;
beforeEach(()=>{
    uploadResult = {ok: true, attachment: {attachment_uuid: UUID, file_type: "image/jpeg", size_bytes: 4}};
    downloadResult = {ok: false, error: "attachment_not_found"};
    app = buildApp(repositories, {attachments});
});

afterEach(async () => {
    await app.close();
});

describe("attachment routes", () => {
    it("returns 201 for an upload", async() => {
        const res = await app.inject({method: "POST", url: "/charts/1/attachments", ...fileUpload(photo)});
        
        expect(res.statusCode).toBe(201);
        expect(res.json()).toEqual({attachment_uuid: UUID, file_type: "image/jpeg", size_bytes: 4 });
    });

    it("returns 409 when the chart has not been submitted", async ()=> {
        uploadResult = {ok: false, error: "chart_not_submitted"};
        const res = await app.inject({method: "POST", url: "/charts/1/attachments", ...fileUpload(photo)});

        expect (res.statusCode).toBe(409);
    });

    it("returns 413 for a file over 10MB", async()=> {
        const big = Buffer.alloc(1024*1024*10+1);
        const res = await app.inject({method: "POST", url: "/charts/1/attachments",...fileUpload(big)});

        expect (res.statusCode).toBe(413);
    });

    it("lists a charts attachments, or returns 404 for a missing chart", async()=> {
        expect((await app.inject({method: "GET", url: "/charts/1/attachments"})).statusCode).toBe(200);
        expect((await app.inject({method: "GET", url: "/charts/99/attachments"})).statusCode).toBe(404);
    });

    it("sends a file with its type or returns 404 if it doesn't exist", async()=> {
        expect((await app.inject({method: "GET", url: `/attachments/${UUID}`})).statusCode).toBe(404);

        downloadResult = {ok: true, data: photo, fileType: "image/jpeg", fileName: `${UUID}.jpg`};
        const res = await app.inject({method: "GET", url: `/attachments/${UUID}`});

        expect (res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toBe("image/jpeg");
        expect(res.rawPayload).toEqual(photo);
    });
});

