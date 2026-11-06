BEGIN;

INSERT INTO app.roles (code, name, description) VALUES
  ('snacks', 'Snacks', 'Punto de venta limitado a productos de la categoría Snacks.'),
  ('beverages', 'Bebidas', 'Punto de venta limitado a productos de la categoría Bebidas.')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO app.role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM app.roles r
CROSS JOIN app.permissions p
WHERE r.code IN ('snacks', 'beverages')
  AND p.code IN ('pos.use', 'cash.open_close')
ON CONFLICT DO NOTHING;

INSERT INTO app.users (role_id, email, username, full_name, password_hash)
SELECT r.id, NULL, seed.username, seed.full_name,
       crypt(gen_random_uuid()::text, gen_salt('bf', 12))
FROM (VALUES
  ('Snacks', 'Snacks', 'snacks'),
  ('Bebidas', 'Bebidas', 'beverages')
) AS seed(username, full_name, role_code)
JOIN app.roles r ON r.code = seed.role_code
WHERE NOT EXISTS (
  SELECT 1
  FROM app.users u
  WHERE u.role_id = r.id
)
ON CONFLICT DO NOTHING;

COMMIT;

-- Cambia las contrasenas de estos usuarios desde Configuracion > Usuarios antes de iniciar sesion.
