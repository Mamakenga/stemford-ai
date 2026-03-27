BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_step_order INTEGER,
  ADD COLUMN IF NOT EXISTS requires_start_approval BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_end_approval BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS start_gate_approval_id TEXT,
  ADD COLUMN IF NOT EXISTS start_gate_status TEXT,
  ADD COLUMN IF NOT EXISTS end_gate_approval_id TEXT,
  ADD COLUMN IF NOT EXISTS end_gate_status TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_plan_step_order_positive'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_plan_step_order_positive
      CHECK (plan_step_order IS NULL OR plan_step_order > 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_start_gate_status_valid'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_start_gate_status_valid
      CHECK (start_gate_status IS NULL OR start_gate_status IN ('pending','approved','rejected'));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_end_gate_status_valid'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_end_gate_status_valid
      CHECK (end_gate_status IS NULL OR end_gate_status IN ('pending','approved','rejected'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_tasks_plan_order
  ON tasks(plan_id, plan_step_order);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created
  ON chat_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_task
  ON chat_messages(task_id, created_at DESC);

INSERT INTO roles (role_id, title, domain, status)
VALUES ('human_telegram', 'Human Telegram Operator', 'operations', 'active')
ON CONFLICT (role_id) DO UPDATE
SET title = EXCLUDED.title,
    domain = EXCLUDED.domain,
    status = EXCLUDED.status;

COMMIT;
