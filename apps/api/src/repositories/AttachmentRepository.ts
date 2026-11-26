// Author(s): Isabel Sullivan
// Start date: 2026-11-23
// Last updated: 2026-11-23
// P5: MVP
// Purpose: data layer repository for the attachments table. it saves and finds
// the details of photos and files appended to a chart (the files themselves
// are kept by StorageService)

import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";

// What the app gets back about an attachment. File is never stored here
export interface Attachment {
    attachment_uuid: string;
    chart_id: number;
    file_type: string | null;
    original_name: string | null;
    size_bytes: number | null;
    uploaded_by: number | null;
    time_captured: Date | null;
    uploaded_at: Date;
}

//Used to sned the file back, and includes where its stored
export interface StoredAttachment extends Attachment {
    storage_key: string;
}

export interface NewAttachment {
    attachment_uuid: string;
    chart_id: number;
    storage_key: string;
    file_type: string;
    original_name: string | null;
    size_bytes: number;
    uploaded_by: number | null; // null until login exists
    time_captured: Date | null;
}


export interface AttachmentRepository {
    findByUuid(uuid: string): Promise<StoredAttachment | undefined>;
    add(attachment: NewAttachment): Promise<void>;
    listByChart(chartId: number): Promise<Attachment[]>;
}

const PUBLIC_COLUMNS = ["attachment_uuid", "chart_id", "file_type", "original_name", "size_bytes", "uploaded_by", "time_captured", "uploaded_at"] as const;

export function createAttachmentRepository(db: Kysely<Database>): AttachmentRepository {
    return {
        async add(attachment) {
            await db.insertInto("attachments").values(attachment).executeTakeFirstOrThrow();
        },

        listByChart: (chartId)=>
            db
                .selectFrom("attachments")
                .select(PUBLIC_COLUMNS)
                .where("chart_id", "=", chartId)
                .orderBy("uploaded_at", "asc")
                .orderBy("attachment_id", "asc")
                .execute(),

        findByUuid: (uuid) =>
            db
                .selectFrom("attachments")
                .select([...PUBLIC_COLUMNS, "storage_key"])
                .where("attachment_uuid", "=", uuid)
                .executeTakeFirstOrThrow(),
    };
}