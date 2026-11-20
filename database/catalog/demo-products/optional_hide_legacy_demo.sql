-- OPTIONAL PROPOSAL ONLY: separate approval required; preserves IDs and references.
SET @APPROVE_HIDE_8_OLD_DEMOS=0;
USE manga_store;
START TRANSACTION;
UPDATE products SET status='archived' WHERE @APPROVE_HIDE_8_OLD_DEMOS=1 AND status='active' AND sku IN ('DEMO-MANGA-001','DEMO-MANGA-002','DEMO-MANGA-003','DEMO-FIG-001','DEMO-ACC-001','DEMO-POS-001','DEMO-APP-001','DEMO-STA-001');
SELECT ROW_COUNT() AS legacy_products_archived;
COMMIT;
