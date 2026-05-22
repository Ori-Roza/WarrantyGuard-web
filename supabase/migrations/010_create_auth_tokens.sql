CREATE TABLE auth_tokens (
  token TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES profiles(user_id),
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_tokens_token ON auth_tokens(token);
CREATE INDEX idx_auth_tokens_user_id ON auth_tokens(user_id);

ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read auth tokens by token"
  ON auth_tokens FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update auth tokens by token"
  ON auth_tokens FOR UPDATE
  USING (true);
