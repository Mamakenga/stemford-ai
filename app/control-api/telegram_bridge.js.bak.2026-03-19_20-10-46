const TelegramBot = require("node-telegram-bot-api");
const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: "/opt/stemford/run/.env" });

const token = process.env.TELEGRAM_BOT_TOKEN;
const dbUrl = process.env.RAILWAY_DATABASE_URL;

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is missing");
  process.exit(1);
}
if (!dbUrl) {
  console.error("RAILWAY_DATABASE_URL is missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  application_name: "human_telegram",
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const bot = new TelegramBot(token, { polling: true });

const allowedChatIds = new Set(
  (process.env.ALLOWED_CHAT_IDS || "")
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x))
);

function isAllowedMessage(msg) {
  return !!(msg && msg.chat && allowedChatIds.has(Number(msg.chat.id)));
}
const pendingTaskDrafts = new Map();
const TASK_DRAFT_TTL_MS = 5 * 60 * 1000;

function setTaskDraft(chatId, draft) {
  pendingTaskDrafts.set(chatId, { ...draft, createdAt: Date.now() });
}

function getTaskDraft(chatId) {
  const draft = pendingTaskDrafts.get(chatId);
  if (!draft) return null;
  if (Date.now() - draft.createdAt > TASK_DRAFT_TTL_MS) {
    pendingTaskDrafts.delete(chatId);
    return null;
  }
  return draft;
}

setInterval(() => {
  const now = Date.now();
  for (const [chatId, draft] of pendingTaskDrafts.entries()) {
    if (!draft || now - draft.createdAt > TASK_DRAFT_TTL_MS) {
      pendingTaskDrafts.delete(chatId);
    }
  }
}, 60 * 1000).unref();

function inferRouting(title) {
  const t = (title || "").toLowerCase();

  let assignee = "pmo";
  let assigneeReason = "default";

  if (/финанс|бюджет|маржа|выручк|расход|kpi|p&l|pnl/.test(t)) {
    assignee = "finance";
    assigneeReason = "finance keywords";
  } else if (/стратег|позицион|утп|мисси|ценност|бренд|ребренд/.test(t)) {
    assignee = "strategy";
    assigneeReason = "strategy keywords";
  } else if (/операц|процесс|план|срок|контроль|внедр|crm/.test(t)) {
    assignee = "pmo";
    assigneeReason = "pmo keywords";
  }

  let goalId = "goal_a_positioning_brief";
  let goalReason = "default A";

  if (/бренд|ребренд|нейминг|логотип|айдентик/.test(t)) {
    goalId = "goal_b_brand_rollout";
    goalReason = "brand keywords";
  } else if (/операц|crm|дашборд|kpi|маржа|отчет|процесс/.test(t)) {
    goalId = "goal_c_ops_dashboard";
    goalReason = "operations keywords";
  } else if (/позицион|утп|мисси|родител|франшиз/.test(t)) {
    goalId = "goal_a_positioning_brief";
    goalReason = "positioning keywords";
  }

  return { assignee, assigneeReason, goalId, goalReason };
}

const helpText =
  "Команды:\n/help\n/status\n/task <текст задачи>\n/yes (подтвердить черновик /task)\n/no (отмена черновика /task)\n/tasks [status]\n/approvals\n/approve <approval_id>\n/reject <approval_id> [причина]\n/org\n/goals\n/goal <goal_id>\n/run <task_id>\n/done <task_id>\n/block <task_id> <причина>\n/fail <task_id> <причина>\n/reopen <task_id>";

bot.onText(/^\/start$/, async (msg) => {
  if (!isAllowedMessage(msg)) return;
  await bot.sendMessage(msg.chat.id, "Stemford AI online.\n" + helpText);
});

bot.onText(/^\/help$/, async (msg) => {
  if (!isAllowedMessage(msg)) return;
  await bot.sendMessage(msg.chat.id, helpText);
});

