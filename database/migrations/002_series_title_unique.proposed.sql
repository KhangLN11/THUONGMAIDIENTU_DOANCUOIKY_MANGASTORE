-- APPROVED by user; applied 2026-11-23 after preflight, backup and isolated test.
-- Historical proposed filename retained. Do not rerun ALTER when index exists.
-- Phase 12A: retain all existing columns, IDs, slugs, rows and foreign keys.
-- Based on 01_schema.sql and the read-only snapshot from 2026-11-22.
-- Initial audit connection failed; later verified on MariaDB 10.4.32 before applying.
-- Required: back up manga_store + uploads, verify successful backup, and
-- test on an isolated clone running the actual MariaDB version before approval execution.
-- DDL implicitly commits in MariaDB; do not claim ALTER can be rolled back by ROLLBACK.

-- PREFLIGHT (READ ONLY): run and review separately before the ALTER below.
SELECT VERSION() AS mariadb_version, DATABASE() AS selected_database;
SHOW CREATE TABLE manga_store.manga_series;
SHOW INDEX FROM manga_store.manga_series;

-- Expected columns: title VARCHAR(200) NOT NULL, utf8mb4_unicode_ci;
-- slug VARCHAR(160) NOT NULL with uq_series_slug. If different: STOP and revise.
-- All following anomaly queries must return ZERO rows. Never fix rows automatically.
SELECT id, title
FROM manga_store.manga_series
WHERE CHAR_LENGTH(TRIM(title)) = 0
   OR BINARY title <> BINARY TRIM(title);

-- Use the table collation to detect case/accent-equivalent names, not a JS comparison.
SELECT TRIM(title) COLLATE utf8mb4_unicode_ci AS conflicting_title,
       COUNT(*) AS row_count, GROUP_CONCAT(id ORDER BY id) AS series_ids
FROM manga_store.manga_series
GROUP BY TRIM(title) COLLATE utf8mb4_unicode_ci
HAVING COUNT(*) > 1;

-- Confirm uq_series_title does not already exist and no equivalent unique
-- title index exists. If already applied, verify its definition and SKIP ALTER.
-- Names follow existing utf8mb4_unicode_ci equality (case/accent insensitive).
-- API will trim leading/trailing whitespace, validate 1..200 characters,
-- and map duplicate-key 1062 to HTTP 409 for title OR slug conflicts.

-- ONLY AFTER EXPLICIT APPROVAL AND SUCCESSFUL PREFLIGHT/ISOLATED TEST:
ALTER TABLE manga_store.manga_series
    ADD UNIQUE KEY uq_series_title (title);

-- POSTFLIGHT (READ ONLY): compare row count/content to the verified backup.
SHOW INDEX FROM manga_store.manga_series;
SELECT COUNT(*) AS series_count FROM manga_store.manga_series;

-- Rollback PLAN ONLY (do not run without approval):
-- ALTER TABLE manga_store.manga_series DROP INDEX uq_series_title;
-- This would remove only the added constraint, not series data.
