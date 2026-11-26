// Author(s): Isabel Sullivan
// Start date: 2026-11-24
// Last updated: 2026-11-24
// P5: MVP
// Purpose: HTTP routes for appending photos and files to a chart. upload to a
// submitted chart, list a chart's attachments, and download one file

import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { MAX_ATTACHMENT_BYTES, type AttachmentService, type UploadResult } from "../../services/AttachmentService.js";

const chartIdParams = {type: "object", required: ["id"], properties: {id: { type: "integer", minimum:1 }}
} as const;

const uuidParams = {type: "object", required: ["uuid"],
    properties: { uuid: { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" } },
} as const;

const uploadQuery = {type: "object", properties: {time_captured: {type: "string", format: "date-time"}}
} as const;

type UploadError = Extract<UploadResult, {ok: false} > ["error"];

const UPLOAD_STATUS: Record<UploadError, number> = {
    chart_not_found: 404,
    empty_file: 400,
    file_too_large: 413,
    chart_not_submitted: 409,
    unsupported_file_type: 415
};

export function registerAttachmentRoutes(app: FastifyInstance, attachments: AttachmentService){
    app.register(async (scope)=> {
        await scope.register(multipart, {limits: {fileSize: MAX_ATTACHMENT_BYTES, files:1, fields: 0}});

        scope.post<{Params: {id: number}; Querystring: {time_captured?:string}}>(
            "/charts/:id/attachments", {schema: {params: chartIdParams, querystring: uploadQuery}},
            async (request, reply) => {
                const file = await request.file();
                if(!file) {
                    return reply.code(400).send({error: "missing_file"});
                }
                let data:Buffer;
                try {
                    data = await file.toBuffer();
                } catch (error) {
                    if((error as {code?: string}).code === "FST_REQ_FILE_TOO_LARGE"){
                        return reply.code(413).send({error: "file_too_large"});
                    }
                    throw error;
                }

                const timeCaptured = request.query.time_captured ? new Date(request.query.time_captured):null;
                //When login exists, pass logged in users id instead of null
                const result = await attachments.upload(request.params.id, null, {data, originalName: file.filename || null, timeCaptured});
                if(!result.ok){
                    return reply.code(UPLOAD_STATUS[result.error]).send({error: result.error});
                }
                return reply.code(201).send(result.attachment);
            });
    });

    // List a chart's attachments, oldest first (details only, not the files)
    app.get<{ Params: { id: number } }>("/charts/:id/attachments", { schema: { params: chartIdParams } },
        async (request, reply) => {
            const result = await attachments.list(request.params.id);
            if (!result.ok){
                 return reply.code(404).send({ error: result.error });
            }
            return result.attachments;
        });

        // Send one attachment's file
    // TODO: once login exists, only logged-in users may download (these are patient photos)
    app.get<{ Params: { uuid: string } }>("/attachments/:uuid", { schema: { params: uuidParams } },
        async (request, reply) => {
            const result = await attachments.download(request.params.uuid);
            if (!result.ok) {
                return reply.code(404).send({ error: result.error });
            }
            return reply
                .header("Content-Type", result.fileType)
                .header("Content-Disposition", `inline; filename="${result.fileName}"`)
                .header("X-Content-Type-Options", "nosniff")
                .header("Cache-Control", "no-store")
                .send(result.data);
        });
}



