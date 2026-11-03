-- check on uuid and email uniqueness
CREATE TABLE IF NOT EXISTS patients (
    patient_id INT UNSIGNED AUTO_INCREMENT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(100) NOT NULL,
    home_address VARCHAR(255) NOT NULL,
    birth_date DATE,
    gender char(1) NOT NULL,
    PRIMARY KEY (patient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- check izzys id vs chart uuid vs incident number
CREATE TABLE IF NOT EXISTS charts (
    chart_id INT UNSIGNED AUTO_INCREMENT,
    -- chart_uuid CHAR(36) NOT NULL UNIQUE,
    legacy_chart_id INT UNSIGNED NULL,
    patient_id INT UNSIGNED NOT NULL,
    nature_of_call VARCHAR(50) NOT NULL,
    call_type ENUM('clinic', 'ambulance') NOT NULL,
    encounter_date DATETIME NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    is_practice BOOLEAN NOT NULL DEFAULT FALSE,
    form_version INT UNSIGNED NOT NULL DEFAULT 2,    
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    PRIMARY KEY (chart_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
