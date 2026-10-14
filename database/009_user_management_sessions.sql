BEGIN;

CREATE TABLE IF NOT EXISTS app.user_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx
  ON app.user_sessions (user_id);

DROP INDEX IF EXISTS app.users_username_idx;
CREATE UNIQUE INDEX users_username_idx
  ON app.users (lower(username))
  WHERE username IS NOT NULL AND active = true;

COMMIT;
