BEGIN;

CREATE TABLE IF NOT EXISTS app.sponsor_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES app.sponsors(id) ON DELETE CASCADE,
  benefit_type text NOT NULL CHECK (benefit_type IN ('branding', 'court_hours', 'event', 'merchandise', 'digital')),
  name text NOT NULL,
  description text,
  quantity numeric(12,2),
  unit text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.sponsor_contract_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES app.sponsors(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer')),
  reference text,
  paid_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS app.sponsor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES app.sponsors(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_date date NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  created_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.sponsor_merchandise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES app.sponsors(id) ON DELETE CASCADE,
  product_id uuid REFERENCES app.products(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  delivered_at date,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'delivered', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.sponsor_events_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES app.sponsors(id) ON DELETE CASCADE,
  user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('created', 'updated', 'renewed', 'benefit_used', 'payment_received', 'event_scheduled', 'merchandise_delivered', 'cancelled')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sponsor_benefits_sponsor_idx ON app.sponsor_benefits(sponsor_id, active);
CREATE INDEX IF NOT EXISTS sponsor_payments_sponsor_idx ON app.sponsor_contract_payments(sponsor_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS sponsor_events_sponsor_idx ON app.sponsor_events(sponsor_id, event_date);
CREATE INDEX IF NOT EXISTS sponsor_merchandise_sponsor_idx ON app.sponsor_merchandise(sponsor_id, status);
CREATE INDEX IF NOT EXISTS sponsors_dates_idx ON app.sponsors(ends_on, active);

COMMIT;

-- Aplicar despues de 001_initial_schema.sql y 002_memberships.sql:
-- psql -U postgres -d lacima -f database/003_sponsors.sql