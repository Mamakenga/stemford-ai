BEGIN;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS quality_checks_required JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_checks_passed JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_quality_checks_required_array'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_quality_checks_required_array
      CHECK (jsonb_typeof(quality_checks_required) = 'array');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_quality_checks_passed_array'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_quality_checks_passed_array
      CHECK (jsonb_typeof(quality_checks_passed) = 'array');
  END IF;
END$$;

COMMIT;
