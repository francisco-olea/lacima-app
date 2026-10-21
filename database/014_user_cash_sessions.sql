DROP INDEX IF EXISTS app.one_open_session_per_register;

CREATE UNIQUE INDEX IF NOT EXISTS one_open_session_per_user_and_register
  ON app.cash_sessions(register_id, opened_by) WHERE status = 'open';
