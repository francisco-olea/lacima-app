BEGIN;

DELETE FROM app.role_permissions
WHERE role_id = (SELECT id FROM app.roles WHERE code = 'cashier')
  AND permission_code NOT IN ('pos.use', 'cash.open_close');

INSERT INTO app.role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM app.roles r
JOIN app.permissions p ON p.code IN ('pos.use', 'cash.open_close')
WHERE r.code = 'cashier'
ON CONFLICT DO NOTHING;

COMMIT;

-- El rol cashier sólo puede operar el punto de venta y sus turnos de caja.