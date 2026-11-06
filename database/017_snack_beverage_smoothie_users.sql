BEGIN;

INSERT INTO app.product_categories (name)
VALUES ('Licuados')
ON CONFLICT (name) DO NOTHING;

UPDATE app.roles
SET name = 'Snack y Bebidas',
    description = 'Punto de venta limitado a productos de las categorías Snacks y Bebidas.'
WHERE code = 'snacks';

UPDATE app.roles
SET name = 'Licuados',
    description = 'Punto de venta limitado a productos de la categoría Licuados.'
WHERE code = 'beverages';

UPDATE app.users u
SET username = 'Snack y Bebidas',
    full_name = 'Snack y Bebidas',
    updated_at = now()
FROM app.roles r
WHERE u.role_id = r.id
  AND r.code = 'snacks'
  AND lower(u.username) = 'snacks';

UPDATE app.users u
SET username = 'Licuados',
    full_name = 'Licuados',
    updated_at = now()
FROM app.roles r
WHERE u.role_id = r.id
  AND r.code = 'beverages'
  AND lower(u.username) = 'bebidas';

COMMIT;
