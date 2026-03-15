CREATE OR REPLACE FUNCTION log_task_status_change()
RETURNS trigger AS $$
DECLARE
  actor TEXT;
BEGIN
  actor := current_setting('app.current_actor', true);
  IF actor IS NULL OR actor = '' THEN
    actor := 'system';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO actions_log (
      action_id, action_type, entity_type, entity_id, actor_role, run_id, idempotency_key, payload, timestamp
    ) VALUES (
      'act_' || extract(epoch from clock_timestamp())::bigint || '_' || substr(md5(random()::text),1,6),
      'task_status_changed',
      'task',
      NEW.id,
      actor,
      NULL,
      NULL,
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'reason', NEW.status_reason),
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