bot.onText(/^\/status$/, async (msg) => {
  if (!isAllowedMessage(msg)) return;
  try {
    const q = await pool.query(
      "select count(*)::int as cnt from tasks where status in ('todo','in_progress','blocked')"
    );
    await bot.sendMessage(msg.chat.id, `Stemford status: open tasks = ${q.rows[0].cnt}`);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Status error: ${e.message}`);
  }
});

bot.onText(/^\/task\s+(.+)/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const title = (m && m[1] ? m[1] : "").trim();
  if (!title) return bot.sendMessage(msg.chat.id, "Формат: /task <текст задачи>");

  const route = inferRouting(title);
  setTaskDraft(msg.chat.id, {
    title,
    assignee: route.assignee,
    goalId: route.goalId,
  });

  await bot.sendMessage(
    msg.chat.id,
    `Черновик задачи:\n` +
      `title: ${title}\n` +
      `assignee: ${route.assignee} (${route.assigneeReason})\n` +
      `goal: ${route.goalId} (${route.goalReason})\n\n` +
      `Подтвердить: /yes\nОтменить: /no`
  );
});

bot.onText(/^\/yes$/, async (msg) => {
  if (!isAllowedMessage(msg)) return;
  const draft = getTaskDraft(msg.chat.id);
  if (!draft) return bot.sendMessage(msg.chat.id, "Нет черновика или он устарел. Создайте заново через /task.");

  try {
    const resp = await fetch("http://127.0.0.1:3210/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        primary_goal_id: draft.goalId,
        assignee: draft.assignee,
        actor_role: "human_telegram"
      }),
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !data.ok) {
      const msgText = data && data.error && data.error.message ? data.error.message : "HTTP " + resp.status;
      return bot.sendMessage(msg.chat.id, "Task create error: " + msgText);
    }

    pendingTaskDrafts.delete(msg.chat.id);
    await bot.sendMessage(
      msg.chat.id,
      "Задача создана: " + data.data.id + "\nassignee: " + draft.assignee + "\ngoal: " + draft.goalId
    );
  } catch (e) {
    await bot.sendMessage(msg.chat.id, "Task create error: " + e.message);
  }
});


bot.onText(/^\/no$/, async (msg) => {
  if (!isAllowedMessage(msg)) return;
  if (pendingTaskDrafts.has(msg.chat.id)) {
    pendingTaskDrafts.delete(msg.chat.id);
    return bot.sendMessage(msg.chat.id, "Черновик отменен.");
  }
  await bot.sendMessage(msg.chat.id, "Нет черновика для отмены.");
});

bot.onText(/^\/tasks(?:\s+(backlog|todo|in_progress|blocked|done|failed))?$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const status = (m && m[1] ? m[1].trim() : null);

  try {
    let q;
    if (status) {
      q = await pool.query(
        `
        select id,title,primary_goal_id,status,assignee
        from tasks
        where status = $1
        order by id desc
        limit 10
        `,
        [status]
      );
    } else {
      q = await pool.query(
        `
        select id,title,primary_goal_id,status,assignee
        from tasks
        order by id desc
        limit 10
        `
      );
    }

    if (!q.rows.length) {
      return bot.sendMessage(msg.chat.id, status ? `Tasks (${status}): 0` : "Tasks: 0");
    }

    const lines = q.rows.map((r, i) =>
      `${i + 1}. ${r.id} | ${r.status} | ${r.assignee}\n${r.title}\ngoal: ${r.primary_goal_id}`
    );

    const title = status ? `Tasks (${status})` : "Tasks (latest)";
    await bot.sendMessage(msg.chat.id, `${title}:\n\n${lines.join("\n\n")}`);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Tasks error: ${e.message}`);
  }
});

