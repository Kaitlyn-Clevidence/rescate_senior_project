// Author(s): Kaitlyn Clevidence
// Started: 11-24-2026
// P5: MVP
// Purpose: data layer repository for audit_log (FR11): who did what, when, and
// from where. Insert and read only. There is no update or delete, and the
// app's MySQL user should be granted INSERT and SELECT on this table and
// nothing more. Reading is for admins only; that is checked in the service.
// To write an audit row inside a transaction, use insertAuditEvent directly.

import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { insertAuditEvent, type AuditEvent } from "./auditWriter.js";

export type { AuditEvent } from "./auditWriter.js";

export interface AuditEntry {
  audit_id: number;
  user_id: number | null;
  user_name: string | null; 
  action: string;
  entity: string | null;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: unknown; 
  created_at: Date;
}

export interface AuditFilters {
  user_id?: number;
  action?: string;
  entity?: string;
  entity_id?: string | number;
  from?: Date; 
  to?: Date; 
}

export interface AuditPage {
  limit?: number; 
  offset?: number; 
}

export interface AuditRepository {
  record(event: AuditEvent): Promise<void>;
  // Newest first, with the user's name joined in.
  query(filters?: AuditFilters, page?: AuditPage): Promise<AuditEntry[]>;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function createAuditRepository(db: Kysely<Database>): AuditRepository {
  return {
    record: (event) => insertAuditEvent(db, event),

    query: (filters = {}, page = {}) => {
      // Cap the page size and keep it a whole number, so a huge or odd value
      // from a caller cannot ask for the whole table.
      const limit = Math.min(Math.max(Math.floor(page.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
      const offset = Math.max(Math.floor(page.offset ?? 0), 0);

      let query = db
        .selectFrom("audit_log")
        .leftJoin("users", "users.user_id", "audit_log.user_id")
        .select([
          "audit_log.audit_id",
          "audit_log.user_id",
          "users.name as user_name",
          "audit_log.action",
          "audit_log.entity",
          "audit_log.entity_id",
          "audit_log.ip_address",
          "audit_log.user_agent",
          "audit_log.details",
          "audit_log.created_at",
        ]);

      if (filters.user_id !== undefined) {
        query = query.where("audit_log.user_id", "=", filters.user_id);
      }
      if (filters.action !== undefined) {
        query = query.where("audit_log.action", "=", filters.action);
      }
      if (filters.entity !== undefined) {
        query = query.where("audit_log.entity", "=", filters.entity);
      }
      if (filters.entity_id !== undefined) {
        query = query.where("audit_log.entity_id", "=", String(filters.entity_id));
      }
      if (filters.from !== undefined) {
        query = query.where("audit_log.created_at", ">=", filters.from);
      }
      if (filters.to !== undefined) {
        query = query.where("audit_log.created_at", "<", filters.to);
      }

      return query
        .orderBy("audit_log.created_at", "desc")
        .orderBy("audit_log.audit_id", "desc")
        .limit(limit)
        .offset(offset)
        .execute();
    },
  };
}
