BEGIN;

CREATE TABLE IF NOT EXISTS app.cash_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  days_of_week integer[] NOT NULL CHECK (days_of_week <@ ARRAY[0,1,2,3,4,5,6]),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at <> ends_at)
);

CREATE TABLE IF NOT EXISTS app.user_shift_assignments (
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL REFERENCES app.cash_shifts(id) ON DELETE CASCADE,
  assigned_from date NOT NULL DEFAULT current_date,
  assigned_until date,
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, shift_id),
  CHECK (assigned_until IS NULL OR assigned_until >= assigned_from)
);

CREATE TABLE IF NOT EXISTS app.product_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES app.products(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  days_of_week integer[] NOT NULL CHECK (days_of_week <@ ARRAY[0,1,2,3,4,5,6]),
  buy_quantity numeric(12,3) NOT NULL CHECK (buy_quantity > 0),
  pay_quantity numeric(12,3) NOT NULL CHECK (pay_quantity > 0 AND pay_quantity <= buy_quantity),
  starts_on date,
  ends_on date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);

ALTER TABLE app.sales
  ADD COLUMN IF NOT EXISTS payers_count integer NOT NULL DEFAULT 1 CHECK (payers_count > 0);

CREATE INDEX IF NOT EXISTS user_shift_assignments_shift_idx
  ON app.user_shift_assignments(shift_id, active);
CREATE INDEX IF NOT EXISTS product_promotions_product_idx
  ON app.product_promotions(product_id, active);

INSERT INTO app.cash_shifts (code, name, days_of_week, starts_at, ends_at)
VALUES
  ('WEEKDAY_AM', 'Lunes a viernes · mañana', ARRAY[1,2,3,4,5], '06:00', '14:00'),
  ('WEEKDAY_PM', 'Lunes a viernes · tarde', ARRAY[1,2,3,4,5], '16:00', '00:00'),
  ('WEEKEND_AM', 'Fin de semana · mañana', ARRAY[0,6], '07:00', '15:00'),
  ('WEEKEND_PM', 'Fin de semana · tarde', ARRAY[0,6], '16:00', '00:00')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  days_of_week = EXCLUDED.days_of_week,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at;

INSERT INTO app.users (role_id, email, full_name, password_hash)
SELECT r.id, seed.email, seed.full_name, crypt(seed.password, gen_salt('bf', 12))
FROM app.roles r
CROSS JOIN (VALUES
  ('denisse@lacimapadelclub.com', 'Denisse', 'CajaDenisse2026!'),
  ('paola@lacimapadelclub.com', 'Paola', 'CajaPaola2026!'),
  ('jenny@lacimapadelclub.com', 'Jenny', 'CajaJenny2026!'),
  ('andrea@lacimapadelclub.com', 'Andrea', 'CajaAndrea2026!')
) AS seed(email, full_name, password)
WHERE r.code = 'cashier'
  AND NOT EXISTS (
    SELECT 1 FROM app.users existing
    WHERE lower(existing.full_name) = lower(seed.full_name)
       OR existing.email = seed.email
  )
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role_id = EXCLUDED.role_id,
  active = true;

UPDATE app.users
SET full_name = 'Fernanda', active = true
WHERE email = 'admin@lacimapadelclub.com';

UPDATE app.users
SET active = false
WHERE email = 'caja@lacimapadelclub.com';

INSERT INTO app.user_shift_assignments (user_id, shift_id)
SELECT u.id, s.id
FROM app.users u
CROSS JOIN app.cash_shifts s
WHERE u.email IN (
  'denisse@lacimapadelclub.com',
  'paola@lacimapadelclub.com',
  'jenny@lacimapadelclub.com',
  'andrea@lacimapadelclub.com'
)
ON CONFLICT (user_id, shift_id) DO UPDATE SET active = true;

INSERT INTO app.products (sku, name, category_id, unit_price, stock, minimum_stock, track_stock, active)
SELECT '7501016', 'Alquiler de pala de padel', c.id, 50.00, 999.000, 0.000, false, true
FROM app.product_categories c
WHERE c.name = 'Servicios'
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  unit_price = EXCLUDED.unit_price,
  active = true,
  track_stock = false;

UPDATE app.products
SET name = 'Renta de cancha · 1 hora', unit_price = 500.00, active = true, track_stock = false
WHERE sku = '7501011';

UPDATE app.products
SET name = 'Clase particular · precio pendiente', unit_price = 0.00, active = false
WHERE sku = '7501012';

INSERT INTO app.product_promotions (product_id, code, name, days_of_week, buy_quantity, pay_quantity)
SELECT p.id, 'CANCHA_2X1_FIN_SEMANA', 'Cancha 2x1 fin de semana', ARRAY[0,6], 2, 1
FROM app.products p
WHERE p.sku = '7501011'
ON CONFLICT (code) DO UPDATE SET
  product_id = EXCLUDED.product_id,
  days_of_week = EXCLUDED.days_of_week,
  buy_quantity = EXCLUDED.buy_quantity,
  pay_quantity = EXCLUDED.pay_quantity,
  active = true;

INSERT INTO app.settings (setting_key, setting_value) VALUES
  ('operations', '{"court_weekday_hour":500,"court_weekend_buy_hours":2,"court_weekend_pay_hours":1,"paddle_rental":50,"classes_price_status":"pending"}'),
  ('cash_shifts', '{"weekday":["06:00-14:00","16:00-00:00"],"weekend":["07:00-15:00","16:00-00:00"]}')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

COMMIT;

-- Aplicar despues de 001_initial_schema.sql, 002_memberships.sql y 003_sponsors.sql:
-- psql -U postgres -d lacima -f database/004_operations.sql
-- Usuarios iniciales de caja:
-- denisse@lacimapadelclub.com / CajaDenisse2026!
-- paola@lacimapadelclub.com / CajaPaola2026!
-- jenny@lacimapadelclub.com / CajaJenny2026!
-- andrea@lacimapadelclub.com / CajaAndrea2026!