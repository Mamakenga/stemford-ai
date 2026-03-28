BEGIN;

CREATE TABLE IF NOT EXISTS review_findings (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('p1','p2')),
  title TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_by_role TEXT NOT NULL REFERENCES roles(role_id),
  resolved_by_role TEXT REFERENCES roles(role_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_review_findings_task
  ON review_findings(task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_findings_open
  ON review_findings(task_id, status, severity);

COMMIT;
