BEGIN;

CREATE TABLE IF NOT EXISTS memory_cards (
  id BIGSERIAL PRIMARY KEY,
  agent_role TEXT NOT NULL REFERENCES roles(role_id),
  user_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  source_action_id TEXT,
  CONSTRAINT memory_cards_source_action_fk
    FOREIGN KEY (source_action_id)
    REFERENCES actions_log(action_id)
    ON DELETE SET NULL,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_memory_cards_user_created
  ON memory_cards(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_cards_agent_user_created
  ON memory_cards(agent_role, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_memory_cards_expires
  ON memory_cards(expires_at);

COMMIT;
