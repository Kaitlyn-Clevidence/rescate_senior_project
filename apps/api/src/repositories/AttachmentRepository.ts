// Author(s): Kaitlyn Clevidence
// Start date: 2026-11-16
// Last updated: 2026-11-24
// P5: MVP
// Purpose: data layer repository for the attachments table (signatures,
// photos). It stores and reads metadata only; the file itself is in file
// storage. Insert and read only: there is no update or delete, because an
// attachment belongs to a submitted chart (FR12). Who may download a file is
// decided in the service, not here.

import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { insertAttachment, type NewAttachment } from "./attachmentWriter.js";

export type { NewAttachment } from "./attachmentWriter.js";

export interface Attachment {
  attachment_id: number;
  attachment_uuid: string;
  chart_id: number;
  storage_key: string;
  file_type: string | null;
  uploaded_by: number | null;
  time_captured: Date | null;
}

export interface AttachmentRepository {
  insert(attachment: NewAttachment): Promise<Attachment>;
  // The uuid is the public identifier, so routes use it instead of the id.
  findByUuid(attachmentUuid: string): Promise<Attachment | undefined>;
  listByChart(chartId: number): Promise<Attachment[]>;
}

const ATTACHMENT_COLUMNS = [
  "attachment_id", "attachment_uuid", "chart_id", "storage_key",
  "file_type", "uploaded_by", "time_captured",
] as const;

export function createAttachmentRepository(
  db: Kysely<Database>
): AttachmentRepository {
  return {
    insert: async (attachment) => {
      const { attachment_id } = await insertAttachment(db, attachment);
      return db
        .selectFrom("attachments")
        .select(ATTACHMENT_COLUMNS)
        .where("attachment_id", "=", attachment_id)
        .executeTakeFirstOrThrow();
    },

    findByUuid: (attachmentUuid) =>
      db
        .selectFrom("attachments")
        .select(ATTACHMENT_COLUMNS)
        .where("attachment_uuid", "=", attachmentUuid)
        .executeTakeFirst(),

    listByChart: (chartId) =>
      db
        .selectFrom("attachments")
        .select(ATTACHMENT_COLUMNS)
        .where("chart_id", "=", chartId)
        .orderBy("attachment_id")
        .execute(),
  };
}
