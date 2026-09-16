BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS app.settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.permissions (
  code text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS app.role_permissions (
  role_id uuid NOT NULL REFERENCES app.roles(id) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES app.permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE IF NOT EXISTS app.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES app.roles(id),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  phone text,
  active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  location text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid NOT NULL REFERENCES app.cash_registers(id),
  opened_by uuid NOT NULL REFERENCES app.users(id),
  closed_by uuid REFERENCES app.users(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  closing_amount numeric(12,2) CHECK (closing_amount >= 0),
  expected_amount numeric(12,2) CHECK (expected_amount >= 0),
  difference_amount numeric(12,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'open' AND closed_at IS NULL AND closed_by IS NULL) OR status <> 'open')
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_session_per_register
  ON app.cash_sessions(register_id) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS app.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  category_id uuid NOT NULL REFERENCES app.product_categories(id),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  stock numeric(12,3) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  minimum_stock numeric(12,3) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  track_stock boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES app.products(id),
  user_id uuid REFERENCES app.users(id),
  movement_type text NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment_in', 'adjustment_out', 'return', 'initial')),
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  stock_before numeric(12,3) NOT NULL CHECK (stock_before >= 0),
  stock_after numeric(12,3) NOT NULL CHECK (stock_after >= 0),
  reference_type text,
  reference_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_number text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text,
  phone text,
  birth_date date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  duration_months integer NOT NULL CHECK (duration_months > 0),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES app.members(id),
  plan_id uuid NOT NULL REFERENCES app.membership_plans(id),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  price_paid numeric(12,2) NOT NULL CHECK (price_paid >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
  created_by uuid REFERENCES app.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS app.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL UNIQUE,
  contact_name text,
  contact_email text,
  contact_phone text,
  tier text NOT NULL CHECK (tier IN ('Platino', 'Oro', 'Plata')),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  contract_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (contract_amount >= 0),
  benefit_hours numeric(12,2) NOT NULL DEFAULT 0 CHECK (benefit_hours >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS app.sponsor_benefit_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES app.sponsors(id),
  user_id uuid REFERENCES app.users(id),
  benefit_type text NOT NULL DEFAULT 'court_hours',
  quantity numeric(12,2) NOT NULL CHECK (quantity > 0),
  used_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS app.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  folio text NOT NULL UNIQUE,
  cash_session_id uuid REFERENCES app.cash_sessions(id),
  cashier_id uuid NOT NULL REFERENCES app.users(id),
  member_id uuid REFERENCES app.members(id),
  subtotal numeric(12,2) NOT NULL CHECK (subtotal >= 0),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total numeric(12,2) NOT NULL CHECK (total >= 0),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'refunded')),
  sold_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_amount <= subtotal),
  CHECK (total = subtotal - discount_amount + tax_amount)
);

CREATE TABLE IF NOT EXISTS app.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES app.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES app.products(id),
  description text NOT NULL,
  sku text,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  discount_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  line_total numeric(12,2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_amount <= quantity * unit_price),
  CHECK (line_total = quantity * unit_price - discount_amount)
);

