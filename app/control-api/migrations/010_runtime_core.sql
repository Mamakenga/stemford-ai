BEGIN;

-- H-27: Runtime core — agent_runs + processed_triggers
-- Two code paths: acceptTrigger (dedup) and retryRun (bypass dedup)

CREATE TABLE IF NOT EXISTS processed_triggers (
  trigger_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  trigger_id TEXT NOT NULL REFERENCES processed_triggers(trigger_id),
  role TEXT NOT NULL REFERENCES roles(role_id),
  status TEXT NOT NULL CHECK (status IN (
    'pending','running','success','error','timeout','dead_letter'
  )),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  retry_of_run_id TEXT REFERENCES agent_runs(id),
  correlation_id TEXT,
  payload JSONB,
  result JSONB,
  error_message TEXT,
  token_usage JSONB,
  max_run_timeout_sec INTEGER NOT NULL DEFAULT 300,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT agent_runs_attempt_positive CHECK (attempt_number >= 1),
  CONSTRAINT agent_runs_no_self_retry CHECK (id <> retry_of_run_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_trigger ON agent_runs(trigger_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_role_status ON agent_runs(role, status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_correlation ON agent_runs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_retry_of ON agent_runs(retry_of_run_id)
  WHERE retry_of_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_runs_status_created ON agent_runs(status, created_at);

COMMIT;
