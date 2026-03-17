# AGENTS.md

This file is a minimal router for AI tooling.

Start context levels:
1. `T0` (mandatory): read `START_HERE.md` (primary collaboration contract).
2. `T1` (on trigger): read `PAPERCLIP_FRAMEWORK_MASTER.md` only when task needs file-role navigation, structure status, or placement of a new artifact.
3. `T2` (task-specific): open profile files from `START_HERE.md` rails only when needed for the current step.

Rule:
- If any instruction conflicts with a new direct user request, follow the latest explicit user decision.
- If context compaction risk is detected, execute `Context Degradation Protocol (CDP)` from `MEMORY_PROTOCOL.md` before continuing edits.
- If an expectation miss is confirmed, register it via `npm run quality:guard -- --result miss`; on the second consecutive miss execute stop-and-reframe immediately.
- If a required context file is unavailable, execute fallback order from `MEMORY_PROTOCOL.md` (section `7`) and return a safe constrained step instead of speculative decisions.
- For Stemford operational tasks, stay inside Stemford scope and do not scan `jarvis-ref` / Jarvis-contour artifacts unless the user explicitly asks for it.
- Pair mode is allowed (`Codex <-> Claude`): implementation and review may alternate between agents. Keep an explicit step-by-step action trail suitable for handoff review (what changed, why, result, open risks/next step).
- Before each new command/edit, briefly explain in plain language what will be done now and why.

## Executor / Reviewer Loop (Codex + Claude)

Роли чередуются. По умолчанию: Codex = Executor, Claude = Reviewer (на следующей задаче можно поменять).

### Цикл на каждую задачу

1. **Executor** работает в отдельной ветке (1 ветка = 1 логический кусок: retry, watchdog, reconcile — отдельно).
2. **Executor** пушит + пишет handoff-блок: `Changes / Checks / Open risks`.
3. **Reviewer** делает ревью, ставит приоритеты: P1 (блокер) / P2 (follow-up).
4. **Executor** фиксит все P1. P2 уходят в отдельный backlog-коммит.
5. **Reviewer** подтверждает: P1=0 + smoke-проверки приложены → готово к мержу.
6. **Merge** в локальном git-клоне (не на VPS).
7. **Deploy** отдельным шагом на VPS: `git pull → migrate → restart → smoke`.

### Правила

- Блокер = только P1. Без P1=0 мерж запрещён.
- P2 = не блокирует мерж, фиксируется в backlog.
- VPS — только применение, не разработка.
- Smoke-проверки обязательны перед мержем (curl / manual test / log check).
- **Git**: Executor делает `git add / commit / push` самостоятельно. Не проси человека запускать git-команды руками.

### Журнал ревью (единый источник правды)

- **`docs/review/HANDOFF_LOG.md`** — запись на каждый цикл: Changes / Checks / Open risks / Review ask / Verdict.
- **`docs/review/DEPLOY_LOG.md`** — запись на каждый деплой: SHA, migrate, restart, smoke.
- В каждом commit message добавлять `Handoff: H-YYYY-MM-DD-NN`.
- **Merge gate**: мерж только если `Verdict: P1=0`.
- **Deploy gate**: отдельная запись в DEPLOY_LOG после мержа.
