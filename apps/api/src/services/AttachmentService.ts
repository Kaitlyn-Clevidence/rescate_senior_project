// Author(s): Isabel Sullivan
// Start date: 2026-11-24
// Last updated: 2026-11-24
// P5: MVP
// Purpose: rules for appending photos and files to a chart; only to a
// submitted chart, only JPEG, PNG, HEIC or PDF up to 10 MB, and attachments
// are never edited or deleted, only added

import { randomUUID } from "node:crypto";
import type { AddendumRepository } from "../repositories/AddendumRepository.js";
import type { Attachment, AttachmentRepository } from "../repositories/AttachmentRepository.js";
import type { StorageService } from "./StorageService.js";

export const MAX_ATTACHMENT_BYTES = 1024 * 1024 * 10;

export interface FileType {
    mime: string;
    extension: "jpg" | "png" | "heic" | "pdf";
}

//Determines type from files first bytes, not name. This is so a renamed .exe cant pass as an image
export function detectFileType(data: Buffer): FileType | undefined {
    const startsWith = (bytes: number[], offset = 0) =>
        data.length >= offset + bytes.length && bytes.every((b, i) => data[offset + i] === b);
    if (startsWith([0xff, 0xd8, 0xff])) {
        return { mime: "image/jpeg", extension: "jpg" };
    }

    if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        return { mime: "image/png", extension: "png" };
    }

    if (startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) {
        return { mime: "application/pdf", extension: "pdf" };
    }

    if (startsWith([0x66, 0x74, 0x79, 0x70], 4)) {
        const heifBrand = data.subarray(8, 12).toString("latin1");
        if (["heic", "heix", "mif1"].includes(heifBrand)) {
            return { mime: "image/heic", extension: "heic" };
        }
    }
    return undefined;
}

export interface UploadRequest {
    data: Buffer;
    originalName: string | null;
    timeCaptured: Date | null;
}

export type UploadResult = | { ok: true; attachment: { attachment_uuid: string; file_type: string; size_bytes: number } }
    | { ok: false; error: "chart_not_found" | "chart_not_submitted" | "empty_file" | "file_too_large" | "unsupported_file_type" };

export type ListAttachmentsResult = { ok: true; attachments: Attachment[] } | { ok: false; error: "chart_not_found" };

export type DownloadResult = | { ok: true; data: Buffer; fileType: string; fileName: string }
    | { ok: false; error: "attachment_not_found" };

export interface AttachmentService {
    upload(chartId: number, userId: number | null, request: UploadRequest): Promise<UploadResult>;
    list(chartId: number): Promise<ListAttachmentsResult>;
    download(uuid: string): Promise<DownloadResult>;
}

export function createAttachmentService(charts: Pick<AddendumRepository, "findChart">, attachments: AttachmentRepository, storage: StorageService): AttachmentService {
    return {
        async upload(chartId, userId, request) {
            const chart = await charts.findChart(chartId);

            //Error cases
            if (!chart) {
                return { ok: false, error: "chart_not_found" };
            }
            if (!chart.submitted_at) {
                return { ok: false, error: "chart_not_submitted" };
            }
            if (request.data.length > MAX_ATTACHMENT_BYTES) {
                return { ok: false, error: "file_too_large" };
            }
            if (request.data.length === 0) {
                return { ok: false, error: "empty_file" };
            }

            const type = detectFileType(request.data);
            if (!type) {
                return { ok: false, error: "unsupported_file_type" };
            }

            const uuid = randomUUID();
            const key = `${uuid}.${type.extension}`;

            //Save file first so if insert to db fails, delete file
            //This is so theres no file without a row pointing to it
            await storage.save(key, request.data);
            try {
                await attachments.add({
                    attachment_uuid: uuid,
                    chart_id: chartId,
                    storage_key: key,
                    file_type: type.mime,
                    original_name: request.originalName?.slice(0, 255) || null,
                    size_bytes: request.data.length,
                    uploaded_by: userId,
                    time_captured: request.timeCaptured,
                });
            } catch (error) {
                await storage.remove(key);
                throw error;
            }
            return {
                ok: true, attachment: { attachment_uuid: uuid, file_type: type.mime, size_bytes: request.data.length }
            };
        },

        async list(chartId) {
            const chart = await charts.findChart(chartId);
            if (!chart) {
                return { ok: false, error: "chart_not_found" };
            }
            return { ok: true, attachments: await attachments.listByChart(chartId) };
        },

        async download(uuid) {
            const attachment = await attachments.findByUuid(uuid);
            if (!attachment) {
                return { ok: false, error: "attachment_not_found" };
            }
            const data = await storage.read(attachment.storage_key);
            return { ok: true, data, fileType: attachment.file_type ?? "application/octet-stream", fileName: attachment.storage_key };
        }
    };
}