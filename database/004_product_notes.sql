BEGIN;

CREATE TABLE IF NOT EXISTS app.product_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES app.products(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (char_length(btrim(note)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_notes_product_created_idx
  ON app.product_notes(product_id, created_at DESC);

COMMIT;

-- Aplicar despues de 001_initial_schema.sql:
-- psql -U postgres -d lacima -f database/004_product_notes.sql
