# OPEN ISSUES

## Назначение
Короткий список актуальных незакрытых вопросов по структуре и эксплуатации.

Правило:
- Этот файл хранит только текущие открытые вопросы.
- После закрытия вопрос удаляется отсюда и фиксируется в профильном документе.

## Актуально на 2026-03-17

### Операционный чек (done, для ревью Claude)

- 2026-03-17: закрыты хвосты по retry/watchdog из P2 ревью:
  - `retry_after`-барьер в `POST /tasks/:id/claim` (код `retry_not_ready`).
  - rollback-скрипт для миграции `007`.
  - defensive fallback в `GET /tasks` при отсутствии `retry_*` колонок.
  - миграция `008_add_system_watchdog_role.sql` применена.
  - watchdog оформлен как `systemd`-артефакт в репо и включён на VPS через timer, старый cron выключен.
- Подтверждение:
  - код в `main` (включая `app/control-api/systemd/*` и fallback в `app/control-api/server.js`);
  - runtime-проверка на VPS: `stemford-stall-watchdog.timer` активен, `stemford-stall-watchdog.service` отрабатывает с `status=0/SUCCESS`.
  - `OI-6`: Role Definition (6 полей) формализован в `agents/*/SOUL.md`.
  - `OI-7`: ритуал ревью `actions_log` формализован в `docs/review/AUDIT_LOG_REVIEW_RITUAL.md`.

### P2 backlog — из анализа книги Headcount Zero

| # | Задача | Контекст | Этап |
|---|--------|----------|------|
| — | Нет открытых P2 по блоку Headcount Zero | OI-6 и OI-7 закрыты и перенесены в done-блок выше | — |
