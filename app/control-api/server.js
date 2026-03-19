const express = require("express");
const fs = require("fs");
const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: "/opt/stemford/run/.env" });
const PORT = Number(process.env.CONTROL_API_PORT || 3210);
const MAX_RETRY_ATTEMPTS = (() => {
  const raw = Number(process.env.TASK_MAX_RETRY_ATTEMPTS || 5);
  return Number.isInteger(raw) && raw > 0 ? raw : 5;
})();
const MAX_RUN_ATTEMPTS = (() => {
  const raw = Number(process.env.RUNTIME_MAX_RUN_ATTEMPTS || 3);
  return Number.isInteger(raw) && raw > 0 ? raw : 3;
})();
const DEFAULT_RUN_TIMEOUT_SEC = (() => {
  const raw = Number(process.env.RUNTIME_DEFAULT_TIMEOUT_SEC || 300);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 300;
})();
const CONTROL_API_ENFORCE_TOOL_ACCESS = String(process.env.CONTROL_API_ENFORCE_TOOL_ACCESS || "1") !== "0";
const CONTROL_API_ENABLE_HARD_CRITIC = String(process.env.CONTROL_API_ENABLE_HARD_CRITIC || "1") !== "0";
const CONTROL_API_TELEGRAM_WEBHOOK_ENABLED = String(process.env.CONTROL_API_TELEGRAM_WEBHOOK_ENABLED || "1") !== "0";
const STALL_WATCHDOG_THRESHOLD_MIN = (() => {
  const raw = Number(process.env.STALL_WATCHDOG_THRESHOLD_MIN || 120);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 120;
})();
const MEMORY_CARD_DEFAULT_TTL_HOURS = (() => {
  const raw = Number(process.env.MEMORY_CARD_DEFAULT_TTL_HOURS || 168);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 168;
})();
const MEMORY_CARD_SENSITIVE_MAX_TTL_HOURS = (() => {
  const raw = Number(process.env.MEMORY_CARD_SENSITIVE_MAX_TTL_HOURS || 24);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 24;
})();
const STEMFORD_SKILL_PATH = String(
  process.env.CONTROL_API_STEMFORD_SKILL_PATH || "/opt/stemford/skills/stemford-data/SKILL.md"
);

function parseChatIds(raw) {
  return String(raw || "")
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^-?\d+$/.test(x));
}

const TELEGRAM_NOTIFY_TOKEN = String(
  process.env.CONTROL_API_TELEGRAM_BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN ||
  ""
).trim();
const TELEGRAM_NOTIFY_CHAT_IDS = parseChatIds(
  process.env.CONTROL_API_NOTIFY_CHAT_IDS ||
  process.env.TELEGRAM_NOTIFY_CHAT_IDS ||
  process.env.ALLOWED_CHAT_IDS ||
  ""
);
const CRITICAL_TELEGRAM_ACTIONS = new Set(["task_failed", "retry_limit_exceeded", "approval_requested", "run_dead_letter"]);

const app = express();
app.use(express.json());

const conn = process.env.RAILWAY_DATABASE_URL;

if (!conn) {
  console.error("RAILWAY_DATABASE_URL is missing in /opt/stemford/run/.env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: conn,
  ssl: { rejectUnauthorized: false },
  application_name: "control_api",
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const ok = (res, data) =>
  res.json({ ok: true, data, meta: { schema_version: "v1", ts: new Date().toISOString() } });

const fail = (res, status, code, message) =>
  res.status(status).json({ ok: false, error: { code, message }, meta: { schema_version: "v1", ts: new Date().toISOString() } });

function parsePositiveInt(raw, fallback, maxValue) {
  const n = Number.parseInt(String(raw || ""), 10);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, maxValue);
}

function toIsoTimestamp(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString();
}

function parseBoolean(raw, fallback = false) {
  if (raw == null) return fallback;
  const v = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(v)) return true;
  if (["0", "false", "no", "n"].includes(v)) return false;
  return fallback;
}

