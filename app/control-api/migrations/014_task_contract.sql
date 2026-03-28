BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS task_contract JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_task_contract_object'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_task_contract_object
      CHECK (jsonb_typeof(task_contract) = 'object');
  END IF;
END$$;

UPDATE tasks
SET task_contract = jsonb_build_object(
  'goal', title,
  'scope', 'Implement only the requested change for this task.',
  'forbidden_changes', '[]'::jsonb,
  'definition_of_done', jsonb_build_array(
    'Requested change is implemented',
    'Result is visible in the relevant API or interface',
    'No critical review blockers remain'
  ),
  'required_checks', COALESCE(quality_checks_required, '[]'::jsonb),
  'risk_level', 'medium',
  'stage_summary', 'Initial task contract generated from the task title'
)
WHERE task_contract = '{}'::jsonb;

COMMIT;
