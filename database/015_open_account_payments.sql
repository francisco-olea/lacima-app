BEGIN;

CREATE TABLE IF NOT EXISTS app.open_account_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES app.open_accounts(id) ON DELETE CASCADE,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS open_account_payments_account_idx
  ON app.open_account_payments(account_id, paid_at);

COMMIT;

-- Aplicar despues de las migraciones 001 a 014:
-- psql -U postgres -d lacima -f database/015_open_account_payments.sql
