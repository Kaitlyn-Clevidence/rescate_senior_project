-- Author(s): Isabel Sullivan
-- Start date: 2026-11-09
-- Last updated: 2026-11-11
-- P5: MVP
-- Purpose: Adds the rest of the patient and chart
-- table information that was not needed for the prototype
-- Requires 0001 and 0002 migrations on DB


-- Unconscious patients or children often have no phone, email, or do not know their address
-- Phone widened for international format (+52), email matches users table
ALTER TABLE patients
    MODIFY phone VARCHAR(50) NULL,
    MODIFY email VARCHAR(255) NULL,
    MODIFY home_address VARCHAR(255) NULL;

-- Trauma cause chosen for chart from dropdown (using lookup table)
-- and who created the chart and when, for audit log
-- chart_uuid for offline sync (will stay nullable until offline sync implemented)
-- needs_review for synced charts
ALTER TABLE charts
    ADD COLUMN chart_uuid CHAR(36) NULL AFTER chart_id,
    ADD COLUMN incident_number VARCHAR(50) NULL AFTER legacy_chart_id,
    ADD COLUMN trauma_cause_id INT UNSIGNED NULL AFTER patient_id,
    ADD COLUMN created_by INT UNSIGNED NULL AFTER trauma_cause_id,
    ADD COLUMN needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN submitted_at DATETIME NULL,
    ADD CONSTRAINT unique_uuid UNIQUE (chart_uuid),
    ADD CONSTRAINT unique_legacy_chart_id UNIQUE (legacy_chart_id),
    ADD CONSTRAINT fk_charts_trauma_cause
        FOREIGN KEY (trauma_cause_id) REFERENCES trauma_causes(trauma_cause_id),
    ADD CONSTRAINT fk_charts_created_by
        FOREIGN KEY (created_by) REFERENCES users(user_id);

-- Ambulance call locations
ALTER TABLE ambulance_calls
    ADD COLUMN incident_location VARCHAR(255) NULL AFTER chart_id,
    ADD COLUMN incident_address VARCHAR(255) NULL AFTER incident_location;
