BEGIN;

-- Fernanda queda vinculada explícitamente al rol de administrador.
UPDATE app.users
SET role_id = (SELECT id FROM app.roles WHERE code = 'admin'),
    full_name = 'Fernanda',
    active = true,
    username = 'Fernanda'
WHERE lower(username) = 'fernanda'
   OR lower(full_name) = 'fernanda'
   OR lower(email) = 'admin@lacimapadelclub.com';

CREATE OR REPLACE FUNCTION app.change_user_password(
  p_username text,
  p_new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
BEGIN
  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres';
  END IF;

  UPDATE app.users
  SET password_hash = crypt(p_new_password, gen_salt('bf', 12)),
      updated_at = now()
  WHERE lower(username) = lower(trim(p_username));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el usuario: %', p_username;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION app.change_user_password(text, text) FROM PUBLIC;

COMMIT;

-- Cambiar una contraseña manualmente desde psql:
-- SELECT app.change_user_password('Fernanda', 'EscribeAquiUnaNuevaClave');
-- SELECT app.change_user_password('Denisse', 'EscribeAquiUnaNuevaClave');
-- La contraseña no se guarda: sólo se almacena su hash bcrypt.