bot.onText(/^\/approvals(?:\s+(strategy|finance|pmo|orchestrator))?$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const approverRole = m && m[1] ? m[1].trim() : "strategy";
  try {
    const q = await pool.query(
      "select approval_id, action_class, entity_type, entity_id, requested_by_role, created_at " +
      "from approval_requests where approver_role = $1 and status = 'pending' " +
      "order by created_at asc limit 10",
      [approverRole]
    );

    if (!q.rows.length) return bot.sendMessage(msg.chat.id, "Pending approvals: 0");

    const lines = q.rows.map((r, i) => {
      const dt = new Date(r.created_at).toISOString().replace("T", " ").slice(0, 16);
      return (i + 1) + ". " + r.approval_id + "\n" + r.action_class + " | " + r.entity_type + ":" + r.entity_id + "\nby " + r.requested_by_role + " at " + dt;
    });

    await bot.sendMessage(msg.chat.id, "Pending approvals (" + q.rows.length + ") for " + approverRole + ":\n\n" + lines.join("\n\n"));
  } catch (e) {
    await bot.sendMessage(msg.chat.id, "Approvals error: " + e.message);
  }
});

bot.onText(/^\/approve\s+([A-Za-z0-9_-]+)(?:\s+--role=(strategy|finance|pmo|orchestrator))?$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const approvalId = m && m[1] ? m[1].trim() : "";
  const decidedByRole = m && m[2] ? m[2].trim() : "strategy";
  if (!approvalId) return bot.sendMessage(msg.chat.id, "Формат: /approve <approval_id> [--role=strategy|finance|pmo|orchestrator]");

  try {
    const resp = await fetch("http://127.0.0.1:3210/approvals/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approval_id: approvalId,
        decision: "approved",
        decided_by_role: decidedByRole,
        reason: "approved from telegram"
      }),
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !data.ok) {
      const msgText = data && data.error && data.error.message ? data.error.message : "HTTP " + resp.status;
      return bot.sendMessage(msg.chat.id, "Approve error: " + msgText);
    }

    await bot.sendMessage(msg.chat.id, "Approved: " + approvalId + " (role: " + decidedByRole + ")");
  } catch (e) {
    await bot.sendMessage(msg.chat.id, "Approve error: " + e.message);
  }
});

bot.onText(/^\/reject\s+([A-Za-z0-9_-]+)(?:\s+(.+))?$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const approvalId = m && m[1] ? m[1].trim() : "";
  let reasonRaw = m && m[2] ? m[2].trim() : "";
  let decidedByRole = "strategy";

  const roleMatch = reasonRaw.match(/\s--role=(strategy|finance|pmo|orchestrator)\s*$/);
  if (roleMatch) {
    decidedByRole = roleMatch[1];
    reasonRaw = reasonRaw.replace(/\s--role=(strategy|finance|pmo|orchestrator)\s*$/, "").trim();
  }

  const reason = reasonRaw || "rejected from telegram";
  if (!approvalId) return bot.sendMessage(msg.chat.id, "Формат: /reject <approval_id> [причина] [--role=strategy|finance|pmo|orchestrator]");

  try {
    const resp = await fetch("http://127.0.0.1:3210/approvals/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approval_id: approvalId,
        decision: "rejected",
        decided_by_role: decidedByRole,
        reason
      }),
    });

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !data.ok) {
      const msgText = data && data.error && data.error.message ? data.error.message : "HTTP " + resp.status;
      return bot.sendMessage(msg.chat.id, "Reject error: " + msgText);
    }

    await bot.sendMessage(msg.chat.id, "Rejected: " + approvalId + " (role: " + decidedByRole + ")");
  } catch (e) {
    await bot.sendMessage(msg.chat.id, "Reject error: " + e.message);
  }
});


