-- Author(s): Kaitlyn Clevidence (draft for Isabel Sullivan to review)
-- Start date: 2026-11-24
-- Last updated: 2026-11-24
-- P5: MVP
-- Purpose: the schema gaps left after 0005: estimated age on the patient,
-- blood glucose in vitals, a crew identity rule, and the audit log.
-- Requires 0001, 0002, 0003 and 0005 on the DB.
-- Not included on purpose:
--  - the single-use account/reset token table and the password-changed date:
--    those are in 0004_user_auth.sql on the 12-user-registration branch
--    (table user_tokens, column users.password_set_at)
--  - charts.created_by NOT NULL: seeded and migrated legacy charts have no
--    creator, so the service requires it for new charts instead

-- Every chart needs a birth date or an estimated age. Age belongs on the
-- patient. The "birth date or estimated age" rule is checked in the service
-- (existing patients may have neither).
ALTER TABLE patients
    ADD COLUMN estimated_age INT UNSIGNED NULL,
    ADD CONSTRAINT chk_patients_estimated_age CHECK (estimated_age BETWEEN 0 AND 130);

-- Age is no longer recorded per visit on the chart
ALTER TABLE chart_patient_info
    DROP COLUMN estimated_age;

-- Blood glucose in mg/dL, needed for the Diabetic problem short form
ALTER TABLE vitals
    ADD COLUMN blood_glucose INT UNSIGNED NULL;

-- Crew are system users. A name with no user is only for crew parsed out of
-- legacy charts, so every crew row needs one or the other.
ALTER TABLE chart_crew
    ADD CONSTRAINT chk_chart_crew_identity CHECK (user_id IS NOT NULL OR name IS NOT NULL);

-- Append-only record of who did what (FR11). The app's DB user should get
-- INSERT and SELECT only on this table, never UPDATE or DELETE. user_id is
-- NULL for events with no logged-in user, such as a failed login. details is
-- JSON and must never contain PHI.
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id INT UNSIGNED AUTO_INCREMENT,
    user_id INT UNSIGNED NULL,
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(50) NULL,
    entity_id VARCHAR(50) NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    details JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_id),
    KEY idx_audit_user_time (user_id, created_at),
    KEY idx_audit_entity (entity, entity_id),
    KEY idx_audit_time (created_at),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
