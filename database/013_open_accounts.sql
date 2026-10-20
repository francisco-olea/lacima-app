BEGIN;

CREATE TABLE IF NOT EXISTS app.open_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_session_id uuid NOT NULL REFERENCES app.cash_sessions(id) ON DELETE RESTRICT,
  customer_name text NOT NULL CHECK (length(btrim(customer_name)) BETWEEN 1 AND 160),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'cancelled')),
  sale_id uuid REFERENCES app.sales(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.open_account_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES app.open_accounts(id) ON DELETE CASCADE,
  product_id uuid REFERENCES app.products(id) ON DELETE SET NULL,
  sku text,
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  line_total numeric(12,2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_amount <= quantity * unit_price),
  CHECK (line_total = quantity * unit_price - discount_amount)
);

CREATE INDEX IF NOT EXISTS open_accounts_session_idx
  ON app.open_accounts(cash_session_id, status, created_at);
CREATE INDEX IF NOT EXISTS open_account_items_account_idx
  ON app.open_account_items(account_id, created_at);

COMMIT;

-- Aplicar despues de las migraciones 001 a 012:
-- psql -U postgres -d lacima -f database/013_open_accounts.sql
