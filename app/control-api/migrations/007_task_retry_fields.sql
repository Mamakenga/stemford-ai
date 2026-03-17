BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS retry_attempt INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_retry_queue
  ON tasks(status, retry_after);

COMMIT;
