-- Author(s): Isabel Sullivan
-- Start date: 2026-11-09
-- Last updated: 2026-11-09
-- P5: MVP
-- Purpose: Adds the rest of the patient and chart
-- table information that was not needed for the prototype
-- Requires 0001 and 0002 migrations on DB


-- Unconcious patients or children often have no phone, email, or do not know their address
ALTER TABLE patients
    MODIFY phone VARCHAR(15) NULL,
    MODIFY email VARCHAR(100) NULL,
    MODIFY home_address VARCHAR(255) NULL;

-- Trauma cause chosen for chart from dropdown (using lookup table)
-- plus who created the chart and when, for the audit log
ALTER TABLE charts
    ADD COLUMN trauma_cause_id INT UNSIGNED NULL AFTER patient_id,
    ADD COLUMN created_by INT UNSIGNED NULL AFTER trauma_cause_id,
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN submitted_at DATETIME NULL,
    ADD CONSTRAINT fk_charts_trauma_cause
        FOREIGN KEY (trauma_cause_id) REFERENCES trauma_causes(trauma_cause_id),
    ADD CONSTRAINT fk_charts_created_by
        FOREIGN KEY (created_by) REFERENCES users(user_id);
