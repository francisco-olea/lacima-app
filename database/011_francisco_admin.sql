BEGIN;

INSERT INTO app.users (role_id, username, full_name, password_hash, email, active)
SELECT r.id,
       'Francisco',
       'Francisco',
       crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf', 12)),
       NULL,
       true
FROM app.roles r
WHERE r.code = 'admin'
ON CONFLICT (lower(username)) WHERE username IS NOT NULL AND active = true
DO UPDATE SET
  role_id = EXCLUDED.role_id,
  full_name = EXCLUDED.full_name,
  active = true,
  updated_at = now();

COMMIT;
