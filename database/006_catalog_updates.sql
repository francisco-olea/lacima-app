BEGIN;

ALTER TABLE app.sponsors DROP CONSTRAINT IF EXISTS sponsors_tier_check;
UPDATE app.sponsors SET tier = 'Embajador' WHERE tier = 'Platino';
UPDATE app.sponsors SET tier = 'Socio' WHERE tier IN ('Oro', 'Plata');
ALTER TABLE app.sponsors
  ADD CONSTRAINT sponsors_tier_check CHECK (tier IN ('Embajador', 'Socio'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM app.membership_plans WHERE name = 'Esencial')
    AND NOT EXISTS (SELECT 1 FROM app.membership_plans WHERE name = 'Mensual') THEN
    UPDATE app.membership_plans SET name = 'Mensual' WHERE name = 'Esencial';
  ELSIF EXISTS (SELECT 1 FROM app.membership_plans WHERE name = 'Esencial')
    AND EXISTS (SELECT 1 FROM app.membership_plans WHERE name = 'Mensual') THEN
    UPDATE app.memberships old_membership
    SET status = 'cancelled'
    WHERE old_membership.plan_id = (SELECT id FROM app.membership_plans WHERE name = 'Esencial')
      AND old_membership.status = 'active'
      AND EXISTS (
        SELECT 1
        FROM app.memberships current_membership
        WHERE current_membership.member_id = old_membership.member_id
          AND current_membership.plan_id = (SELECT id FROM app.membership_plans WHERE name = 'Mensual')
          AND current_membership.status = 'active'
      );
    UPDATE app.memberships
    SET plan_id = (SELECT id FROM app.membership_plans WHERE name = 'Mensual')
    WHERE plan_id = (SELECT id FROM app.membership_plans WHERE name = 'Esencial');
    DELETE FROM app.membership_plans WHERE name = 'Esencial';
  END IF;
END;
$$;
UPDATE app.membership_plans SET active = false WHERE name <> 'Mensual';

INSERT INTO app.membership_plans (name, duration_months, price, benefits, active)
VALUES ('Mensual', 1, 850.00, '["Acceso al club", "Reservas de cancha"]'::jsonb, true)
ON CONFLICT (name) DO UPDATE SET
  duration_months = EXCLUDED.duration_months,
  price = EXCLUDED.price,
  benefits = EXCLUDED.benefits,
  active = true;

COMMIT;

-- Aplicar despues de las migraciones 001 a 005:
-- psql -U postgres -d lacima -f database/006_catalog_updates.sql