-- Manga Store / Stage 8 / PROPOSAL ONLY - NOT APPLIED
-- Target: the selected manga_store database, MariaDB/MySQL with enforced CHECK constraints.
-- Requires user approval, a fresh schema preflight and a backup before execution.
-- Do not execute this proposal until approved. No DROP, data UPDATE or seed.
-- Existing orders keep NULL metadata; all new checkout code must provide both values.
-- To enable AFTER approval: set the variable below to 1 in the SAME connection first.
-- SET @manga_stage8_order_idempotency_approved = 1;

SET @manga_stage8_order_idempotency_approved = COALESCE(@manga_stage8_order_idempotency_approved, 0);
SET @manga_stage8_order_idempotency_sql = IF(
    @manga_stage8_order_idempotency_approved = 1,
    'ALTER TABLE orders
       ADD COLUMN idempotency_key CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
       ADD COLUMN checkout_request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
       ADD UNIQUE KEY uq_orders_user_idempotency (user_id, idempotency_key),
       ADD CONSTRAINT ck_orders_idempotency_pair CHECK (
           (idempotency_key IS NULL AND checkout_request_hash IS NULL)
           OR (
               idempotency_key IS NOT NULL AND checkout_request_hash IS NOT NULL
               AND CHAR_LENGTH(idempotency_key) = 32
               AND CHAR_LENGTH(checkout_request_hash) = 64
           )
       )',
    'SELECT ''NOT APPLIED: Stage 8 migration approval is required.'' AS migration_status'
);
PREPARE manga_stage8_order_idempotency_stmt FROM @manga_stage8_order_idempotency_sql;
EXECUTE manga_stage8_order_idempotency_stmt;
DEALLOCATE PREPARE manga_stage8_order_idempotency_stmt;
SET @manga_stage8_order_idempotency_sql = NULL;
SET @manga_stage8_order_idempotency_approved = 0;

-- One-time migration, not a blind rerunnable script.
-- On rerun, inspect information_schema first; existing columns/index must match exactly.
-- ALTER TABLE is DDL with implicit commit: an application transaction cannot roll it back.
-- No inventory, cart, order rows or catalog content are changed by this migration.
