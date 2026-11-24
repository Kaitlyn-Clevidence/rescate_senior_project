// Author(s): Kaitlyn Clevidence
// Start date: 2026-11-16
// Last updated: 2026-11-24
// P5: MVP
// Purpose: data layer repository for charts_v1_archive. Before the legacy
// data is converted, an untouched JSON copy of every old row is saved here so
// nothing is lost if the conversion goes wrong (FR10).
// Insert and read only. A row is never updated or deleted, and saving the same
// legacy row twice keeps the first copy, so the migration can be re-run safely.

import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
import { isDuplicateKeyError } from "./helpers.js";

export interface LegacyRecord {
  archive_id: number;
  entity: string; // the legacy table, for example "charts" or "patients"
  legacy_id: number; // the row's id in the legacy database
  raw_row: unknown; // the original row, exactly as it was read
  archived_at: Date;
}

export interface EntityCount {
  entity: string;
  count: number;
}

export interface LegacyArchiveRepository {
  // Returns true when the row was saved, false when this (entity, legacy id)
  // was already archived. An existing copy is never overwritten.
  insertRaw(entity: string, legacyId: number, rawRow: unknown): Promise<boolean>;
  findByLegacyId(entity: string, legacyId: number): Promise<LegacyRecord | undefined>;
  // For the migration's count check: how many rows are archived per entity.
  countByEntity(): Promise<EntityCount[]>;
}

const ARCHIVE_COLUMNS = [
  "archive_id", "entity", "legacy_id", "raw_row", "archived_at",
] as const;

export function createLegacyArchiveRepository(
  db: Kysely<Database>
): LegacyArchiveRepository {
  return {
    insertRaw: async (entity, legacyId, rawRow) => {
      if (entity.trim() === "") {
        throw new Error("LegacyArchiveRepository.insertRaw: entity is required");
      }
      if (!Number.isInteger(legacyId) || legacyId < 1) {
        throw new Error("LegacyArchiveRepository.insertRaw: legacyId must be a positive integer");
      }
      // The raw_row column is JSON. mysql2 does not convert an object for us,
      // and JSON.stringify returns undefined for things JSON cannot hold.
      const json = JSON.stringify(rawRow);
      if (json === undefined) {
        throw new Error("LegacyArchiveRepository.insertRaw: rawRow cannot be stored as JSON");
      }

      try {
        await db
          .insertInto("charts_v1_archive")
          .values({ entity, legacy_id: legacyId, raw_row: json })
          .execute();
        return true;
      } catch (error) {
        if (isDuplicateKeyError(error)) return false;
        throw error;
      }
    },

    findByLegacyId: (entity, legacyId) =>
      db
        .selectFrom("charts_v1_archive")
        .select(ARCHIVE_COLUMNS)
        .where("entity", "=", entity)
        .where("legacy_id", "=", legacyId)
        .executeTakeFirst(),

    countByEntity: async () => {
      const rows = await db
        .selectFrom("charts_v1_archive")
        .select((eb) => ["entity", eb.fn.countAll<string>().as("count")])
        .groupBy("entity")
        .orderBy("entity")
        .execute();
      // MySQL returns counts as strings
      return rows.map((r) => ({ entity: r.entity, count: Number(r.count) }));
    },
  };
}
