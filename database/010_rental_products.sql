BEGIN;

ALTER TABLE app.products
  ADD COLUMN IF NOT EXISTS is_rental boolean NOT NULL DEFAULT false;

UPDATE app.products
SET is_rental = true
WHERE sku IN ('7501011', '7501016')
  AND is_rental = false;

UPDATE app.products
SET stock = 0,
    minimum_stock = 0,
    updated_at = now()
WHERE track_stock = false
  AND (stock <> 0 OR minimum_stock <> 0);

COMMIT;
