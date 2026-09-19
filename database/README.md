# Base de datos

`000_install_all.sql` ejecuta todas las migraciones en el orden correcto.
`001_initial_schema.sql` crea el esquema inicial de La Cima Padel Club en PostgreSQL.
`002_memberships.sql` agrega pagos, eventos de historial e índices de membresías.
`003_sponsors.sql` agrega beneficios, pagos, eventos, mercancía e historial de patrocinadores.
`004_operations.sql` agrega precios operativos, promoción de cancha, usuarios de caja y turnos.
`005_usernames_and_folios.sql` cambia el acceso a nombres de usuario y prepara folios de seis dígitos.
`006_catalog_updates.sql` actualiza los tiers a Embajador/Socio y deja Mensual como único plan activo.
`007_admin_and_passwords.sql` asigna a Fernanda como Administrador y crea la función segura para cambiar contraseñas con hash bcrypt.
`008_cashier_pos_only.sql` limita el rol Caja al punto de venta y sus turnos.

## Aplicar la migracion

Desde la raiz del proyecto, con una base creada previamente:

```powershell
psql -U postgres -d lacima -f database/000_install_all.sql
```

También puedes ejecutarlas individualmente:

```powershell
psql -U postgres -d lacima -f database/001_initial_schema.sql
psql -U postgres -d lacima -f database/002_memberships.sql
psql -U postgres -d lacima -f database/003_sponsors.sql
psql -U postgres -d lacima -f database/004_operations.sql
psql -U postgres -d lacima -f database/005_usernames_and_folios.sql
psql -U postgres -d lacima -f database/006_catalog_updates.sql
psql -U postgres -d lacima -f database/007_admin_and_passwords.sql
psql -U postgres -d lacima -f database/008_cashier_pos_only.sql
```

La migracion es repetible y no borra datos existentes. Requiere permiso para crear la extension `pgcrypto`.

## Usuarios iniciales

Son usuarios de la aplicacion almacenados en `app.users`. El acceso utiliza `username`, no correo electrónico:

| Rol | Usuario | Contrasena inicial |
| --- | --- | --- |
| Administrador | `Fernanda` | `AdminLacima2026!` |
| Caja | `Denisse` | `CajaDenisse2026!` |
| Caja | `Paola` | `CajaPaola2026!` |
| Caja | `Jenny` | `CajaJenny2026!` |
| Caja | `Andrea` | `CajaAndrea2026!` |

Cambia las contrasenas antes de usar la aplicacion en un entorno real. Las contrasenas no se guardan en texto plano: el script las convierte a `bcrypt` mediante `pgcrypto`.

## Verificacion

```sql
SELECT code, name FROM app.roles ORDER BY code;
SELECT username, full_name, active FROM app.users ORDER BY username;
SELECT sku, name, stock, minimum_stock FROM app.products ORDER BY sku;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'app' ORDER BY table_name;
SELECT name, duration_months, price FROM app.membership_plans ORDER BY price;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'app' AND table_name LIKE 'membership%' ORDER BY table_name;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'app' AND table_name LIKE 'sponsor%' ORDER BY table_name;
SELECT code, name, days_of_week, starts_at, ends_at FROM app.cash_shifts ORDER BY code;
SELECT p.name, p.unit_price, pr.name AS promotion, pr.buy_quantity, pr.pay_quantity
FROM app.products p LEFT JOIN app.product_promotions pr ON pr.product_id = p.id
WHERE p.sku IN ('7501011', '7501012', '7501016');
SELECT username, full_name, active FROM app.users ORDER BY username;
SELECT folio, folio_sequence FROM app.sales ORDER BY folio_sequence;
SELECT r.code AS role, rp.permission_code
FROM app.roles r JOIN app.role_permissions rp ON rp.role_id = r.id
WHERE r.code IN ('admin', 'cashier') ORDER BY r.code, rp.permission_code;
```

## Cambiar contraseñas manualmente

Aplica primero la migración `007` y después ejecuta una sentencia por usuario desde `psql`:

```sql
SELECT app.change_user_password('Fernanda', 'NUEVA_CONTRASENA_SEGURA');
SELECT app.change_user_password('Denisse', 'NUEVA_CONTRASENA_SEGURA');
```

Reemplaza los valores antes de ejecutar. La contraseña se transforma con `crypt(..., gen_salt('bf', 12))`; en `app.users.password_hash` sólo queda el hash bcrypt. La función exige al menos 8 caracteres y falla si el usuario no existe.

La interfaz actual aun usa datos mock y `sessionStorage`; este script prepara la persistencia, pero para autenticar contra PostgreSQL hace falta agregar una API/ORM al proyecto y reemplazar esa validacion del frontend.