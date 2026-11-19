-- Author(s): Isabel Sullivan
-- Start date: 2026-11-18
-- Last updated: 2026-11-18
-- P5: MVP
-- Purpose: schema changes needed after the call with Bryan
-- Requires 0001, 0002 and 0003 migrations on DB


-- Anonymous patients still need a patient row, but identity fields are optional
ALTER TABLE patients
    MODIFY first_name VARCHAR(100) NULL,
    MODIFY last_name VARCHAR(100) NULL,
    MODIFY gender CHAR(1) NULL;

-- Narrative is the account of the whole encounter from scene to handoff
-- Separate from history_of_present_illness
-- is_practice no longer needed
ALTER TABLE charts
    ADD COLUMN narrative TEXT NULL,
    DROP COLUMN is_practice;

-- Why the addendum was added
ALTER TABLE notes
    ADD COLUMN reason VARCHAR(255) NOT NULL AFTER note;

-- Procedure catalog: searchable list of procedures with english and spanish names
-- New procedures are added as rows
CREATE TABLE IF NOT EXISTS procedure_catalog (
    procedure_code VARCHAR(50) NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    name_es VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (procedure_code),
    FULLTEXT KEY ft_procedure_names (name_en, name_es)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Crew belongs to a chart, not just ambulance calls
ALTER TABLE chart_crew
    DROP FOREIGN KEY chart_crew_ibfk_1;
ALTER TABLE chart_crew
    ADD CONSTRAINT fk_chart_crew_chart
        FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE;

-- when the patient started to be transported, and which doctor took over care
ALTER TABLE transports
    ADD COLUMN in_transport_at DATETIME NULL AFTER destination,
    ADD COLUMN transferred_to_doctor VARCHAR(100) NULL AFTER transfer_of_care_at;

-- Add infusion columns
ALTER TABLE medications_given
    ADD COLUMN is_infusion BOOLEAN NOT NULL DEFAULT FALSE AFTER route,
    ADD COLUMN infusion_rate DECIMAL(8,2) NULL AFTER is_infusion,
    ADD COLUMN infusion_rate_unit VARCHAR(25) NULL AFTER infusion_rate,
    ADD COLUMN infusion_stopped_at DATETIME NULL AFTER infusion_rate_unit,
    ADD COLUMN complications TEXT NULL;

-- Vitals: add AVPU responsiveness, RASS (goes from -5 to +4), measured MAP
-- And how the BP and HR were taken 
ALTER TABLE vitals
    ADD COLUMN responsiveness ENUM('alert','verbal','pain','unresponsive') NULL,
    ADD COLUMN rass TINYINT NULL,
    ADD COLUMN mean_arterial_pressure INT UNSIGNED NULL,
    ADD COLUMN bp_method VARCHAR(50) NULL,
    ADD COLUMN heart_rate_method VARCHAR(50) NULL,
    ADD COLUMN ecg VARCHAR(100) NULL,
    ADD CONSTRAINT chk_vitals_rass CHECK (rass BETWEEN -5 AND 4);

-- History: substance use and airway indications.
-- environmental_allergies is no longer needed
ALTER TABLE chart_patient_info
    DROP COLUMN environmental_allergies,
    ADD COLUMN alcohol_use TEXT NULL,
    ADD COLUMN drug_use TEXT NULL,
    ADD COLUMN invasive_airway_indications TEXT NULL;

-- Incident: Added column for where it happened 
ALTER TABLE ambulance_calls
    ADD COLUMN incident_location_type ENUM('home','street_highway','public_place','workplace','school','healthcare_facility','recreation','other') NULL AFTER incident_location;

-- Consent: witness added, they can sign the same form
ALTER TABLE chart_forms
    ADD COLUMN witness_name VARCHAR(100) NULL,
    ADD COLUMN witness_signed_at DATETIME NULL,
    ADD COLUMN witness_signature_attachment_id INT UNSIGNED NULL,
    ADD CONSTRAINT fk_chart_forms_witness_signature
        FOREIGN KEY (witness_signature_attachment_id) REFERENCES attachments(attachment_id);
