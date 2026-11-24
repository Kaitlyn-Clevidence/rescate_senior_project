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

// True when MySQL rejected an insert because a UNIQUE key already has that
// value (error 1062). Lets a repository turn "already exists" into a clean
// answer instead of a crash.
export function isDuplicateKeyError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { errno, code } = error as { errno?: unknown; code?: unknown };
  return errno === 1062 || code === "ER_DUP_ENTRY";
}

// Nullable BOOLEAN columns: "not answered" must stay NULL, not become 0 (no).
export function boolToDb(value: boolean | undefined): 0 | 1 | null {
  if (value === undefined) return null;
  return value ? 1 : 0;
}