function parseIsoDatetime(raw) {
  if (!raw) return null;
  const d = new Date(String(raw).trim());
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function escapeLikePattern(raw) {
  return String(raw || "").replace(/[\\%_]/g, "\\$&");
}

function includesSensitiveMarkers(text) {
  const value = String(text || "");
  return /(password|passwd|token|secret|api[_ -]?key|парол|токен|секрет|ключ\s*api)/i.test(value);
}

function toHumanFeedText(row) {
  const payload = row && row.payload && typeof row.payload === "object" ? row.payload : {};
  const actor = row.actor_role || "system";
  const stamp = toIsoTimestamp(row.timestamp);
  const hhmm = stamp ? stamp.slice(11, 16) : "--:--";
  const target = `${row.entity_type}:${row.entity_id}`;

  switch (row.action_type) {
    case "task_created":
      return `[${hhmm}] ${actor} -> создал ${row.entity_id}${payload.title ? ` "${payload.title}"` : ""}`;
    case "task_claimed":
      return `[${hhmm}] ${actor} -> взял в работу ${row.entity_id}`;
    case "task_completed":
      return `[${hhmm}] ${actor} -> завершил ${row.entity_id}`;
    case "task_failed":
      return `[${hhmm}] ${actor} -> провалил ${row.entity_id}${payload.reason ? ` (${payload.reason})` : ""}`;
    case "task_retry_queued":
      return `[${hhmm}] ${actor} -> поставил в повтор ${row.entity_id}${payload.retry_after ? ` (после ${payload.retry_after})` : ""}`;
    case "retry_limit_exceeded":
      return `[${hhmm}] ${actor} -> достиг лимита повторов ${row.entity_id}`;
    case "task_stalled_auto_blocked":
      return `[${hhmm}] ${actor} -> авто-блокировка зависшей ${row.entity_id}`;
    case "approval_requested":
      return `[${hhmm}] ${actor} -> запросил одобрение ${payload.approval_id || row.entity_id}`;
    case "approval_approved":
      return `[${hhmm}] ${actor} -> одобрение подтверждено ${payload.approval_id || row.entity_id}`;
    case "approval_rejected":
      return `[${hhmm}] ${actor} -> одобрение отклонено ${payload.approval_id || row.entity_id}`;
    case "tool_access_denied":
      return `[${hhmm}] ${actor} -> доступ запрещён ${payload.action_key || target}`;
    case "run_accepted":
      return `[${hhmm}] ${actor} -> принят trigger ${payload.trigger_id || target} → run ${row.entity_id}`;
    case "run_started":
      return `[${hhmm}] ${actor} -> запущен run ${row.entity_id}`;
    case "run_completed":
      return `[${hhmm}] ${actor} -> завершён run ${row.entity_id} (${payload.status || "?"})`;
    case "run_retry":
      return `[${hhmm}] ${actor} -> retry run ${row.entity_id} (attempt ${payload.attempt_number || "?"})`;
    case "run_dead_letter":
      return `[${hhmm}] ${actor} -> DEAD LETTER run ${row.entity_id} после ${payload.attempt_number || "?"} попыток`;
    case "trigger_duplicate_skipped":
      return `[${hhmm}] ${actor} -> дубль trigger ${payload.trigger_id || target} пропущен`;
    default:
      return `[${hhmm}] ${actor} -> ${row.action_type} ${target}`;
  }
}

app.get("/health", (_req, res) => ok(res, { service: "stemford-control-api", PORT }));

app.get("/db/ping", async (_req, res) => {
  try {
    const r = await pool.query("select now() as ts");
    ok(res, { db: "up", ts: r.rows[0].ts });
  } catch (e) {
    fail(res, 500, "db_down", e.message);
  }
});

app.get("/readiness", async (_req, res) => {
  let dbUp = false;
  let dbError = null;
  try {
    await pool.query("select 1");
    dbUp = true;
  } catch (e) {
    dbError = e.message;
  }

  const skillPresent = fs.existsSync(STEMFORD_SKILL_PATH);
  const webhookConfigured = !!TELEGRAM_NOTIFY_TOKEN && TELEGRAM_NOTIFY_CHAT_IDS.length > 0;

  const checks = {
    db: dbUp ? { status: "up" } : { status: "down", error: dbError },
    stemford_skill: { status: skillPresent ? "present" : "missing", path: STEMFORD_SKILL_PATH },
    telegram_webhook: {
      enabled: CONTROL_API_TELEGRAM_WEBHOOK_ENABLED,
      configured: webhookConfigured,
      chat_ids: TELEGRAM_NOTIFY_CHAT_IDS.length,
    },
  };

  if (dbUp) {
    return ok(res, { status: "ready", checks });
  }

  return res.status(503).json({
    ok: false,
    data: { status: "unhealthy", checks },
    meta: { schema_version: "v1", ts: new Date().toISOString() },
  });
});

app.get("/diagnostics", async (_req, res) => {
  try {
    const q = await pool.query(
      `
      select
        (select count(*)::int from tasks where status = 'in_progress') as in_progress,
        (select count(*)::int from approval_requests where status = 'pending') as pending_approvals,
        (
          select count(*)::int
          from tasks
          where status = 'in_progress'
            and claimed_at is not null
            and claimed_at < now() - ($1::text || ' minutes')::interval
        ) as stalled_count
      `,
      [STALL_WATCHDOG_THRESHOLD_MIN]
    );

    const row = q.rows[0] || { in_progress: 0, pending_approvals: 0, stalled_count: 0 };
    const webhookConfigured = !!TELEGRAM_NOTIFY_TOKEN && TELEGRAM_NOTIFY_CHAT_IDS.length > 0;

    return ok(res, {
      status: "ok",
      queue: {
        in_progress: row.in_progress,
        pending_approvals: row.pending_approvals,
        stalled_count: row.stalled_count,
        stalled_threshold_min: STALL_WATCHDOG_THRESHOLD_MIN,
      },
      webhook: {
        enabled: CONTROL_API_TELEGRAM_WEBHOOK_ENABLED,
        configured: webhookConfigured,
        chat_ids: TELEGRAM_NOTIFY_CHAT_IDS.length,
      },
      uptime_sec: Math.floor(process.uptime()),
    });
  } catch (e) {
    return fail(res, 500, "diagnostics_failed", e.message);
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
        join ancestors a on g.id = a.parent_id and a.depth < 10
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
    select id,title,primary_goal_id,status,assignee,due_at,retry_attempt,retry_after
    from tasks
    ${where.length ? "where " + where.join(" and ") : ""}
    order by due_at nulls last, id
  `;
  const legacySql = `
    select id,title,primary_goal_id,status,assignee,due_at
    from tasks
    ${where.length ? "where " + where.join(" and ") : ""}
    order by due_at nulls last, id
  `;

  try {
    const q = await pool.query(sql, vals);
    ok(res, { count: q.rowCount, tasks: q.rows });
  } catch (e) {
    const msg = String(e?.message || "");
    const missingRetryColumn = e?.code === "42703" && /retry_attempt|retry_after/i.test(msg);
    if (missingRetryColumn) {
      try {
        const qLegacy = await pool.query(legacySql, vals);
        const tasks = qLegacy.rows.map((row) => ({
          ...row,
          retry_attempt: 0,
          retry_after: null,
        }));
        return ok(res, { count: qLegacy.rowCount, tasks });
      } catch (legacyErr) {
        return fail(res, 500, "tasks_query_failed", legacyErr.message);
      }
    }
    fail(res, 500, "tasks_query_failed", e.message);
  }
});

app.get("/actions/feed", async (req, res) => {
  const format = String(req.query.format || "human").trim().toLowerCase();
  if (!["human", "json"].includes(format)) {
    return fail(res, 400, "validation_error", "format must be 'human' or 'json'");
  }

  const limit = parsePositiveInt(req.query.limit, 20, 100);
  const where = [];
  const vals = [];

  if (req.query.action_type) {
    vals.push(String(req.query.action_type).trim());
    where.push(`action_type = $${vals.length}`);
  }
  if (req.query.actor_role) {
    vals.push(String(req.query.actor_role).trim());
    where.push(`actor_role = $${vals.length}`);
  }
  vals.push(limit);

  try {
    const q = await pool.query(
      `select timestamp,action_type,entity_type,entity_id,actor_role,payload
       from actions_log
       ${where.length ? "where " + where.join(" and ") : ""}
       order by timestamp desc
       limit $${vals.length}`,
      vals
    );

    if (format === "json") {
      const items = q.rows.map((row) => ({
        ...row,
        timestamp: toIsoTimestamp(row.timestamp),
      }));
      return ok(res, { count: items.length, format: "json", items });
    }

    const items = q.rows.map((row) => ({
      timestamp: toIsoTimestamp(row.timestamp),
      action_type: row.action_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      actor_role: row.actor_role,
      text: toHumanFeedText(row),
    }));
    return ok(res, { count: items.length, format: "human", items });
  } catch (e) {
    return fail(res, 500, "actions_feed_failed", e.message);
  }
});

app.post("/memory/cards", async (req, res) => {
  const agent_role = String(req.body?.agent_role || "").trim();
  const user_id = String(req.body?.user_id || "").trim();
  const topic = String(req.body?.topic || "").trim();
  const content = String(req.body?.content || "").trim();
  const is_sensitive = parseBoolean(req.body?.is_sensitive, false);
  const source_action_id = req.body?.source_action_id ? String(req.body.source_action_id).trim() : null;
  const expires_at_raw = req.body?.expires_at ? String(req.body.expires_at).trim() : "";

  if (!agent_role || !user_id || !topic || !content) {
    return fail(res, 400, "validation_error", "agent_role, user_id, topic, content are required");
  }
  if (content.length > 4000) {
    return fail(res, 400, "validation_error", "content is too long (max 4000 chars)");
  }
  if (!is_sensitive && includesSensitiveMarkers(content)) {
    return fail(res, 400, "validation_error", "possible sensitive content requires is_sensitive=true");
  }

  const allowed = await requireToolAccess(
    res,
    agent_role,
    "memory.write",
    { entity_type: "memory_card", entity_id: source_action_id || "new" }
  );
  if (!allowed) return;

  const nowMs = Date.now();
  const defaultExpires = new Date(nowMs + MEMORY_CARD_DEFAULT_TTL_HOURS * 3600 * 1000);
  const expiresAtDate = expires_at_raw ? parseIsoDatetime(expires_at_raw) : defaultExpires;
  if (!expiresAtDate) {
    return fail(res, 400, "validation_error", "expires_at must be a valid ISO datetime");
  }
  if (expiresAtDate.getTime() <= nowMs) {
    return fail(res, 400, "validation_error", "expires_at must be in the future");
  }
  if (is_sensitive) {
    const sensitiveMax = nowMs + MEMORY_CARD_SENSITIVE_MAX_TTL_HOURS * 3600 * 1000;
    if (expiresAtDate.getTime() > sensitiveMax) {
      return fail(
        res,
        400,
        "validation_error",
        `sensitive cards TTL must be <= ${MEMORY_CARD_SENSITIVE_MAX_TTL_HOURS} hours`
      );
    }
  }

  try {
    const q = await pool.query(
      `insert into memory_cards
       (agent_role,user_id,topic,content,is_sensitive,expires_at,source_action_id)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning id,agent_role,user_id,topic,content,is_sensitive,created_at,expires_at,source_action_id`,
      [agent_role, user_id, topic, content, is_sensitive, expiresAtDate.toISOString(), source_action_id]
    );

    const row = q.rows[0];
    await writeAction("memory_card_created", "memory_card", String(row.id), agent_role, {
      user_id: row.user_id,
      topic: row.topic,
      is_sensitive: row.is_sensitive,
      expires_at: row.expires_at,
      source_action_id: row.source_action_id || null,
    });

    return ok(res, {
      ...row,
      created_at: toIsoTimestamp(row.created_at),
      expires_at: toIsoTimestamp(row.expires_at),
    });
  } catch (e) {
    if (String(e.message || "").includes("memory_cards_source_action_fk")) {
      return fail(res, 400, "validation_error", "source_action_id not found in actions_log");
    }
    return fail(res, 500, "memory_card_create_failed", e.message);
  }
});

app.get("/memory/cards", async (req, res) => {
  const actor_role = String(req.query.actor_role || "orchestrator").trim();
  const allowed = await requireToolAccess(
    res,
    actor_role,
    "memory.read",
    { entity_type: "memory_card", entity_id: "query" }
  );
  if (!allowed) return;

  const limit = parsePositiveInt(req.query.limit, 20, 100);
  const includeExpired = parseBoolean(req.query.include_expired, false);
  const where = [];
  const vals = [];

  if (req.query.user_id) {
    vals.push(String(req.query.user_id).trim());
    where.push(`user_id = $${vals.length}`);
  }
  if (req.query.agent_role) {
    vals.push(String(req.query.agent_role).trim());
    where.push(`agent_role = $${vals.length}`);
  }
  if (req.query.topic) {
    vals.push(`%${escapeLikePattern(String(req.query.topic).trim())}%`);
    where.push(`topic ilike $${vals.length} escape '\\'`);
  }
  if (!includeExpired) {
    where.push(`expires_at > now()`);
  }
  if (req.query.since_hours != null) {
    const sinceHours = parsePositiveInt(req.query.since_hours, 0, 24 * 30);
    if (sinceHours > 0) {
      vals.push(sinceHours);
      where.push(`created_at >= now() - ($${vals.length}::text || ' hours')::interval`);
    }
  }

  vals.push(limit);
  try {
    const q = await pool.query(
      `select id,agent_role,user_id,topic,content,is_sensitive,created_at,expires_at,source_action_id
       from memory_cards
       ${where.length ? "where " + where.join(" and ") : ""}
       order by created_at desc
       limit $${vals.length}`,
      vals
    );

    const items = q.rows.map((row) => ({
      ...row,
      created_at: toIsoTimestamp(row.created_at),
      expires_at: toIsoTimestamp(row.expires_at),
    }));
    return ok(res, { count: items.length, items });
  } catch (e) {
    return fail(res, 500, "memory_cards_query_failed", e.message);
  }
});

app.post("/memory/cards/maintenance", async (req, res) => {
  const actor_role = String(req.body?.actor_role || "system_watchdog").trim();
  const allowed = await requireToolAccess(
    res,
    actor_role,
    "memory.write",
    { entity_type: "memory_card", entity_id: "maintenance" }
  );
  if (!allowed) return;

  try {
    const q = await pool.query(
      `
      with expired as (
        delete from memory_cards
        where expires_at <= now()
        returning id
      ),
      compacted as (
        update memory_cards
        set content = left(content, 240) || ' ... [truncated]'
        where is_sensitive = false
          and created_at < now() - interval '3 days'
          and char_length(content) > 260
          and content not like '%[truncated]'
        returning id
      )
      select
        (select count(*)::int from expired) as expired_deleted,
        (select count(*)::int from compacted) as compacted_count
      `
    );

    const row = q.rows[0] || { expired_deleted: 0, compacted_count: 0 };
    await writeAction("memory_cards_maintenance_run", "memory_card", "maintenance", actor_role, row);
    return ok(res, row);
  } catch (e) {
    return fail(res, 500, "memory_cards_maintenance_failed", e.message);
  }
});


/* ===== approvals mvp routes ===== */
const APPROVAL_CLASSES = new Set(["safe_read","internal_write","external_comm","financial_change","policy_change"]);
const CLASS_A_APPROVALS = new Set(["external_comm", "financial_change", "policy_change"]);
const DEFAULT_APPROVER = {
  external_comm: "strategy",
  financial_change: "finance",
  policy_change: "orchestrator",
};
const TOOL_ACCESS_BYPASS_ROLES = new Set(["human_telegram"]);
const ROLE_ACTION_WHITELIST = {
  orchestrator: new Set([
    "tasks.write",
    "tasks.retry",
    "memory.read",
    "memory.write",
    "approvals.decide",
    "approvals.request.safe_read",
    "approvals.request.internal_write",
    "approvals.request.external_comm",
    "approvals.request.financial_change",
    "approvals.request.policy_change",
    "runtime.accept",
    "runtime.retry",
    "runtime.read",
  ]),
  strategy: new Set([
    "tasks.write",
    "tasks.retry",
    "memory.read",
    "memory.write",
    "approvals.decide",
    "approvals.request.safe_read",
    "approvals.request.internal_write",
    "approvals.request.external_comm",
    "runtime.read",
  ]),
  finance: new Set([
    "tasks.write",
    "tasks.retry",
    "memory.read",
    "memory.write",
    "approvals.decide",
    "approvals.request.safe_read",
    "approvals.request.internal_write",
    "approvals.request.financial_change",
    "runtime.read",
  ]),
  pmo: new Set([
    "tasks.write",
    "tasks.retry",
    "memory.read",
    "memory.write",
    "approvals.request.safe_read",
    "approvals.request.internal_write",
    "runtime.read",
  ]),
  system_watchdog: new Set([
    "memory.write",
    "runtime.accept",
    "runtime.retry",
    "runtime.read",
  ]),
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
    void notifyCriticalTelegramEvent({ actionType, entityType, entityId, actorRole, payload });
  } catch (e) {
    console.error("actions_log write failed:", e.message);
  }
}

async function sendTelegramNotification(text) {
  if (!CONTROL_API_TELEGRAM_WEBHOOK_ENABLED) return;
  if (!TELEGRAM_NOTIFY_TOKEN || TELEGRAM_NOTIFY_CHAT_IDS.length === 0) return;

  const endpoint = `https://api.telegram.org/bot${TELEGRAM_NOTIFY_TOKEN}/sendMessage`;
  const jobs = TELEGRAM_NOTIFY_CHAT_IDS.map(async (chatId) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const telegramRejected = payload && payload.ok === false;
    if (!response.ok || telegramRejected) {
      const description =
        (payload && payload.description ? String(payload.description) : "") ||
        `HTTP ${response.status}`;
      throw new Error(`chat_id=${chatId} ${description}`);
    }
  });

  const results = await Promise.allSettled(jobs);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    const reasons = failed.map((r) => String(r.reason && r.reason.message ? r.reason.message : r.reason));
    console.warn(`telegram webhook send failed: ${failed.length}/${results.length}; ${reasons.join(" | ")}`);
  }
}

function buildCriticalTelegramMessage({ actionType, entityType, entityId, actorRole, payload }) {
  const base = `[Control API] ${actionType}\nentity: ${entityType}:${entityId}\nactor: ${actorRole || "unknown"}`;
  if (actionType === "task_failed") {
    const reason = payload && payload.reason ? String(payload.reason) : "no reason";
    return `${base}\nreason: ${reason}`;
  }
  if (actionType === "retry_limit_exceeded") {
    const attempt = payload && payload.retry_attempt != null ? String(payload.retry_attempt) : "?";
    const limit = payload && payload.max_retry_attempts != null ? String(payload.max_retry_attempts) : "?";
    const reason = payload && payload.reason ? String(payload.reason) : "no reason";
    return `${base}\nattempt: ${attempt}/${limit}\nreason: ${reason}`;
  }
  if (actionType === "run_dead_letter") {
    const attempt = payload && payload.attempt_number != null ? String(payload.attempt_number) : "?";
    const maxAttempts = payload && payload.max_attempts != null ? String(payload.max_attempts) : "?";
    const role = payload && payload.role ? String(payload.role) : "unknown";
    return `${base}\nrole: ${role}\nattempt: ${attempt}/${maxAttempts}\n⚠️ Требуется ручное вмешательство`;
  }
  if (actionType === "approval_requested") {
    const approvalId = payload && payload.approval_id ? String(payload.approval_id) : "unknown";
    const actionClass = payload && payload.action_class ? String(payload.action_class) : "unknown";
    const approver = payload && payload.approver_role ? String(payload.approver_role) : "strategy";
    return `${base}\napproval_id: ${approvalId}\naction_class: ${actionClass}\napprover_role: ${approver}\n\napprove: /approve ${approvalId} --role=${approver}\nreject: /reject ${approvalId} reason --role=${approver}`;
  }
  return base;
}

async function notifyCriticalTelegramEvent(evt) {
  try {
    if (!CRITICAL_TELEGRAM_ACTIONS.has(evt.actionType)) return;
    const text = buildCriticalTelegramMessage(evt);
    await sendTelegramNotification(text);
  } catch (e) {
    console.warn("telegram webhook notify failed:", e.message);
  }
}

async function requireToolAccess(res, roleRaw, actionKey, ctx = {}) {
  const role = String(roleRaw || "").trim();
  if (!role) {
    fail(res, 400, "validation_error", "actor role is required");
    return false;
  }

  if (!CONTROL_API_ENFORCE_TOOL_ACCESS) return true;
  if (TOOL_ACCESS_BYPASS_ROLES.has(role)) return true;

  const whitelist = ROLE_ACTION_WHITELIST[role];
  const hasAccess = !!whitelist && whitelist.has(actionKey);

  if (hasAccess) return true;

  await writeAction(
    "tool_access_denied",
    ctx.entity_type || "policy",
    String(ctx.entity_id || actionKey),
    role,
    {
      action_key: actionKey,
      reason: whitelist ? "action_not_allowed_for_role" : "unknown_role",
    }
  );

  fail(res, 403, "forbidden", `role '${role}' is not allowed to perform '${actionKey}'`);
  return false;
}

async function runHardPolicyCritic(input) {
  if (!CONTROL_API_ENABLE_HARD_CRITIC) return { allow: true };

  const actorRole = String(input.actor_role || "").trim();
  const actionKey = String(input.action_key || "").trim();
  const reason = String(input.reason || "").trim();
  const approvalId = String(input.approval_id || "").trim();
  const decision = String(input.decision || "").trim();
  const actionClass = String(input.action_class || "").trim();

  // Class-A approval requests must always include a non-trivial reason.
  if (actionKey.startsWith("approvals.request.") && CLASS_A_APPROVALS.has(actionClass)) {
    if (reason.length < 5) {
      return {
        allow: false,
        code: "critic_reason_required",
        message: "class-A approval request requires a reason (min 5 chars)",
      };
    }
  }

  // Approval decisions are risky: check target state before mutation.
  if (actionKey === "approvals.decide") {
    if (!approvalId || !decision) {
      return {
        allow: false,
        code: "critic_validation_error",
        message: "approval_id and decision are required for critic check",
      };
    }

    const q = await pool.query(
      `select approval_id,status,approver_role,action_class
       from approval_requests
       where approval_id = $1`,
      [approvalId]
    );
    if (q.rowCount === 0) {
      return {
        allow: false,
        code: "critic_approval_not_found",
        message: "approval request not found",
      };
    }

    const row = q.rows[0];
    if (row.status !== "pending") {
      return {
        allow: false,
        code: "critic_approval_not_pending",
        message: "approval is not pending",
      };
    }
    if (String(row.approver_role || "") !== actorRole) {
      return {
        allow: false,
        code: "critic_wrong_approver",
        message: "actor is not the assigned approver",
      };
    }

    // Class-A approvals must keep a short audit reason on decision.
    if (decision === "approved" && CLASS_A_APPROVALS.has(String(row.action_class || "")) && reason.length < 5) {
      return {
        allow: false,
        code: "critic_reason_required",
        message: "class-A approval decision requires a reason (min 5 chars)",
      };
    }
  }

  return { allow: true };
}

async function requireHardPolicyCritic(res, input) {
  try {
    const result = await runHardPolicyCritic(input);
    if (result.allow) return true;

    const actorRole = String(input.actor_role || "unknown").trim() || "unknown";
    const entityType = String(input.entity_type || "policy");
    const entityId = String(input.entity_id || input.action_key || "critic");
    await writeAction("critic_policy_denied", entityType, entityId, actorRole, {
      action_key: String(input.action_key || ""),
      critic_code: result.code,
      message: result.message,
    });
    fail(res, 409, "critic_policy_denied", result.message || "hard-policy critic denied action");
    return false;
  } catch (e) {
    fail(res, 500, "critic_check_failed", e.message);
    return false;
  }
}

app.post("/critic/check", async (req, res) => {
  const actor_role = String(req.body?.actor_role || "").trim();
  const action_key = String(req.body?.action_key || "").trim();
  const entity_type = String(req.body?.entity_type || "policy").trim();
  const entity_id = String(req.body?.entity_id || action_key || "critic").trim();
  const action_class = req.body?.action_class ? String(req.body.action_class).trim() : "";
  const approval_id = req.body?.approval_id ? String(req.body.approval_id).trim() : "";
  const decision = req.body?.decision ? String(req.body.decision).trim() : "";
  const reason = req.body?.reason ? String(req.body.reason) : "";

  if (!actor_role || !action_key) {
    return fail(res, 400, "validation_error", "actor_role and action_key are required");
  }

  const allowed = await requireToolAccess(
    res,
    actor_role,
    action_key,
    { entity_type, entity_id }
  );
  if (!allowed) return;

  const result = await runHardPolicyCritic({
    actor_role,
    action_key,
    entity_type,
    entity_id,
    action_class,
    approval_id,
    decision,
    reason,
  });

  if (!result.allow) {
    await writeAction("critic_policy_denied", entity_type, entity_id, actor_role, {
      action_key,
      critic_code: result.code,
      message: result.message,
    });
    return ok(res, { allow: false, code: result.code, message: result.message });
  }

  return ok(res, { allow: true });
});

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
  const allowed = await requireToolAccess(
    res,
    requested_by_role,
    `approvals.request.${action_class}`,
    { entity_type, entity_id }
  );
  if (!allowed) return;
  {
    const criticAllowed = await requireHardPolicyCritic(res, {
      actor_role: requested_by_role,
      action_key: `approvals.request.${action_class}`,
      entity_type,
      entity_id,
      action_class,
      reason: reason || "",
    });
    if (!criticAllowed) return;
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
  const allowed = await requireToolAccess(
    res,
    decided_by_role,
    "approvals.decide",
    { entity_type: "approval", entity_id: approval_id }
  );
  if (!allowed) return;
  {
    const criticAllowed = await requireHardPolicyCritic(res, {
      actor_role: decided_by_role,
      action_key: "approvals.decide",
      entity_type: "approval",
      entity_id: approval_id,
      approval_id,
      decision,
      reason: reason || "",
    });
    if (!criticAllowed) return;
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


// Runtime bridge: claim task

app.post("/tasks", async (req, res) => {
  const { title, primary_goal_id, assignee, due_at, actor_role } = req.body || {};

  if (!title || !primary_goal_id || !assignee || !actor_role) {
    return fail(res, 400, "validation_error", "title, primary_goal_id, assignee, actor_role are required");
  }
  {
    const allowed = await requireToolAccess(
      res,
      actor_role,
      "tasks.write",
      { entity_type: "task", entity_id: "new" }
    );
    if (!allowed) return;
  }

  try {
    const taskId = id("tg");
    const q = await pool.query(
      `insert into tasks (id,title,primary_goal_id,status,assignee,due_at)
       values ($1,$2,$3,'todo',$4,$5)
       returning id,title,primary_goal_id,status,assignee,due_at`,
      [taskId, title, primary_goal_id, assignee, due_at || null]
    );

    const row = q.rows[0];
    await writeAction("task_created", "task", row.id, actor_role, {
      title: row.title,
      goal_id: row.primary_goal_id,
      assignee: row.assignee
    });

    return ok(res, row);
  } catch (e) {
    return fail(res, 500, "task_create_failed", e.message);
  }
});

app.post("/tasks/:id/claim", async (req, res) => {
  const taskId = req.params.id;
  const actor_role = String(req.body?.actor_role || "").trim();

  if (!actor_role) {
    return fail(res, 400, "bad_request", "actor_role is required");
  }
  {
    const allowed = await requireToolAccess(
      res,
      actor_role,
      "tasks.write",
      { entity_type: "task", entity_id: taskId }
    );
    if (!allowed) return;
  }

  try {
    const q = await pool.query(
      `
      UPDATE tasks
      SET status = 'in_progress',
          claimed_by = $2,
          claimed_at = now()
      WHERE id = $1
        AND status IN ('todo','blocked')
        AND (retry_after IS NULL OR retry_after <= now())
      RETURNING id,title,status,assignee,claimed_by,claimed_at,primary_goal_id,retry_after
      `,
      [taskId, actor_role]
    );

    if (q.rowCount === 0) {
      const current = await pool.query(
        `select id,status,retry_after,
                (retry_after is not null and retry_after > now()) as retry_locked
         from tasks
         where id = $1`,
        [taskId]
      );

      if (current.rowCount > 0) {
        const row = current.rows[0];
        if (["todo", "blocked"].includes(row.status) && row.retry_locked) {
          return fail(
            res,
            409,
            "retry_not_ready",
            `task cannot be claimed before retry_after (${row.retry_after.toISOString()})`
          );
        }
      }

      return fail(res, 409, "not_claimable", "task is not in todo/blocked or does not exist");
    }

    const row = q.rows[0];
    await writeAction("task_claimed", "task", row.id, actor_role, {
      claimed_by: row.claimed_by,
      claimed_at: row.claimed_at,
      goal_id: row.primary_goal_id
    });

    return ok(res, row);
  } catch (e) {
    return fail(res, 500, "task_claim_failed", e.message);
  }
});

// Runtime bridge: complete task
app.post("/tasks/:id/complete", async (req, res) => {
  const taskId = req.params.id;
  const actor_role = String(req.body?.actor_role || "").trim();
  const summary = String(req.body?.summary || "").trim();

  if (!actor_role) {
    return fail(res, 400, "bad_request", "actor_role is required");
  }
  {
    const allowed = await requireToolAccess(
      res,
      actor_role,
      "tasks.write",
      { entity_type: "task", entity_id: taskId }
    );
    if (!allowed) return;
  }

  try {
    const q = await pool.query(
      `
      UPDATE tasks
      SET status = 'done',
          completed_at = now(),
          status_reason = NULL
      WHERE id = $1
        AND status IN ('in_progress','blocked','todo')
      RETURNING id,title,status,assignee,claimed_by,claimed_at,completed_at,primary_goal_id
      `,
      [taskId]
    );

    if (q.rowCount === 0) {
      return fail(res, 409, "not_completable", "task is not in progress/blocked/todo or does not exist");
    }

    const row = q.rows[0];
    await writeAction("task_completed", "task", row.id, actor_role, {
      completed_at: row.completed_at,
      goal_id: row.primary_goal_id,
      summary: summary || null
    });

    return ok(res, row);
  } catch (e) {
    return fail(res, 500, "task_complete_failed", e.message);
  }
});

app.post("/tasks/:id/block", async (req, res) => {
  const taskId = req.params.id;
  const { actor_role, reason } = req.body || {};
  if (!actor_role) {
    return fail(res, 400, "validation_error", "actor_role is required");
  }
  {
    const allowed = await requireToolAccess(
      res,
      actor_role,
      "tasks.write",
      { entity_type: "task", entity_id: taskId }
    );
    if (!allowed) return;
  }
  try {
    const q = await pool.query(
      `update tasks
         set status='blocked',
             status_reason=$2
       where id=$1
         and status in ('todo','in_progress')
       returning id,title,status,assignee,primary_goal_id,status_reason`,
      [taskId, reason || null]
    );
    if (q.rowCount === 0) {
      return fail(res, 409, "invalid_transition_or_not_found", "task not found or status transition is not allowed");
    }
    const row = q.rows[0];
    await writeAction("task_blocked", "task", row.id, actor_role, { reason: row.status_reason });
    return ok(res, row);
  } catch (e) {
    return fail(res, 500, "task_block_failed", e.message);
  }
});

app.post("/tasks/:id/fail", async (req, res) => {
  const taskId = req.params.id;
  const { actor_role, reason } = req.body || {};
  if (!actor_role) {
    return fail(res, 400, "validation_error", "actor_role is required");
  }
  {
    const allowed = await requireToolAccess(
      res,
      actor_role,
      "tasks.write",
      { entity_type: "task", entity_id: taskId }
    );
    if (!allowed) return;
  }
  try {
    const q = await pool.query(
      `update tasks
         set status='failed',
             status_reason=$2
       where id=$1
         and status in ('todo','in_progress','blocked')
       returning id,title,status,assignee,primary_goal_id,status_reason`,
      [taskId, reason || null]
    );
    if (q.rowCount === 0) {
      return fail(res, 409, "invalid_transition_or_not_found", "task not found or status transition is not allowed");
    }
    const row = q.rows[0];
    await writeAction("task_failed", "task", row.id, actor_role, { reason: row.status_reason });
    return ok(res, row);
  } catch (e) {
    return fail(res, 500, "task_fail_failed", e.message);
  }
});

app.post("/tasks/:id/reopen", async (req, res) => {
  const taskId = req.params.id;
  const { actor_role } = req.body || {};
  if (!actor_role) {
    return fail(res, 400, "validation_error", "actor_role is required");
  }
  {
    const allowed = await requireToolAccess(
      res,
      actor_role,
      "tasks.write",
      { entity_type: "task", entity_id: taskId }
    );
    if (!allowed) return;
  }

  try {
    const q = await pool.query(
      `update tasks
         set status='todo',
             status_reason=NULL
       where id=$1
         and status in ('done','failed','blocked')
       returning id,title,status,assignee,primary_goal_id,status_reason`,
      [taskId]
    );

    if (q.rowCount === 0) {
      return fail(res, 409, "invalid_transition_or_not_found", "task not found or status transition is not allowed");
    }

    const row = q.rows[0];
    await writeAction("task_reopened", "task", row.id, actor_role, {});
    return ok(res, row);
  } catch (e) {
    return fail(res, 500, "task_reopen_failed", e.message);
  }
});

app.post("/tasks/:id/retry", async (req, res) => {
  const taskId = req.params.id;
  const actor_role = String(req.body?.actor_role || "").trim();
  const reason = req.body?.reason ? String(req.body.reason) : null;
  const retry_after_raw = req.body?.retry_after ? String(req.body.retry_after).trim() : "";

  if (!actor_role) {
    return fail(res, 400, "validation_error", "actor_role is required");
  }
  {
    const allowed = await requireToolAccess(
      res,
      actor_role,
      "tasks.retry",
      { entity_type: "task", entity_id: taskId }
    );
    if (!allowed) return;
  }

  let retryAfter = null;
  if (retry_after_raw) {
    const parsed = new Date(retry_after_raw);
    if (Number.isNaN(parsed.getTime())) {
      return fail(res, 400, "validation_error", "retry_after must be a valid ISO datetime");
    }
    retryAfter = parsed.toISOString();
  }

  try {
    const current = await pool.query(
      `select id,status,coalesce(retry_attempt,0) as retry_attempt
       from tasks
       where id=$1`,
      [taskId]
    );

    if (current.rowCount === 0) {
      return fail(res, 404, "not_found", "task not found");
    }

    const before = current.rows[0];
    if (!["failed", "blocked"].includes(before.status)) {
      return fail(res, 409, "invalid_transition_or_not_found", "task not found or retry transition is not allowed");
    }
    if (Number(before.retry_attempt) >= MAX_RETRY_ATTEMPTS) {
      await writeAction("retry_limit_exceeded", "task", before.id, actor_role, {
        retry_attempt: Number(before.retry_attempt),
        max_retry_attempts: MAX_RETRY_ATTEMPTS,
        reason: reason || null,
        retry_after: retryAfter || null,
      });
      return fail(
        res,
        409,
        "retry_limit_exceeded",
        `retry limit reached: ${before.retry_attempt}/${MAX_RETRY_ATTEMPTS}`
      );
    }

    const q = await pool.query(
      `update tasks
         set status='todo',
             status_reason=$2,
             retry_attempt=coalesce(retry_attempt,0)+1,
             retry_after=$3,
             claimed_by=NULL,
             claimed_at=NULL,
             completed_at=NULL
       where id=$1
         and status in ('failed','blocked')
         and coalesce(retry_attempt,0) < $4
       returning id,title,status,assignee,primary_goal_id,status_reason,retry_attempt,retry_after,claimed_by,claimed_at,completed_at`,
      [taskId, reason, retryAfter, MAX_RETRY_ATTEMPTS]
    );

    if (q.rowCount === 0) {
      return fail(res, 409, "retry_conflict", "task state changed, retry again");
    }

    const row = q.rows[0];
    await writeAction("task_retry_queued", "task", row.id, actor_role, {
      reason: row.status_reason,
      retry_attempt: row.retry_attempt,
      retry_after: row.retry_after
    });

    return ok(res, row);
  } catch (e) {
    return fail(res, 500, "task_retry_failed", e.message);
  }
});

/* ===== H-27: Runtime core — acceptTrigger + retryRun ===== */

// POST /runtime/trigger — acceptTrigger(triggerId, payload)
// Dedup via processed_triggers. Duplicate trigger_id → skip.
app.post("/runtime/trigger", async (req, res) => {
  const trigger_id = String(req.body?.trigger_id || "").trim();
  const role = String(req.body?.role || "").trim();
  const actor_role = String(req.body?.actor_role || "orchestrator").trim();
  const correlation_id = req.body?.correlation_id ? String(req.body.correlation_id).trim() : null;
  const payload = req.body?.payload || {};
  const max_run_timeout_sec = req.body?.max_run_timeout_sec
    ? parsePositiveInt(req.body.max_run_timeout_sec, DEFAULT_RUN_TIMEOUT_SEC, 3600)
    : DEFAULT_RUN_TIMEOUT_SEC;

  if (!trigger_id || !role) {
    return fail(res, 400, "validation_error", "trigger_id and role are required");
  }
  {
    const allowed = await requireToolAccess(
      res,
      actor_role,
      "runtime.accept",
      { entity_type: "agent_run", entity_id: trigger_id }
    );
    if (!allowed) return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Dedup check: try to insert into processed_triggers
    const dedupResult = await client.query(
      `INSERT INTO processed_triggers (trigger_id)
       VALUES ($1)
       ON CONFLICT (trigger_id) DO NOTHING
       RETURNING trigger_id`,
      [trigger_id]
    );

    if (dedupResult.rowCount === 0) {
      // Duplicate — skip
      await client.query("COMMIT");
      await writeAction("trigger_duplicate_skipped", "agent_run", trigger_id, actor_role, {
        trigger_id,
        role,
      });
      return ok(res, {
        accepted: false,
        reason: "duplicate_trigger",
        trigger_id,
      });
    }

    // Create agent_run
    const runId = id("run");
    const corrId = correlation_id || id("cor");

    await client.query(
      `INSERT INTO agent_runs
       (id, trigger_id, role, status, attempt_number, retry_of_run_id,
        correlation_id, payload, max_run_timeout_sec)
       VALUES ($1, $2, $3, 'pending', 1, NULL, $4, $5::jsonb, $6)`,
      [runId, trigger_id, role, corrId, JSON.stringify(payload), max_run_timeout_sec]
    );

    await client.query("COMMIT");

    await writeAction("run_accepted", "agent_run", runId, actor_role, {
      trigger_id,
      role,
      correlation_id: corrId,
      attempt_number: 1,
    });

    return ok(res, {
      accepted: true,
      run_id: runId,
      trigger_id,
      role,
      status: "pending",
      attempt_number: 1,
      correlation_id: corrId,
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return fail(res, 500, "runtime_trigger_failed", e.message);
  } finally {
    client.release();
  }
});

// POST /runtime/runs/:id/retry — retryRun(failedRunId)
// Bypasses dedup. Creates new agent_run with retry_of_run_id.
// Max MAX_RUN_ATTEMPTS attempts, then dead_letter.
app.post("/runtime/runs/:id/retry", async (req, res) => {
  const failedRunId = req.params.id;
  const actor_role = String(req.body?.actor_role || "orchestrator").trim();
  const reason = req.body?.reason ? String(req.body.reason).trim() : null;

  {
    const allowed = await requireToolAccess(
      res,
      actor_role,
      "runtime.retry",
      { entity_type: "agent_run", entity_id: failedRunId }
    );
    if (!allowed) return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the failed run for update
    const currentQ = await client.query(
      `SELECT id, trigger_id, role, status, attempt_number, correlation_id,
              payload, max_run_timeout_sec
       FROM agent_runs
       WHERE id = $1
       FOR UPDATE`,
      [failedRunId]
    );

    if (currentQ.rowCount === 0) {
      await client.query("COMMIT");
      return fail(res, 404, "not_found", "agent_run not found");
    }

    const failedRun = currentQ.rows[0];

    // Only error/timeout runs can be retried
    if (!["error", "timeout"].includes(failedRun.status)) {
      await client.query("COMMIT");
      return fail(res, 409, "invalid_status", `cannot retry run with status '${failedRun.status}', expected error or timeout`);
    }

    const nextAttempt = failedRun.attempt_number + 1;

    // Check max attempts
    if (nextAttempt > MAX_RUN_ATTEMPTS) {
      // Promote to dead_letter
      await client.query(
        `UPDATE agent_runs SET status = 'dead_letter', finished_at = now()
         WHERE id = $1`,
        [failedRunId]
      );
      await client.query("COMMIT");

      await writeAction("run_dead_letter", "agent_run", failedRunId, actor_role, {
        trigger_id: failedRun.trigger_id,
        role: failedRun.role,
        attempt_number: failedRun.attempt_number,
        max_attempts: MAX_RUN_ATTEMPTS,
        reason: reason || "max attempts exceeded",
      });

      return ok(res, {
        retried: false,
        reason: "dead_letter",
        run_id: failedRunId,
        attempt_number: failedRun.attempt_number,
        max_attempts: MAX_RUN_ATTEMPTS,
      });
    }

    // Create retry run — bypasses processed_triggers (same trigger_id, new run)
    const newRunId = id("run");

    await client.query(
      `INSERT INTO agent_runs
       (id, trigger_id, role, status, attempt_number, retry_of_run_id,
        correlation_id, payload, max_run_timeout_sec)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7::jsonb, $8)`,
      [
        newRunId,
        failedRun.trigger_id,
        failedRun.role,
        nextAttempt,
        failedRunId,
        failedRun.correlation_id,
        JSON.stringify(failedRun.payload || {}),
        failedRun.max_run_timeout_sec,
      ]
    );

    await client.query("COMMIT");

    await writeAction("run_retry", "agent_run", newRunId, actor_role, {
      retry_of_run_id: failedRunId,
      trigger_id: failedRun.trigger_id,
      role: failedRun.role,
      attempt_number: nextAttempt,
      reason: reason || null,
    });

    return ok(res, {
      retried: true,
      run_id: newRunId,
      retry_of_run_id: failedRunId,
      trigger_id: failedRun.trigger_id,
      role: failedRun.role,
      status: "pending",
      attempt_number: nextAttempt,
      correlation_id: failedRun.correlation_id,
    });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return fail(res, 500, "runtime_retry_failed", e.message);
  } finally {
    client.release();
  }
});

// POST /runtime/runs/:id/start — mark run as running
app.post("/runtime/runs/:id/start", async (req, res) => {
  const runId = req.params.id;
  const actor_role = String(req.body?.actor_role || "orchestrator").trim();
  {
    const allowed = await requireToolAccess(
      res,
      actor_role,
      "runtime.accept",
      { entity_type: "agent_run", entity_id: runId }
    );
    if (!allowed) return;
  }

  try {
    const q = await pool.query(
      `UPDATE agent_runs
       SET status = 'running', started_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING id, trigger_id, role, status, attempt_number, correlation_id, started_at`,
      [runId]
    );
    if (q.rowCount === 0) {
      return fail(res, 409, "invalid_status", "run is not in pending status");
    }
    const row = q.rows[0];
    await writeAction("run_started", "agent_run", row.id, actor_role, {
      role: row.role,
      correlation_id: row.correlation_id,
    });
    return ok(res, row);
  } catch (e) {
    return fail(res, 500, "runtime_start_failed", e.message);
  }
});

// POST /runtime/runs/:id/complete — mark run as success/error/timeout
app.post("/runtime/runs/:id/complete", async (req, res) => {
  const runId = req.params.id;
  const actor_role = String(req.body?.actor_role || "orchestrator").trim();
  const status = String(req.body?.status || "").trim();
  const result = req.body?.result || null;
  const error_message = req.body?.error_message ? String(req.body.error_message).trim() : null;
  const token_usage = req.body?.token_usage || null;

  if (!["success", "error", "timeout"].includes(status)) {
    return fail(res, 400, "validation_error", "status must be success, error, or timeout");
  }
  {
    const allowed = await requireToolAccess(
      res,
      actor_role,
      "runtime.accept",
      { entity_type: "agent_run", entity_id: runId }
    );
    if (!allowed) return;
  }

  try {
    const q = await pool.query(
      `UPDATE agent_runs
       SET status = $2,
           result = $3::jsonb,
           error_message = $4,
           token_usage = $5::jsonb,
           finished_at = now()
       WHERE id = $1 AND status = 'running'
       RETURNING id, trigger_id, role, status, attempt_number, correlation_id,
                 error_message, started_at, finished_at`,
      [
        runId,
        status,
        result ? JSON.stringify(result) : null,
        error_message,
        token_usage ? JSON.stringify(token_usage) : null,
      ]
    );

    if (q.rowCount === 0) {
      return fail(res, 409, "invalid_status", "run is not in running status");
    }

    const row = q.rows[0];
    await writeAction("run_completed", "agent_run", row.id, actor_role, {
      status: row.status,
      role: row.role,
      correlation_id: row.correlation_id,
      error_message: row.error_message || null,
    });

    return ok(res, row);
  } catch (e) {
    return fail(res, 500, "runtime_complete_failed", e.message);
  }
});

// GET /runtime/runs — list runs with optional filters
app.get("/runtime/runs", async (req, res) => {
  const actor_role = String(req.query.actor_role || "orchestrator").trim();
  {
    const allowed = await requireToolAccess(
      res,
      actor_role,
      "runtime.read",
      { entity_type: "agent_run", entity_id: "query" }
    );
    if (!allowed) return;
  }

  const limit = parsePositiveInt(req.query.limit, 20, 100);
  const where = [];
  const vals = [];

  if (req.query.role) {
    vals.push(String(req.query.role).trim());
    where.push(`role = $${vals.length}`);
  }
  if (req.query.status) {
    vals.push(String(req.query.status).trim());
    where.push(`status = $${vals.length}`);
  }
  if (req.query.trigger_id) {
    vals.push(String(req.query.trigger_id).trim());
    where.push(`trigger_id = $${vals.length}`);
  }
  if (req.query.correlation_id) {
    vals.push(String(req.query.correlation_id).trim());
    where.push(`correlation_id = $${vals.length}`);
  }

  vals.push(limit);

  try {
    const q = await pool.query(
      `SELECT id, trigger_id, role, status, attempt_number, retry_of_run_id,
              correlation_id, error_message, max_run_timeout_sec,
              started_at, finished_at, created_at
       FROM agent_runs
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY created_at DESC
       LIMIT $${vals.length}`,
      vals
    );
    return ok(res, { count: q.rowCount, runs: q.rows });
  } catch (e) {
    return fail(res, 500, "runtime_runs_query_failed", e.message);
  }
});

const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(`stemford-control-api listening on 127.0.0.1:${PORT}`);
});

let controlApiShuttingDown = false;
async function shutdownControlApi(signal) {
  if (controlApiShuttingDown) return;
  controlApiShuttingDown = true;
  console.log(`control-api shutdown: ${signal}`);

  const forceTimer = setTimeout(() => {
    console.error("control-api force exit after timeout");
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  server.close(async () => {
    try {
      await pool.end();
    } catch (e) {
      console.error("control-api pool.end error:", e.message);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => { void shutdownControlApi("SIGTERM"); });
process.on("SIGINT", () => { void shutdownControlApi("SIGINT"); });
