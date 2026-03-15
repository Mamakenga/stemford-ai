const express = require("express");
const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: "/opt/stemford/run/.env" });

const app = express();
app.use(express.json());

const port = Number(process.env.CONTROL_API_PORT || 3210);
const conn = process.env.RAILWAY_DATABASE_URL;

if (!conn) {
  console.error("RAILWAY_DATABASE_URL is missing in /opt/stemford/run/.env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: conn,
  ssl: { rejectUnauthorized: false },
});

const ok = (res, data) =>
  res.json({ ok: true, data, meta: { schema_version: "v1", ts: new Date().toISOString() } });

const fail = (res, status, code, message) =>
  res.status(status).json({ ok: false, error: { code, message }, meta: { schema_version: "v1", ts: new Date().toISOString() } });

app.get("/health", (_req, res) => ok(res, { service: "stemford-control-api", port }));

app.get("/db/ping", async (_req, res) => {
  try {
    const r = await pool.query("select now() as ts");
    ok(res, { db: "up", ts: r.rows[0].ts });
  } catch (e) {
    fail(res, 500, "db_down", e.message);
  }
});

app.get("/org/chart", async (_req, res) => {
  try {
    const roles = await pool.query(
      "select role_id,title,domain,status from roles order by role_id"
    );
    const edges = await pool.query(
      "select manager_role_id,child_role_id,relation_type from org_edges order by manager_role_id,child_role_id"
    );
    ok(res, { roles: roles.rows, edges: edges.rows });
  } catch (e) {
    fail(res, 500, "org_chart_failed", e.message);
  }
});

app.post("/handoff/validate", async (req, res) => {
  const { caller_role_id, callee_role_id } = req.body || {};
  if (!caller_role_id || !callee_role_id) {
    return fail(res, 400, "validation_error", "caller_role_id and callee_role_id are required");
  }

  try {
    const q = await pool.query(
      `select allowed, notes
       from handoff_policies
       where caller_role_id = $1 and callee_role_id = $2`,
      [caller_role_id, callee_role_id]
    );

    if (q.rowCount === 0) {
      return ok(res, {
        caller_role_id,
        callee_role_id,
        allowed: false,
        reason: "no_policy",
      });
    }

    const row = q.rows[0];
    ok(res, {
      caller_role_id,
      callee_role_id,
      allowed: row.allowed,
      reason: row.notes || null,
    });
  } catch (e) {
    fail(res, 500, "handoff_validate_failed", e.message);
  }
});

app.get("/goals/:id/ancestry", async (req, res) => {
  const goalId = req.params.id;
  try {
    const q = await pool.query(
      `
      WITH RECURSIVE ancestors AS (
        SELECT id,parent_id,title,stage,status,0 as depth
        FROM goals
        WHERE id = $1
        UNION ALL
        SELECT g.id,g.parent_id,g.title,g.stage,g.status,a.depth+1
        FROM goals g
        JOIN ancestors a ON g.id = a.parent_id
      )
      SELECT depth,id,parent_id,title,stage,status
      FROM ancestors
      ORDER BY depth
      `,
      [goalId]
    );

    if (q.rowCount === 0) {
      return fail(res, 404, "not_found", `goal ${goalId} not found`);
    }

    ok(res, { goal_id: goalId, chain: q.rows });
  } catch (e) {
    fail(res, 500, "ancestry_failed", e.message);
  }
});

app.get("/tasks", async (req, res) => {
  const { status, assignee, goal_id } = req.query;
  const where = [];
  const vals = [];

  if (status) {
    vals.push(status);
    where.push(`status = $${vals.length}`);
  }
  if (assignee) {
    vals.push(assignee);
    where.push(`assignee = $${vals.length}`);
  }
  if (goal_id) {
    vals.push(goal_id);
    where.push(`primary_goal_id = $${vals.length}`);
  }

  const sql = `
    select id,title,primary_goal_id,status,assignee,due_at
    from tasks
    ${where.length ? "where " + where.join(" and ") : ""}
    order by due_at nulls last, id
  `;

  try {
    const q = await pool.query(sql, vals);
    ok(res, { count: q.rowCount, tasks: q.rows });
  } catch (e) {
    fail(res, 500, "tasks_query_failed", e.message);
  }
});

