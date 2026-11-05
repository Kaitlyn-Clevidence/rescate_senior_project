-- Author(s): Isabel Sullivan
-- Start date: 2026-11-04
-- Last updated: 2026-11-04
-- P4: Prototype 
-- Purpose: Adds the remaining tables to the database
-- schema in a new migration, so that the databse covers the
-- full chart and aligns with repository classes (issue #5)

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

CREATE TABLE IF NOT EXISTS ambulance_calls (
    chart_id INT UNSIGNED NOT NULL,
    call_category ENUM('scene','transfer') NOT NULL,
    unit_number VARCHAR(50),
    mass_casualty_incident BOOLEAN NOT NULL DEFAULT FALSE,
    patient_count INT UNSIGNED,
    agencies VARCHAR(255),
    triage_color VARCHAR(50),
    care_level VARCHAR(50),
    destination VARCHAR(100),
    dispatch_at DATETIME,
    enroute_at DATETIME,
    arrive_scene_at DATETIME,
    patient_contact_at DATETIME,
    depart_scene_at DATETIME,
    arrive_at_destination DATETIME,
    transfer_at DATETIME,
    PRIMARY KEY (chart_id),
    FOREIGN KEY (chart_id) references charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS clinic_visits (
    chart_id INT UNSIGNED NOT NULL,
    intake_time DATETIME,
    discharge_time DATETIME,
    reason_for_visit TEXT,
    discharge_instructions TEXT,
    PRIMARY KEY (chart_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vitals (
    vital_id INT UNSIGNED AUTO_INCREMENT,
    chart_id INT UNSIGNED NOT NULL,
    recorded_at DATETIME,
    heart_rate INT UNSIGNED,
    respiratory_rate INT UNSIGNED,
    systolic_bp INT UNSIGNED,
    diastolic_bp INT UNSIGNED,
    spo2 INT UNSIGNED,
    etco2 INT UNSIGNED,
    gcs_eyes INT UNSIGNED,
    gcs_motor INT UNSIGNED,
    temperature DECIMAL(4,1),
    pain INT UNSIGNED,
    PRIMARY KEY (vital_id),
    FOREIGN KEY (chart_id) REFERENCES charts(chart_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

