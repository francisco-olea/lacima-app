# Base de datos

`001_initial_schema.sql` crea el esquema inicial de La Cima Padel Club en PostgreSQL.
`002_memberships.sql` agrega pagos, eventos de historial e índices de membresías.
`003_sponsors.sql` agrega beneficios, pagos, eventos, mercancía e historial de patrocinadores.
`004_operations.sql` agrega precios operativos, promoción de cancha, usuarios de caja y turnos.

## Aplicar la migracion

Desde la raiz del proyecto, con una base creada previamente:

```powershell
psql -U postgres -d lacima -f database/001_initial_schema.sql
psql -U postgres -d lacima -f database/002_memberships.sql
psql -U postgres -d lacima -f database/003_sponsors.sql
psql -U postgres -d lacima -f database/004_operations.sql
```

La migracion es repetible y no borra datos existentes. Requiere permiso para crear la extension `pgcrypto`.

## Usuarios iniciales

Son usuarios de la aplicacion almacenados en `app.users`:

| Rol | Correo | Contrasena inicial |
| --- | --- | --- |
| Administrador | `admin@lacimapadelclub.com` | `AdminLacima2026!` |
| Caja | `caja@lacimapadelclub.com` | `CajaLacima2026!` |

Cambia ambas contrasenas antes de usar la aplicacion en un entorno real. Las contrasenas no se guardan en texto plano: el script las convierte a `bcrypt` mediante `pgcrypto`.

## Verificacion

```sql
SELECT code, name FROM app.roles ORDER BY code;
SELECT email, full_name, active FROM app.users ORDER BY email;
SELECT sku, name, stock, minimum_stock FROM app.products ORDER BY sku;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'app' ORDER BY table_name;
SELECT name, duration_months, price FROM app.membership_plans ORDER BY price;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'app' AND table_name LIKE 'membership%' ORDER BY table_name;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'app' AND table_name LIKE 'sponsor%' ORDER BY table_name;
SELECT code, name, days_of_week, starts_at, ends_at FROM app.cash_shifts ORDER BY code;
SELECT full_name, email FROM app.users WHERE email LIKE '%@lacimapadelclub.com' ORDER BY full_name;
SELECT p.name, p.unit_price, pr.name AS promotion, pr.buy_quantity, pr.pay_quantity
FROM app.products p LEFT JOIN app.product_promotions pr ON pr.product_id = p.id
WHERE p.sku IN ('7501011', '7501012', '7501016');
```

La interfaz actual aun usa datos mock y `sessionStorage`; este script prepara la persistencia, pero para autenticar contra PostgreSQL hace falta agregar una API/ORM al proyecto y reemplazar esa validacion del frontend.