app.listen(port, "127.0.0.1", () => {
  console.log(`stemford-control-api listening on 127.0.0.1:${port}`);
});

/* ===== approvals mvp routes ===== */
const APPROVAL_CLASSES = new Set(["safe_read","internal_write","external_comm","financial_change","policy_change"]);
const DEFAULT_APPROVER = {
  external_comm: "strategy",
  financial_change: "finance",
  policy_change: "orchestrator",
};

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

async function writeAction(actionType, entityType, entityId, actorRole, payload) {
  try {
    await pool.query(
      `insert into actions_log (action_id,action_type,entity_type,entity_id,actor_role,run_id,idempotency_key,payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [id("act"), actionType, entityType, entityId, actorRole, null, null, JSON.stringify(payload || {})]
    );
  } catch (e) {
    console.error("actions_log write failed:", e.message);
  }
}

app.post("/approvals/request", async (req, res) => {
  const { action_class, entity_type, entity_id, requested_by_role, approver_role, reason } = req.body || {};

  if (!action_class || !entity_type || !entity_id || !requested_by_role) {
    return fail(res, 400, "validation_error", "action_class, entity_type, entity_id, requested_by_role are required");
  }
  if (!APPROVAL_CLASSES.has(action_class)) {
    return fail(res, 400, "validation_error", `unknown action_class: ${action_class}`);
  }

  const effectiveApprover = approver_role || DEFAULT_APPROVER[action_class];
  if (!effectiveApprover) {
    return fail(res, 400, "validation_error", `no approver policy for action_class=${action_class}`);
  }

  const approval_id = id("apr");

  try {
    await pool.query(
      `insert into approval_requests
       (approval_id, action_class, entity_type, entity_id, requested_by_role, approver_role, status, reason)
       values ($1,$2,$3,$4,$5,$6,'pending',$7)`,
      [approval_id, action_class, entity_type, entity_id, requested_by_role, effectiveApprover, reason || null]
    );

    await writeAction("approval_requested", entity_type, entity_id, requested_by_role, { approval_id, action_class, approver_role: effectiveApprover });

    return ok(res, {
      approval_id,
      status: "pending",
      action_class,
      entity_type,
      entity_id,
      requested_by_role,
      approver_role: effectiveApprover
    });
  } catch (e) {
    return fail(res, 500, "approval_request_failed", e.message);
  }
});

app.get("/approvals/pending", async (req, res) => {
  const approver_role = req.query.approver_role;
  const where = approver_role ? "where status='pending' and approver_role=$1" : "where status='pending'";
  const vals = approver_role ? [approver_role] : [];
  try {
    const q = await pool.query(
      `select approval_id,action_class,entity_type,entity_id,requested_by_role,approver_role,status,created_at
       from approval_requests
       ${where}
       order by created_at asc`,
      vals
    );
    return ok(res, { count: q.rowCount, items: q.rows });
  } catch (e) {
    return fail(res, 500, "approval_pending_failed", e.message);
  }
});

app.post("/approvals/decide", async (req, res) => {
  const { approval_id, decision, decided_by_role, reason } = req.body || {};
  if (!approval_id || !decision || !decided_by_role) {
    return fail(res, 400, "validation_error", "approval_id, decision, decided_by_role are required");
  }
  if (!["approved","rejected"].includes(decision)) {
    return fail(res, 400, "validation_error", "decision must be approved or rejected");
  }

  try {
    const q = await pool.query(
      `update approval_requests
       set status=$1, decided_at=now(), decided_by_role=$2, reason=coalesce($3,reason)
       where approval_id=$4 and status='pending' and approver_role=$2
       returning approval_id,action_class,entity_type,entity_id,requested_by_role,approver_role,status,reason,decided_at,decided_by_role`,
      [decision, decided_by_role, reason || null, approval_id]
    );

    if (q.rowCount === 0) {
      return fail(res, 404, "not_found_or_not_allowed", "pending approval not found for this approver");
    }

    const row = q.rows[0];
    await writeAction(`approval_${decision}`, row.entity_type, row.entity_id, decided_by_role, { approval_id: row.approval_id, reason: row.reason || null });

    return ok(res, row);
  } catch (e) {
    return fail(res, 500, "approval_decide_failed", e.message);
  }
});