CREATE TABLE IF NOT EXISTS app.sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES app.sales(id) ON DELETE CASCADE,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid REFERENCES app.users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_name_idx ON app.products USING gin (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS inventory_movements_product_idx ON app.inventory_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_sold_at_idx ON app.sales(sold_at DESC);
CREATE INDEX IF NOT EXISTS sales_cashier_idx ON app.sales(cashier_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS sale_items_product_idx ON app.sale_items(product_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON app.audit_log(created_at DESC);

DROP TRIGGER IF EXISTS settings_updated_at ON app.settings;
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON app.settings FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS users_updated_at ON app.users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON app.users FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS registers_updated_at ON app.cash_registers;
CREATE TRIGGER registers_updated_at BEFORE UPDATE ON app.cash_registers FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS products_updated_at ON app.products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON app.products FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS members_updated_at ON app.members;
CREATE TRIGGER members_updated_at BEFORE UPDATE ON app.members FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
DROP TRIGGER IF EXISTS sponsors_updated_at ON app.sponsors;
CREATE TRIGGER sponsors_updated_at BEFORE UPDATE ON app.sponsors FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

INSERT INTO app.settings (setting_key, setting_value) VALUES
  ('club', '{"name":"La Cima Padel Club","currency":"MXN","timezone":"America/Mexico_City"}'),
  ('ticket', '{"header":"La Cima Padel Club","footer":"Gracias por tu visita"}')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO app.roles (code, name, description) VALUES
  ('admin', 'Administrador', 'Acceso completo a la operacion y configuracion.'),
  ('cashier', 'Caja', 'Operacion de punto de venta y turnos de caja.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app.permissions (code, description) VALUES
  ('dashboard.view', 'Consultar el dashboard'),
  ('pos.use', 'Operar el punto de venta'),
  ('cash.open_close', 'Abrir y cerrar turnos de caja'),
  ('inventory.view', 'Consultar inventario'),
  ('inventory.manage', 'Modificar productos y existencias'),
  ('memberships.manage', 'Administrar membresias'),
  ('sponsors.manage', 'Administrar patrocinadores'),
  ('reports.view', 'Consultar reportes'),
  ('users.manage', 'Administrar usuarios y roles'),
  ('settings.manage', 'Administrar configuracion')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app.role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM app.roles r CROSS JOIN app.permissions p
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO app.role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM app.roles r
JOIN app.permissions p ON p.code IN ('dashboard.view', 'pos.use', 'cash.open_close', 'inventory.view')
WHERE r.code = 'cashier'
ON CONFLICT DO NOTHING;

INSERT INTO app.users (role_id, email, full_name, password_hash)
SELECT r.id, 'admin@lacimapadelclub.com', 'Administrador La Cima', crypt('AdminLacima2026!', gen_salt('bf', 12))
FROM app.roles r WHERE r.code = 'admin'
ON CONFLICT (email) DO NOTHING;

INSERT INTO app.users (role_id, email, full_name, password_hash)
SELECT r.id, 'caja@lacimapadelclub.com', 'Caja La Cima', crypt('CajaLacima2026!', gen_salt('bf', 12))
FROM app.roles r WHERE r.code = 'cashier'
ON CONFLICT (email) DO NOTHING;

INSERT INTO app.cash_registers (code, name, location)
VALUES ('CAJA-01', 'Caja principal', 'Recepcion')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app.product_categories (name) VALUES
  ('Bebidas'), ('Snacks'), ('Equipo'), ('Ropa'), ('Servicios')
ON CONFLICT (name) DO NOTHING;

INSERT INTO app.products (sku, name, category_id, unit_price, stock, minimum_stock, track_stock)
SELECT seed.sku, seed.name, c.id, seed.unit_price, seed.stock, seed.minimum_stock, seed.track_stock
FROM (VALUES
  ('7501001', 'Agua Mineral 600ml', 'Bebidas', 25.00, 84.000, 24.000, true),
  ('7501002', 'Bebida Isotonica', 'Bebidas', 38.00, 12.000, 20.000, true),
  ('7501003', 'Cerveza Artesanal', 'Bebidas', 65.00, 40.000, 12.000, true),
  ('7501004', 'Barra Proteina', 'Snacks', 45.00, 6.000, 15.000, true),
  ('7501005', 'Mix de Nueces', 'Snacks', 55.00, 30.000, 10.000, true),
  ('7501006', 'Bote de Pelotas x3', 'Equipo', 180.00, 22.000, 8.000, true),
  ('7501007', 'Grip Overgrip', 'Equipo', 90.00, 4.000, 10.000, true),
  ('7501008', 'Pala La Cima Pro', 'Equipo', 3200.00, 9.000, 3.000, true),
  ('7501009', 'Playera Oficial', 'Ropa', 420.00, 18.000, 6.000, true),
  ('7501010', 'Gorra La Cima', 'Ropa', 280.00, 25.000, 8.000, true),
  ('7501011', 'Renta de Cancha 90 min', 'Servicios', 600.00, 999.000, 0.000, false),
  ('7501012', 'Clase Particular', 'Servicios', 500.00, 999.000, 0.000, false),
  ('7501013', 'Toalla Deportiva', 'Ropa', 160.00, 14.000, 6.000, true),
  ('7501014', 'Cafe Americano', 'Bebidas', 35.00, 60.000, 20.000, true),
  ('7501015', 'Sandwich Club', 'Snacks', 95.00, 8.000, 10.000, true)
) AS seed(sku, name, category, unit_price, stock, minimum_stock, track_stock)
JOIN app.product_categories c ON c.name = seed.category
ON CONFLICT (sku) DO NOTHING;

INSERT INTO app.sponsors (company_name, contact_name, tier, starts_on, ends_on, contract_amount, benefit_hours)
VALUES
  ('Adrenalina Sports', 'M. Reyes', 'Platino', '2026-01-01', '2026-12-31', 250000, 120),
  ('Cumbre Bebidas', 'J. Pena', 'Oro', '2026-03-01', '2027-02-28', 140000, 80),
  ('Altura Wear', 'S. Gomez', 'Plata', '2026-05-15', '2026-11-15', 60000, 40),
  ('Pico Nutrition', 'R. Vela', 'Oro', '2026-02-01', '2027-01-31', 120000, 80)
ON CONFLICT DO NOTHING;

COMMIT;

-- Initial credentials (change them after the first login):
-- admin@lacimapadelclub.com / AdminLacima2026!
-- caja@lacimapadelclub.com / CajaLacima2026!