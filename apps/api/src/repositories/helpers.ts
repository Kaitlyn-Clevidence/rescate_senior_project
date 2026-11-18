// Author(s): Kaitlyn Clevidence
// Started: 11-16-2026
// P5: MVP
// Purpose: small shared helpers for the chart repository writers

import type { InsertResult } from "kysely";

// mysql2 reports the new auto-increment id as a bigint (or nothing at all if
// the insert did not create a row). Charts will never reach 2^53 ids.
export function insertedId(result: InsertResult): number {
  if (result.insertId === undefined) {
    throw new Error("Insert did not return a new id");
  }
  return Number(result.insertId);
}

// Nullable BOOLEAN columns: "not answered" must stay NULL, not become 0 (no).
export function boolToDb(value: boolean | undefined): 0 | 1 | null {
  if (value === undefined) return null;
  return value ? 1 : 0;
}
