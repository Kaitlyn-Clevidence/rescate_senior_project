-- Author(s): Isabel Sullivan
-- Start date: 2026-11-24
-- Last updated: 2026-11-24
-- P5: MVP
-- Purpose: records when and how big each attachment upload was, and the
-- file's original name, for appending attachments to a chart
-- Requires 0001, 0002, 0003 and 0005 migrations on DB

-- time_captured (0002) is when the photo was taken, which the device may not know;
-- uploaded_at is when it was added to the chart, for the audit trail
ALTER TABLE attachments
    ADD COLUMN original_name VARCHAR(255) NULL AFTER file_type,
    ADD COLUMN size_bytes INT UNSIGNED NULL AFTER original_name,
    ADD COLUMN uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER uploaded_by;