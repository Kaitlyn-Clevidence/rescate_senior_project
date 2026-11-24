// Author(s): Kaitlyn Clevidence
// Started: 11-24-2026
// P5: MVP
// Purpose: the one place an audit_log row is inserted. Takes any Kysely handle,
// so a service can write the audit row inside the same transaction as the
// action it records (a chart submit, for example), and the two succeed or fail
// together.

import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";

// Column limits in audit_log (migration 0006).
const MAX_ACTION = 50;
const MAX_ENTITY = 50;
const MAX_ENTITY_ID = 50;
const MAX_IP = 45; // long enough for an IPv6 address
const MAX_USER_AGENT = 255;

export interface AuditEvent {
  user_id?: number | null; // NULL when nobody is logged in (a failed login)
  action: string; // a short code, for example "chart.submit" or "auth.login_failed"
  entity?: string; // what was touched, for example "chart"
  entity_id?: string | number; // which one (the chart uuid, a user id)
  ip_address?: string;
  user_agent?: string;
  // Extra facts as JSON. NEVER put patient information here (names, birth
  // dates, chart contents): the log is read by admins and kept for years.
  details?: Record<string, unknown>;
}

export async function insertAuditEvent(
  db: Kysely<Database>,
  event: AuditEvent
): Promise<void> {
  // The action and entity are written by our own code, so a bad one is a bug.
  if (event.action.trim() === "") {
    throw new Error("insertAuditEvent: action is required");
  }
  if (event.action.length > MAX_ACTION) {
    throw new Error(`insertAuditEvent: action is longer than ${MAX_ACTION} characters`);
  }
  if (event.entity !== undefined && event.entity.length > MAX_ENTITY) {
    throw new Error(`insertAuditEvent: entity is longer than ${MAX_ENTITY} characters`);
  }
  const entityId = event.entity_id === undefined ? null : String(event.entity_id);
  if (entityId !== null && entityId.length > MAX_ENTITY_ID) {
    throw new Error(`insertAuditEvent: entity_id is longer than ${MAX_ENTITY_ID} characters`);
  }

  await db
    .insertInto("audit_log")
    .values({
      user_id: event.user_id ?? null,
      action: event.action,
      entity: event.entity ?? null,
      entity_id: entityId,
      // These two come from the client, so cut them to fit instead of failing
      // and losing the audit row.
      ip_address: event.ip_address?.slice(0, MAX_IP) ?? null,
      user_agent: event.user_agent?.slice(0, MAX_USER_AGENT) ?? null,
      // JSON column: mysql2 does not convert an object for us.
      details: event.details === undefined ? null : JSON.stringify(event.details),
    })
    .execute();
}
