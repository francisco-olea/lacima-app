BEGIN;

CREATE TABLE IF NOT EXISTS app.membership_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES app.memberships(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES app.members(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer')),
  reference text,
  paid_by uuid REFERENCES app.users(id),
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS app.membership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES app.members(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES app.memberships(id) ON DELETE SET NULL,
  user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('created', 'renewed', 'suspended', 'reactivated', 'cancelled', 'expired', 'updated')),
  previous_status text,
  new_status text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS membership_payments_member_idx
  ON app.membership_payments(member_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS membership_events_member_idx
  ON app.membership_events(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS memberships_dates_idx
  ON app.memberships(ends_on, status);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_membership_per_member
  ON app.memberships(member_id) WHERE status = 'active';

INSERT INTO app.membership_plans (name, duration_months, price, benefits)
VALUES
  ('Esencial', 1, 850.00, '["Acceso al club", "Reservas de cancha"]'::jsonb),
  ('Premium', 3, 2200.00, '["Acceso al club", "Reservas de cancha", "Descuentos"]'::jsonb),
  ('Anual', 12, 7800.00, '["Acceso total", "Reservas de cancha", "Beneficios exclusivos"]'::jsonb)
ON CONFLICT (name) DO UPDATE SET
  duration_months = EXCLUDED.duration_months,
  price = EXCLUDED.price,
  benefits = EXCLUDED.benefits;

COMMIT;

-- Aplicar despues de 001_initial_schema.sql:
-- psql -U postgres -d lacima -f database/002_memberships.sql