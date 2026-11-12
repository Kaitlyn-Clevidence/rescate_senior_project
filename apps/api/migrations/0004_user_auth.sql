-- Author(s): Isabel Sullivan
-- Start date: 2026-11-11
-- Last updated: 2026-11-11
-- P5: MVP
-- User registration by admin invite (issue #12, FR3 and FR4)
-- Admin creates a user with email and role; user sets their
-- name, username, phone and password through a single use email link

-- Invited users only have email and role until setup is complete
ALTER TABLE users
    MODIFY username VARCHAR(50) NULL,
    MODIFY password_hash VARCHAR(255) NULL,
    MODIFY email VARCHAR(255) NOT NULL,
    MODIFY name VARCHAR(100) NULL,
    ADD COLUMN invited_by INT UNSIGNED NULL,
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN password_set_at DATETIME NULL,
    ADD COLUMN last_login_at DATETIME NULL,
    ADD CONSTRAINT fk_users_invited_by
        FOREIGN KEY (invited_by) REFERENCES users(user_id);

-- Single-use link for account setup and password reset
-- SHA-256 hash of the token is stored. Never the token itself
CREATE TABLE IF NOT EXISTS user_tokens (
    token_id INT UNSIGNED AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    purpose ENUM('setup', 'reset') NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (token_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

