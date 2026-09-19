-- Instalacion completa de la base de datos La Cima Padel Club.
-- Ejecutar desde la raiz del proyecto:
-- psql -U postgres -d lacima -f database/000_install_all.sql
\ir 001_initial_schema.sql
\ir 002_memberships.sql
\ir 003_sponsors.sql
\ir 004_operations.sql
\ir 005_usernames_and_folios.sql
\ir 006_catalog_updates.sql
\ir 007_admin_and_passwords.sql
\ir 008_cashier_pos_only.sql
