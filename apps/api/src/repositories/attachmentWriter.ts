// Author(s): Kaitlyn Clevidence
// Started: 11-24-2026
// P5: MVP
// Purpose: the one place an attachment row is inserted. Shared by
// AttachmentRepository.insert and by insertSubmitted (which will save the
// patient and witness signatures inside its transaction).
// Only metadata is stored here. The file itself lives in file storage under
// storage_key (see ADR-007).

import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { insertedId } from "./helpers.js";

export interface NewAttachment {
  chart_id: number;
  storage_key: string; // where the file is kept; never shown to the user
  file_type?: string; // for example "image/png"
  uploaded_by?: number; // user_id
  time_captured?: Date; // when a photo was taken
}

export interface InsertedAttachment {
  attachment_id: number;
  attachment_uuid: string;
}

// Takes any Kysely handle, so it works on its own or inside a transaction.
// The uuid is the public identifier. It is random, so it cannot be guessed
// the way an auto-increment id can.
export async function insertAttachment(
  db: Kysely<Database>,
  attachment: NewAttachment
): Promise<InsertedAttachment> {
  if (attachment.storage_key.trim() === "") {
    throw new Error("insertAttachment: storage_key is required");
  }
  const attachmentUuid = randomUUID();
  const result = await db
    .insertInto("attachments")
    .values({
      attachment_uuid: attachmentUuid,
      chart_id: attachment.chart_id,
      storage_key: attachment.storage_key,
      file_type: attachment.file_type ?? null,
      uploaded_by: attachment.uploaded_by ?? null,
      time_captured: attachment.time_captured ?? null,
    })
    .executeTakeFirstOrThrow();
  return {
    attachment_id: insertedId(result),
    attachment_uuid: attachmentUuid,
  };
}