bot.onText(/^\/org$/, async (msg) => {
  if (!isAllowedMessage(msg)) return;
  try {
    const rolesQ = await pool.query(
      `select role_id, title from roles where status='active' order by role_id`
    );
    const edgesQ = await pool.query(
      `select manager_role_id, child_role_id
       from org_edges
       where relation_type='reports_to'
       order by manager_role_id, child_role_id`
    );

    const children = {};
    for (const e of edgesQ.rows) {
      if (!children[e.manager_role_id]) children[e.manager_role_id] = [];
      children[e.manager_role_id].push(e.child_role_id);
    }

    const titleByRole = {};
    for (const r of rolesQ.rows) titleByRole[r.role_id] = r.title;

    const lines = [];
    lines.push("Org chart:");
    for (const manager of Object.keys(children)) {
      const childList = children[manager]
        .map((c) => `${c} (${titleByRole[c] || c})`)
        .join(", ");
      lines.push(`${manager} (${titleByRole[manager] || manager}) -> ${childList}`);
    }

    if (lines.length === 1) lines.push("Нет связей в org_edges.");

    await bot.sendMessage(msg.chat.id, lines.join("\n"));
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Org error: ${e.message}`);
  }
});

bot.onText(/^\/goals$/, async (msg) => {
  if (!isAllowedMessage(msg)) return;
  try {
    const q = await pool.query(
      `
      select id, stage, title
      from goals
      where status='active'
      order by
        case when stage is null then 0 when stage='A' then 1 when stage='B' then 2 when stage='C' then 3 else 4 end,
        id
      `
    );

    if (!q.rows.length) return bot.sendMessage(msg.chat.id, "Active goals: 0");

    const lines = ["Active goals:"];
    for (const r of q.rows) {
      const label = r.stage ? `[${r.stage}]` : "[MISSION]";
      lines.push(`${label} ${r.id} — ${r.title}`);
    }

    await bot.sendMessage(msg.chat.id, lines.join("\n"));
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Goals error: ${e.message}`);
  }
});

