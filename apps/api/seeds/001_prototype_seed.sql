-- Author(s): Kaitlyn Clevidence
-- Start date: 2026-11-04
-- Last updated: 2026-11-07
-- P4: Prototype 
-- Purpose: seeds sample data into the api database for the prototype demo;

-- Clear existing rows so the seed is safe to re-run. Foreign key checks are
-- off because MySQL refuses to TRUNCATE a table that another table references.
-- TRUNCATE also resets AUTO_INCREMENT, so the patient_ids below stay 1-4.
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE charts;
TRUNCATE TABLE patients;
SET FOREIGN_KEY_CHECKS = 1;

-- Insert seed data
INSERT INTO patients (first_name, last_name, phone,
    email, home_address, birth_date, gender) VALUES 
("Kaitlyn", "Clevidence", "123-456-7890", "kclevidence@unr.edu", "Las Vegas", 
"2004-12-03", "F"),
("Sophia", "Koshy", "098-765-4321", "sophia@example.com", "Reno", 
"2005-09-06", "F"),
("Aidan", "Madonna", "111-222-3333", "aidan@example.com", "Fremont", 
"1985-08-20", "M"),
("Izzy", "Sullivan", "444-555-6666", "izzy@example.com", "Seattle", 
"1995-11-10", "F");

INSERT INTO charts (patient_id, nature_of_call, call_type, encounter_date, 
    is_completed, is_practice, form_version) VALUES
(4, "B/P check", "clinic", "2024-01-15 10:00:00", TRUE, FALSE, 2),
(3, "Vehicle Accident", "ambulance", "2024-02-20 14:30:00", TRUE, FALSE, 2),
(2, "Injection", "clinic", "2024-03-05 09:15:00", FALSE, TRUE, 2),
(1, "Cardiac", "clinic", "2024-04-10 11:45:00", TRUE, FALSE, 2),
(4, "Trauma", "clinic", "2024-01-15 10:00:00", TRUE, FALSE, 2),
(3, "Injection", "ambulance", "2024-02-20 14:30:00", TRUE, FALSE, 2),
(2, "Vehicle Accident", "clinic", "2024-03-05 09:15:00", FALSE, TRUE, 2),
(1, "Trauma", "clinic", "2024-04-10 11:45:00", TRUE, FALSE, 2),
(4, "Cardiac", "clinic", "2024-01-15 10:00:00", TRUE, FALSE, 2),
(3, "B/P check", "ambulance", "2024-02-20 14:30:00", TRUE, FALSE, 2),
(2, "Vehicle Accident", "clinic", "2024-03-05 09:15:00", FALSE, TRUE, 2),
(1, "Trauma", "clinic", "2024-04-10 11:45:00", TRUE, FALSE, 2),
(4, "B/P check", "clinic", "2024-01-15 10:00:00", TRUE, FALSE, 2),
(3, "Cardiac", "ambulance", "2024-02-20 14:30:00", TRUE, FALSE, 2),
(2, "Injection", "clinic", "2024-03-05 09:15:00", FALSE, TRUE, 2),
(1, "Trauma", "clinic", "2024-04-10 11:45:00", TRUE, FALSE, 2);