BEGIN;

ALTER TABLE app.users
  ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx
  ON app.users (lower(username))
  WHERE username IS NOT NULL;

ALTER TABLE app.users
  ALTER COLUMN email DROP NOT NULL;

UPDATE app.users
SET username = CASE lower(email)
  WHEN 'admin@lacimapadelclub.com' THEN 'Fernanda'
  WHEN 'caja@lacimapadelclub.com' THEN 'Caja'
  WHEN 'denisse@lacimapadelclub.com' THEN 'Denisse'
  WHEN 'paola@lacimapadelclub.com' THEN 'Paola'
  WHEN 'jenny@lacimapadelclub.com' THEN 'Jenny'
  WHEN 'andrea@lacimapadelclub.com' THEN 'Andrea'
  ELSE full_name
END
WHERE username IS NULL;

UPDATE app.users
SET full_name = username,
    email = NULL
WHERE username IS NOT NULL;

ALTER TABLE app.users
  ALTER COLUMN username SET NOT NULL;

ALTER TABLE app.sales
  ADD COLUMN IF NOT EXISTS folio_sequence bigint;

CREATE SEQUENCE IF NOT EXISTS app.ticket_folio_sequence START WITH 1;

UPDATE app.sales
SET folio_sequence = nextval('app.ticket_folio_sequence')
WHERE folio_sequence IS NULL;

ALTER TABLE app.sales
  ALTER COLUMN folio_sequence SET DEFAULT nextval('app.ticket_folio_sequence');

CREATE OR REPLACE FUNCTION app.assign_ticket_folio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.folio_sequence IS NULL THEN
    NEW.folio_sequence := nextval('app.ticket_folio_sequence');
  END IF;
  IF NEW.folio IS NULL OR NEW.folio = '' OR NEW.folio LIKE 'V-%' THEN
    NEW.folio := lpad(NEW.folio_sequence::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

UPDATE app.sales
SET folio = lpad(folio_sequence::text, 6, '0')
WHERE folio_sequence IS NOT NULL;

DO $$
DECLARE
  last_folio bigint;
BEGIN
  SELECT max(folio_sequence) INTO last_folio FROM app.sales;
  IF last_folio IS NOT NULL THEN
    PERFORM setval('app.ticket_folio_sequence', last_folio, true);
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS assign_ticket_folio ON app.sales;
CREATE TRIGGER assign_ticket_folio
BEFORE INSERT ON app.sales
FOR EACH ROW EXECUTE FUNCTION app.assign_ticket_folio();

INSERT INTO app.settings (setting_key, setting_value) VALUES
  ('ticket_folio', '{"format":"000001","next":1}')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

COMMIT;

-- Aplicar despues de 001_initial_schema.sql, 002_memberships.sql,
-- 003_sponsors.sql y 004_operations.sql:
-- psql -U postgres -d lacima -f database/005_usernames_and_folios.sql