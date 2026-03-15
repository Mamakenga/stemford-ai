BEGIN;

CREATE TABLE IF NOT EXISTS roles (
  role_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','inactive'))
);

CREATE TABLE IF NOT EXISTS org_edges (
  manager_role_id TEXT NOT NULL REFERENCES roles(role_id),
  child_role_id TEXT NOT NULL REFERENCES roles(role_id),
  relation_type TEXT NOT NULL CHECK (relation_type = 'reports_to'),
  PRIMARY KEY (manager_role_id, child_role_id, relation_type)
);

CREATE TABLE IF NOT EXISTS handoff_policies (
  caller_role_id TEXT NOT NULL REFERENCES roles(role_id),
  callee_role_id TEXT NOT NULL REFERENCES roles(role_id),
  allowed BOOLEAN NOT NULL,
  notes TEXT,
  PRIMARY KEY (caller_role_id, callee_role_id)
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES goals(id),
  stage TEXT CHECK (stage IN ('A','B','C')),
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','paused','done')),
  kpi_name TEXT,
  kpi_target TEXT,
  due_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (id <> parent_id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  primary_goal_id TEXT NOT NULL REFERENCES goals(id),
  status TEXT NOT NULL CHECK (status IN ('backlog','todo','in_progress','blocked','done','failed')),
  assignee TEXT NOT NULL REFERENCES roles(role_id),
  due_at TIMESTAMPTZ,
  status_reason TEXT
);

CREATE TABLE IF NOT EXISTS task_goal_links (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('secondary')),
  PRIMARY KEY (task_id, goal_id, link_type)
);

CREATE TABLE IF NOT EXISTS approval_requests (
  approval_id TEXT PRIMARY KEY,
  action_class TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  requested_by_role TEXT NOT NULL REFERENCES roles(role_id),
  approver_role TEXT NOT NULL REFERENCES roles(role_id),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  reason TEXT,
  decided_at TIMESTAMPTZ,
  decided_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actions_log (
  action_id TEXT PRIMARY KEY,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  run_id TEXT,
  idempotency_key TEXT UNIQUE,
  payload JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at ON tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_goals_stage_status ON goals(stage, status);
CREATE INDEX IF NOT EXISTS idx_actions_timestamp ON actions_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_approvals_status_role ON approval_requests(status, approver_role, created_at);

INSERT INTO roles (role_id, title, domain, status) VALUES
  ('orchestrator', 'Orchestrator', 'orchestration', 'active'),
  ('strategy', 'Strategy Gatekeeper', 'strategy', 'active'),
  ('finance', 'Finance KPI', 'finance', 'active'),
  ('pmo', 'PMO', 'pmo', 'active')
ON CONFLICT (role_id) DO UPDATE
SET title=EXCLUDED.title, domain=EXCLUDED.domain, status=EXCLUDED.status;

INSERT INTO org_edges (manager_role_id, child_role_id, relation_type) VALUES
  ('orchestrator','strategy','reports_to'),
  ('orchestrator','finance','reports_to'),
  ('orchestrator','pmo','reports_to')
ON CONFLICT DO NOTHING;

INSERT INTO handoff_policies (caller_role_id, callee_role_id, allowed, notes) VALUES
  ('orchestrator','strategy', true,  'direct'),
  ('orchestrator','finance',  true,  'direct'),
  ('orchestrator','pmo',      true,  'direct'),
  ('strategy','orchestrator', true,  'return'),
  ('finance','orchestrator',  true,  'return'),
  ('pmo','orchestrator',      true,  'return'),
  ('finance','pmo',           false, 'via orchestrator'),
  ('strategy','finance',      false, 'via orchestrator'),
  ('pmo','strategy',          false, 'via orchestrator')
ON CONFLICT (caller_role_id, callee_role_id) DO UPDATE
SET allowed=EXCLUDED.allowed, notes=EXCLUDED.notes;

INSERT INTO goals (id, parent_id, stage, title, status, kpi_name, kpi_target)
VALUES
  ('mission_stemford', NULL, NULL, 'Mission: независимая STEM-школа в Болгарии', 'active', 'students_retention', '>=85%'),
  ('stage_a_repositioning', 'mission_stemford', 'A', 'Stage A: Repositioning', 'active', 'conversion_to_trial', '>=20%'),
  ('stage_b_rebranding', 'mission_stemford', 'B', 'Stage B: Rebranding', 'active', 'parent_trust_index', '>=80'),
  ('stage_c_operations', 'mission_stemford', 'C', 'Stage C: Operations Modernization', 'active', 'monthly_margin', '>=25%'),
  ('goal_a_positioning_brief', 'stage_a_repositioning', 'A', 'A1 Positioning Brief v1', 'active', 'conversion_to_trial', '>=20%'),
  ('goal_b_brand_rollout', 'stage_b_rebranding', 'B', 'B1 Brand rollout plan', 'active', 'parent_trust_index', '>=80'),
  ('goal_c_ops_dashboard', 'stage_c_operations', 'C', 'C1 Ops KPI dashboard', 'active', 'monthly_margin', '>=25%')
ON CONFLICT (id) DO UPDATE
SET parent_id=EXCLUDED.parent_id,
    stage=EXCLUDED.stage,
    title=EXCLUDED.title,
    status=EXCLUDED.status,
    kpi_name=EXCLUDED.kpi_name,
    kpi_target=EXCLUDED.kpi_target;

COMMIT;
