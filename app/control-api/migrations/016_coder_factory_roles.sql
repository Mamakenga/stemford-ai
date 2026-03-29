BEGIN;

INSERT INTO roles (role_id, title, domain, status)
VALUES
  ('executor', 'Executor', 'coder_factory', 'active'),
  ('reviewer', 'Reviewer', 'coder_factory', 'active'),
  ('deployer', 'Deployer', 'coder_factory', 'active')
ON CONFLICT (role_id) DO UPDATE
SET title = EXCLUDED.title,
    domain = EXCLUDED.domain,
    status = EXCLUDED.status;

INSERT INTO org_edges (manager_role_id, child_role_id, relation_type)
VALUES
  ('orchestrator', 'executor', 'reports_to'),
  ('orchestrator', 'reviewer', 'reports_to'),
  ('orchestrator', 'deployer', 'reports_to')
ON CONFLICT DO NOTHING;

INSERT INTO handoff_policies (caller_role_id, callee_role_id, allowed, notes)
VALUES
  ('orchestrator', 'executor', true, 'direct'),
  ('orchestrator', 'reviewer', true, 'direct'),
  ('orchestrator', 'deployer', true, 'direct'),
  ('executor', 'orchestrator', true, 'return'),
  ('reviewer', 'orchestrator', true, 'return'),
  ('deployer', 'orchestrator', true, 'return')
ON CONFLICT (caller_role_id, callee_role_id) DO UPDATE
SET allowed = EXCLUDED.allowed,
    notes = EXCLUDED.notes;

COMMIT;
