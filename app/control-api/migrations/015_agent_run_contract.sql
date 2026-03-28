BEGIN;

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS run_contract JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agent_runs_run_contract_object'
  ) THEN
    ALTER TABLE agent_runs
      ADD CONSTRAINT agent_runs_run_contract_object
      CHECK (jsonb_typeof(run_contract) = 'object');
  END IF;
END$$;

UPDATE agent_runs
SET run_contract = jsonb_build_object(
  'role', role,
  'task_id', COALESCE(payload->>'task_id', NULL),
  'stage_id', COALESCE(payload->>'stage_id', 'legacy:unassigned'),
  'input_context', jsonb_build_object(
    'legacy_payload', COALESCE(payload, '{}'::jsonb)
  ),
  'allowed_tools', '[]'::jsonb,
  'required_output_format', jsonb_build_object(
    'format_id', 'legacy_payload',
    'required_fields', jsonb_build_array('summary')
  ),
  'timeout_budget_sec', COALESCE(max_run_timeout_sec, 300),
  'fallback_policy', jsonb_build_object(
    'mode', 'role_chain',
    'max_attempts', 3
  )
)
WHERE run_contract = '{}'::jsonb;

COMMIT;