bot.onText(/^\/goal\s+([A-Za-z0-9_-]+)$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const goalId = m && m[1] ? m[1].trim() : "";
  if (!goalId) return bot.sendMessage(msg.chat.id, "Формат: /goal <goal_id>");

  try {
    const q = await pool.query(
      `
      with recursive ancestors as (
        select id,parent_id,title,stage,status,0 as depth
        from goals
        where id = $1
        union all
        select g.id,g.parent_id,g.title,g.stage,g.status,a.depth+1
        from goals g
        join ancestors a on g.id = a.parent_id and a.depth < 10
      )
      select depth,id,parent_id,title,stage,status
      from ancestors
      order by depth
      `,
      [goalId]
    );

    if (!q.rows.length) return bot.sendMessage(msg.chat.id, `Goal not found: ${goalId}`);

    const lines = [`Goal ancestry for ${goalId}:`];
    for (const r of q.rows) {
      const label = r.stage ? `[${r.stage}]` : "[MISSION]";
      lines.push(`${r.depth}. ${label} ${r.id} — ${r.title}`);
    }

    await bot.sendMessage(msg.chat.id, lines.join("\n"));
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Goal error: ${e.message}`);
  }
});


bot.onText(/^\/run\s+([A-Za-z0-9_-]+)$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const taskId = m && m[1] ? m[1].trim() : "";
  if (!taskId) return bot.sendMessage(msg.chat.id, "Формат: /run <task_id>");

  try {
    const resp = await fetch(
      "http://127.0.0.1:3210/tasks/" + encodeURIComponent(taskId) + "/claim",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_role: "human_telegram" }),
      }
    );

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !data.ok) {
      const msgText = data && data.error && data.error.message ? data.error.message : "HTTP " + resp.status;
      return bot.sendMessage(msg.chat.id, "Run error: " + msgText);
    }

    const assignee = data && data.data && data.data.assignee ? data.data.assignee : "n/a";
    await bot.sendMessage(msg.chat.id, "Task started: " + taskId + " (assignee: " + assignee + ")");
  } catch (e) {
    await bot.sendMessage(msg.chat.id, "Run error: " + e.message);
  }
});

bot.onText(/^\/done\s+([A-Za-z0-9_-]+)$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const taskId = m && m[1] ? m[1].trim() : "";
  if (!taskId) return bot.sendMessage(msg.chat.id, "Формат: /done <task_id>");

  try {
    const resp = await fetch(
      "http://127.0.0.1:3210/tasks/" + encodeURIComponent(taskId) + "/complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_role: "human_telegram", summary: "done via telegram" }),
      }
    );

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !data.ok) {
      const msgText = data && data.error && data.error.message ? data.error.message : "HTTP " + resp.status;
      return bot.sendMessage(msg.chat.id, "Done error: " + msgText);
    }

    await bot.sendMessage(msg.chat.id, "Task done: " + taskId);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, "Done error: " + e.message);
  }
});

bot.onText(/^\/block\s+([A-Za-z0-9_-]+)\s+(.+)$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const taskId = m && m[1] ? m[1].trim() : "";
  const reason = m && m[2] ? m[2].trim() : "";
  if (!taskId || !reason) return bot.sendMessage(msg.chat.id, "Формат: /block <task_id> <причина>");

  try {
    const resp = await fetch(
      "http://127.0.0.1:3210/tasks/" + encodeURIComponent(taskId) + "/block",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_role: "human_telegram", reason }),
      }
    );

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !data.ok) {
      const msgText = data && data.error && data.error.message ? data.error.message : "HTTP " + resp.status;
      return bot.sendMessage(msg.chat.id, "Block error: " + msgText);
    }

    await bot.sendMessage(msg.chat.id, "Task blocked: " + taskId + "\nreason: " + reason);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, "Block error: " + e.message);
  }
});

bot.onText(/^\/fail\s+([A-Za-z0-9_-]+)\s+(.+)$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const taskId = m && m[1] ? m[1].trim() : "";
  const reason = m && m[2] ? m[2].trim() : "";
  if (!taskId || !reason) return bot.sendMessage(msg.chat.id, "Формат: /fail <task_id> <причина>");

  try {
    const resp = await fetch(
      "http://127.0.0.1:3210/tasks/" + encodeURIComponent(taskId) + "/fail",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_role: "human_telegram", reason }),
      }
    );

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !data.ok) {
      const msgText = data && data.error && data.error.message ? data.error.message : "HTTP " + resp.status;
      return bot.sendMessage(msg.chat.id, "Fail error: " + msgText);
    }

    await bot.sendMessage(msg.chat.id, "Task failed: " + taskId + "\nreason: " + reason);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, "Fail error: " + e.message);
  }
});

bot.onText(/^\/reopen\s+([A-Za-z0-9_-]+)$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const taskId = m && m[1] ? m[1].trim() : "";
  if (!taskId) return bot.sendMessage(msg.chat.id, "Формат: /reopen <task_id>");

  try {
    const resp = await fetch(
      "http://127.0.0.1:3210/tasks/" + encodeURIComponent(taskId) + "/reopen",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor_role: "human_telegram" }),
      }
    );

    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !data.ok) {
      const msgText = data && data.error && data.error.message ? data.error.message : "HTTP " + resp.status;
      return bot.sendMessage(msg.chat.id, "Reopen error: " + msgText);
    }

    await bot.sendMessage(msg.chat.id, "Task reopened: " + taskId);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, "Reopen error: " + e.message);
  }
});


bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

console.log("stemford-telegram-bridge started");

let bridgeShuttingDown = false;
async function shutdownBridge(signal) {
  if (bridgeShuttingDown) return;
  bridgeShuttingDown = true;
  console.log(`telegram-bridge shutdown: ${signal}`);

  const forceTimer = setTimeout(() => {
    console.error("telegram-bridge force exit after timeout");
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  try {
    await bot.stopPolling();
  } catch (e) {
    console.error("stopPolling error:", e.message);
  }

  try {
    await pool.end();
  } catch (e) {
    console.error("bridge pool.end error:", e.message);
  }

  process.exit(0);
}

process.on("SIGTERM", () => { void shutdownBridge("SIGTERM"); });
process.on("SIGINT", () => { void shutdownBridge("SIGINT"); });
