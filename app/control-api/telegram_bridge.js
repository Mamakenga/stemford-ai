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
  pendingTaskDrafts.set(msg.chat.id, {
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
  const draft = pendingTaskDrafts.get(msg.chat.id);
  if (!draft) return bot.sendMessage(msg.chat.id, "Нет черновика для подтверждения.");

  const id = `tg_${Date.now()}`;
  try {
    await pool.query(
      `
      insert into tasks (id,title,primary_goal_id,status,assignee)
      values ($1,$2,$3,'todo',$4)
      `,
      [id, draft.title, draft.goalId, draft.assignee]
    );

    pendingTaskDrafts.delete(msg.chat.id);
    await bot.sendMessage(
      msg.chat.id,
      `Задача создана: ${id}\nassignee: ${draft.assignee}\ngoal: ${draft.goalId}`
    );
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Task create error: ${e.message}`);
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

bot.onText(/^\/approvals$/, async (msg) => {
  if (!isAllowedMessage(msg)) return;
  try {
    const q = await pool.query(
      `
      select approval_id, action_class, entity_type, entity_id, requested_by_role, created_at
      from approval_requests
      where approver_role = 'strategy' and status = 'pending'
      order by created_at asc
      limit 10
      `
    );

    if (!q.rows.length) return bot.sendMessage(msg.chat.id, "Pending approvals: 0");

    const lines = q.rows.map((r, i) => {
      const dt = new Date(r.created_at).toISOString().replace("T", " ").slice(0, 16);
      return `${i + 1}. ${r.approval_id}\n${r.action_class} | ${r.entity_type}:${r.entity_id}\nby ${r.requested_by_role} at ${dt}`;
    });

    await bot.sendMessage(msg.chat.id, `Pending approvals (${q.rows.length}):\n\n${lines.join("\n\n")}`);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Approvals error: ${e.message}`);
  }
});

bot.onText(/^\/approve\s+([A-Za-z0-9_-]+)$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const approvalId = m && m[1] ? m[1].trim() : "";
  if (!approvalId) return bot.sendMessage(msg.chat.id, "Формат: /approve <approval_id>");

  try {
    const q = await pool.query(
      `
      update approval_requests
      set status='approved', decided_by_role='strategy', reason='approved from telegram', decided_at=now()
      where approval_id=$1 and approver_role='strategy' and status='pending'
      returning approval_id
      `,
      [approvalId]
    );
    if (!q.rows.length) return bot.sendMessage(msg.chat.id, `Не найден pending approval: ${approvalId}`);
    await bot.sendMessage(msg.chat.id, `Approved: ${q.rows[0].approval_id}`);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Approve error: ${e.message}`);
  }
});

bot.onText(/^\/reject\s+([A-Za-z0-9_-]+)(?:\s+(.+))?$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const approvalId = m && m[1] ? m[1].trim() : "";
  const reason = (m && m[2] ? m[2].trim() : "rejected from telegram");
  if (!approvalId) return bot.sendMessage(msg.chat.id, "Формат: /reject <approval_id> [причина]");

  try {
    const q = await pool.query(
      `
      update approval_requests
      set status='rejected', decided_by_role='strategy', reason=$2, decided_at=now()
      where approval_id=$1 and approver_role='strategy' and status='pending'
      returning approval_id
      `,
      [approvalId, reason]
    );
    if (!q.rows.length) return bot.sendMessage(msg.chat.id, `Не найден pending approval: ${approvalId}`);
    await bot.sendMessage(msg.chat.id, `Rejected: ${q.rows[0].approval_id}`);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Reject error: ${e.message}`);
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
        join ancestors a on g.id = a.parent_id
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
    const q = await pool.query(
      `update tasks
       set status='in_progress'
       where id=$1 and status in ('todo','blocked')
       returning id,status,assignee`,
      [taskId]
    );
    if (!q.rows.length) return bot.sendMessage(msg.chat.id, `Не удалось перевести в in_progress: ${taskId}`);
    await bot.sendMessage(msg.chat.id, `Task started: ${q.rows[0].id} (assignee: ${q.rows[0].assignee})`);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Run error: ${e.message}`);
  }
});

bot.onText(/^\/done\s+([A-Za-z0-9_-]+)$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const taskId = m && m[1] ? m[1].trim() : "";
  if (!taskId) return bot.sendMessage(msg.chat.id, "Формат: /done <task_id>");

  try {
    const q = await pool.query(
      `update tasks
       set status='done'
       where id=$1 and status in ('todo','in_progress','blocked')
       returning id,status`,
      [taskId]
    );
    if (!q.rows.length) return bot.sendMessage(msg.chat.id, `Не удалось закрыть задачу: ${taskId}`);
    await bot.sendMessage(msg.chat.id, `Task done: ${q.rows[0].id}`);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Done error: ${e.message}`);
  }
});

bot.onText(/^\/block\s+([A-Za-z0-9_-]+)\s+(.+)$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const taskId = m && m[1] ? m[1].trim() : "";
  const reason = m && m[2] ? m[2].trim() : "";
  if (!taskId || !reason) return bot.sendMessage(msg.chat.id, "Формат: /block <task_id> <причина>");

  try {
    const q = await pool.query(
      `update tasks
       set status='blocked'
       where id=$1 and status in ('todo','in_progress')
       returning id,status`,
      [taskId]
    );
    if (!q.rows.length) return bot.sendMessage(msg.chat.id, `Не удалось заблокировать задачу: ${taskId}`);
    await bot.sendMessage(msg.chat.id, `Task blocked: ${q.rows[0].id}\nreason: ${reason}`);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Block error: ${e.message}`);
  }
});

bot.onText(/^\/fail\s+([A-Za-z0-9_-]+)\s+(.+)$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const taskId = m && m[1] ? m[1].trim() : "";
  const reason = m && m[2] ? m[2].trim() : "";
  if (!taskId || !reason) return bot.sendMessage(msg.chat.id, "Формат: /fail <task_id> <причина>");

  try {
    const q = await pool.query(
      `update tasks
       set status='failed'
       where id=$1 and status in ('todo','in_progress','blocked')
       returning id,status`,
      [taskId]
    );
    if (!q.rows.length) return bot.sendMessage(msg.chat.id, `Не удалось перевести в failed: ${taskId}`);
    await bot.sendMessage(msg.chat.id, `Task failed: ${q.rows[0].id}\nreason: ${reason}`);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Fail error: ${e.message}`);
  }
});



bot.onText(/^\/reopen\s+([A-Za-z0-9_-]+)$/, async (msg, m) => {
  if (!isAllowedMessage(msg)) return;
  const taskId = m && m[1] ? m[1].trim() : "";
  if (!taskId) return bot.sendMessage(msg.chat.id, "Формат: /reopen <task_id>");

  try {
    const q = await pool.query(
      `update tasks
       set status='todo'
       where id=$1 and status in ('done','failed','blocked')
       returning id,status`,
      [taskId]
    );
    if (!q.rows.length) return bot.sendMessage(msg.chat.id, `Не удалось reopen: ${taskId}`);
    await bot.sendMessage(msg.chat.id, `Task reopened: ${q.rows[0].id}`);
  } catch (e) {
    await bot.sendMessage(msg.chat.id, `Reopen error: ${e.message}`);
  }
});


bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

console.log("stemford-telegram-bridge started");
