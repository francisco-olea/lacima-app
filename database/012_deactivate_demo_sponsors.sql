BEGIN;

UPDATE app.sponsors
SET active = false,
    updated_at = now()
WHERE active = true
  AND (company_name, contact_name, starts_on, ends_on, contract_amount, benefit_hours) IN (
    ('Adrenalina Sports', 'M. Reyes', DATE '2026-01-01', DATE '2026-12-31', 250000, 120),
    ('Cumbre Bebidas', 'J. Pena', DATE '2026-03-01', DATE '2027-02-28', 140000, 80),
    ('Altura Wear', 'S. Gomez', DATE '2026-05-15', DATE '2026-11-15', 60000, 40),
    ('Pico Nutrition', 'R. Vela', DATE '2026-02-01', DATE '2027-01-31', 120000, 80)
  );

COMMIT;
