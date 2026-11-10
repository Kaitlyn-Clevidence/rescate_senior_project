-- Author(s): Isabel Sullivan
-- Start date: 2026-11-04
-- Last updated: 2026-11-04
-- P4: Prototype 
-- Purpose: Adds the remaining tables to the database
-- schema in a new migration, so that the database covers the
-- full chart and aligns with repository classes (issue #5)

-- User: a person who uses the system with a role
CREATE TABLE IF NOT EXISTS users (
    user_id INT UNSIGNED AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    name VARCHAR(100) NOT NULL,
    role ENUM('admin','provider','board','trainee') NOT NULL DEFAULT 'provider',
    certifications VARCHAR(255),
    language_preferred ENUM('en','es') NOT NULL DEFAULT 'es',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ambulance chart: Ambulance only call details and timeline of dispatch
CREATE TABLE IF NOT EXISTS ambulance_calls (
    chart_id INT UNSIGNED NOT NULL,
    call_category ENUM('scene','transfer') NOT NULL,
    mass_casualty_incident BOOLEAN NOT NULL DEFAULT FALSE,
    patient_count INT UNSIGNED,
    agencies VARCHAR(255),
    disposition VARCHAR(100),
    unit_number VARCHAR(50),
    triage_color VARCHAR(50),
    care_level VARCHAR(50),
    dispatch_at DATETIME,
    enroute_at DATETIME,
    arrive_scene_at DATETIME,
    patient_contact_at DATETIME,
    depart_scene_at DATETIME,
    PRIMARY KEY (chart_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Clinic chart: Clinic only intake, discharge and visit details
CREATE TABLE IF NOT EXISTS clinic_visits (
    chart_id INT UNSIGNED NOT NULL,
    intake_time DATETIME,
    discharge_time DATETIME,
    reason_for_visit TEXT,
    discharge_instructions TEXT,
    PRIMARY KEY (chart_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One set of vital set at a time (but multiple per chart)
CREATE TABLE IF NOT EXISTS vitals (
    vital_id INT UNSIGNED AUTO_INCREMENT,
    chart_id INT UNSIGNED NOT NULL,
    recorded_at DATETIME NOT NULL,
    heart_rate INT UNSIGNED,
    respiratory_rate INT UNSIGNED,
    systolic_bp INT UNSIGNED,
    diastolic_bp INT UNSIGNED,
    spo2 INT UNSIGNED,
    etco2 INT UNSIGNED,
    gcs_eyes INT UNSIGNED,
    gcs_motor INT UNSIGNED,
    gcs_verbal INT UNSIGNED,
    temperature DECIMAL(4,1),
    pain INT UNSIGNED,
    PRIMARY KEY (vital_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Note: Addendums added after a chart is submitted
CREATE TABLE IF NOT EXISTS notes (
    note_id INT UNSIGNED AUTO_INCREMENT,
    chart_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED,
    note TEXT NOT NULL,
    date_added DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (note_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Attachments: Metadata for a photo or signature file, file itself in storage
CREATE TABLE IF NOT EXISTS attachments (
    attachment_id INT UNSIGNED AUTO_INCREMENT,
    attachment_uuid CHAR(36) NOT NULL UNIQUE,
    chart_id INT UNSIGNED NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    uploaded_by INT UNSIGNED,
    time_captured DATETIME,
    PRIMARY KEY (attachment_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Obstetrics: OB details for when the nature of call is OB
CREATE TABLE IF NOT EXISTS obstetrics (
    chart_id INT UNSIGNED NOT NULL,
    gravida INT UNSIGNED,
    para INT UNSIGNED,
    abortion INT UNSIGNED,
    due_date DATE,
    gestation INT UNSIGNED,
    vaginal_bleeding BOOLEAN,
    contraction_onset DATETIME,
    frequency INT UNSIGNED,
    duration INT UNSIGNED,
    bag_of_water_ruptured BOOLEAN,
    feels_baby_moving BOOLEAN,
    delivery_time DATETIME,
    placenta_delivered BOOLEAN,
    baby_sex CHAR(1),
    born ENUM('alive','dead'),
    apgar_1min INT UNSIGNED,
    apgar_5min INT UNSIGNED,
    apgar_10min INT UNSIGNED,
    PRIMARY KEY (chart_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Patient info: Patient facts as recorded for the visit such as age, weight
CREATE TABLE IF NOT EXISTS chart_patient_info (
    chart_id INT UNSIGNED NOT NULL,
    weight DECIMAL(5,1),
    classification ENUM('adult','senior_adult','pediatric','neonatal'),
    braslow_color ENUM('Gray','Pink','Red','Yellow','Purple','White','Blue','Orange','Green'),
    estimated_age INT UNSIGNED,
    history_given_by SET('patient','family','other'),
    history_of_present_illness TEXT NOT NULL,
    medication_allergies TEXT,
    environmental_allergies TEXT,
    immunizations TEXT,
    past_medical_history TEXT,
    regular_medicines TEXT,
    PRIMARY KEY (chart_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Transport info: Hand off to another facility, for both call types
CREATE TABLE IF NOT EXISTS transports (
    chart_id INT UNSIGNED NOT NULL,
    destination VARCHAR(100),
    arrive_destination_at DATETIME,
    transfer_of_care_at DATETIME,
    PRIMARY KEY (chart_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Vehicle Accident: Crash details for trauma calls
CREATE TABLE IF NOT EXISTS vehicle_accident (
    chart_id INT UNSIGNED NOT NULL,
    type ENUM('auto_into_object','auto_into_auto','motorcycle','atv','boat','aviation'),
    impact SET('head_on','side','rear','roll_over'),        
    estimated_speed INT UNSIGNED,
    safety_equipment SET('none','seatbelt','helmet','airbags_deployed','protective_clothing','life_preserver'),
    ejection BOOLEAN,
    PRIMARY KEY (chart_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Consent forms: A signed consent or AMA form, signature image is an attachment
CREATE TABLE IF NOT EXISTS chart_forms (
    chart_form_id INT UNSIGNED AUTO_INCREMENT,
    chart_id INT UNSIGNED NOT NULL,
    form_type ENUM('consent','ama') NOT NULL,
    language ENUM('en','es') NOT NULL,
    signer_name VARCHAR(100) NOT NULL,
    signed_at DATETIME NOT NULL,
    signature_attachment_id INT UNSIGNED,
    text_version INT UNSIGNED NOT NULL,
    PRIMARY KEY(chart_form_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE,
    FOREIGN KEY (signature_attachment_id) REFERENCES attachments(attachment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
 -- Chart crew: A person on an ambulance call
CREATE TABLE IF NOT EXISTS chart_crew (
    crew_member_id INT UNSIGNED AUTO_INCREMENT,
    chart_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED,
    name VARCHAR(100),
    role_on_call VARCHAR(50),
    PRIMARY KEY (crew_member_id),
    FOREIGN KEY (chart_id) REFERENCES ambulance_calls(chart_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id)    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wound_care (
    chart_id INT UNSIGNED,
    injury_occurred_at DATETIME,
    wound_location VARCHAR(50),
    wound_type VARCHAR(50),
    wound_size VARCHAR(50),
    wound_treatment VARCHAR(255),
    wound_appearance VARCHAR(50),
    suture_location VARCHAR(50),
    suture_date_placed DATETIME,
    sutures_removed INT UNSIGNED,
    PRIMARY KEY (chart_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Medication administered: One medication administered (many per chart)
CREATE TABLE IF NOT EXISTS medications_given (
    medication_given_id INT UNSIGNED AUTO_INCREMENT,
    chart_id INT UNSIGNED NOT NULL,
    medication_name VARCHAR(100) NOT NULL,
    dose DECIMAL(8,2),
    unit VARCHAR(25),
    route VARCHAR(50),
    given_at DATETIME NOT NULL,
    given_by INT unsigned,
    ordered_by VARCHAR(50),
    results TEXT,
    PRIMARY KEY (medication_given_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE,
    FOREIGN KEY (given_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Procedure: One procedure, details hold info specific to that procedure
CREATE TABLE IF NOT EXISTS procedures_performed (
    procedure_performed_id INT UNSIGNED AUTO_INCREMENT,
    chart_id INT UNSIGNED NOT NULL,
    procedure_code VARCHAR(50) NOT NULL,
    performed_at DATETIME NOT NULL,
    performed_by INT UNSIGNED NOT NULL,
    details JSON, -- Each procedure has their own field, (e.g. store things like amount of oxygen or delivery for oxygen)
    notes TEXT,
    PRIMARY KEY (procedure_performed_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Fluid Entry: One fluid type in one phase, total is calculated rather than stored
CREATE TABLE IF NOT EXISTS fluid_intake_output (
    fluid_entry_id INT UNSIGNED AUTO_INCREMENT,
    chart_id INT UNSIGNED NOT NULL,
    kind ENUM('bleeding','iv fluids','oral fluids','vomit') NOT NULL,
    phase ENUM('pre transport','transport') NOT NULL,
    amount INT UNSIGNED NOT NULL,
    PRIMARY KEY (fluid_entry_id),
    UNIQUE(chart_id, kind, phase),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Physical exam stores the region by region checkbox. Many rows per chart, one per ticked box
CREATE TABLE IF NOT EXISTS physical_exam (
    physical_exam_id INT UNSIGNED AUTO_INCREMENT,
    chart_id INT UNSIGNED NOT NULL,
    region ENUM('skin','mental','neurological','head','neck','chest',
            'abdomen','pelvis','back','upper_arm','lower_arm',
            'hand_wrist','upper_leg','lower_leg','ankle_foot') NOT NULL,
    side ENUM('none','left','right') NOT NULL DEFAULT 'none',
    finding VARCHAR(50) NOT NULL,
    PRIMARY KEY (physical_exam_id),
    UNIQUE(chart_id, region, side, finding),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Assessment stores the single set of patient results (such as burn, stroke screening, pulse)
CREATE TABLE IF NOT EXISTS assessments (
    chart_id INT UNSIGNED NOT NULL,
    pulse_strength ENUM('normal','weak','absent','bounding'),
    pulse_rate ENUM('regular','irregular'),
    burn_calculation DECIMAL(5,2) NOT NULL DEFAULT 0,
    stroke_time DATETIME,
    stroke_facial_droop BOOLEAN,
    stroke_arm_drift BOOLEAN,
    stroke_abnormal_speech BOOLEAN,
    extra_findings TEXT,
    PRIMARY KEY (chart_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dropdown options for cause of trauma, with English and Spanish labels
-- new causes are added as rows, no ALTER TABLE command needed
CREATE TABLE IF NOT EXISTS trauma_causes (
    trauma_cause_id INT UNSIGNED AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL UNIQUE,
    name_en VARCHAR(100) NOT NULL,
    name_es VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (trauma_cause_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
 
-- Untouched JSON copy of each v1 row, saved before migration so nothing is lost if the conversion to v2 goes wrong.
CREATE TABLE IF NOT EXISTS charts_v1_archive (
    archive_id INT UNSIGNED AUTO_INCREMENT,
    entity VARCHAR(50) NOT NULL,             
    legacy_id INT UNSIGNED NOT NULL,
    raw_row JSON NOT NULL,
    archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (archive_id),
    UNIQUE (entity, legacy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



