# ROADMAP: OpenClaw-front + CI/CD-back

Version: 1.1
Status: Active
Owner: Stemford engineering

## 1) Назначение

Эта дорожная карта описывает целевую систему, где:
1. OpenClaw-front отвечает за человекочитаемое взаимодействие и координацию этапов.
2. CI/CD-back отвечает за надежное исполнение изменений и технические gate-проверки.
3. Веб Task Board (Kanban) дает прозрачную визуальную картину работы команды.

## 2) Принципы

1. Два обязательных касания владельца на каждом этапе: Start и End.
2. Автономная работа агентов внутри этапа.
3. Без ложных SUCCESS: успех только при выполнении формальных критериев.
4. Человекочитаемый UX без технического шума.
5. Safety-first: рискованные действия только с явным подтверждением.

## 2.1) Product order lock

Порядок вывода продукта фиксируется явно:
1. Первый продуктовый контур = `Coder Factory` (отдел программистов).
2. Второй контур = `Business Control Plane` для управляющего Stemford, который строится уже силами coder factory.
3. Третий уровень = reusable platform / service layer для внедрения в любой бизнес.

Это означает:
1. Task Board MVP в рамках текущего roadmap в первую очередь относится к coder pipeline.
2. Business dashboard не должен размывать приоритет E3-E4.
3. Любой drift в сторону "универсального Trello для бизнеса" считается отклонением от текущего фокуса.

## 3) Целевая архитектура

1. OpenClaw-front:
- Orchestrator (единая точка общения с владельцем)
- Executor/Reviewer/Deployer как ролевые агенты
- Task Contract из естественного языка

2. CI/CD-back:
- state machine цикла: executor -> commit -> reviewer gate -> deployer -> smoke
- preflight, single-flight lock, retry policy, dead-letter
- формальные exit-коды и reason-коды

3. Control API:
- task bus
- approvals
- actions log / runs
- API для dashboard

4. UX слои:
- Telegram: разговорный интерфейс
- Web Dashboard: визуальный контроль
- Task Board: Kanban по задачам

## 4) Этапы внедрения (без календарных сроков)

## E0. Стабилизация базового контура

Цель: убрать ложные статусы и недетерминированность.

DoD:
1. Ложных SUCCESS = 0.
2. Все финальные статусы однозначны и человекочитаемы.
3. NO_DIFF отделен от EXECUTOR_ERROR.

## E1. OpenClaw-front как компилятор задач

Цель: переводить запрос владельца в строгий внутренний Task Contract.

Task Contract содержит:
1. цель
2. scope (что можно/нельзя менять)
3. risk level
4. Definition of Done
5. expected checks

DoD:
1. Для каждой задачи есть Task Contract.
2. Не больше одного уточнения при нормальном сценарии.
3. На каждом этапе есть обязательные Start/End сообщения.

## E2. Hardening CI/CD-back

Цель: сделать конвейер отказоустойчивым и объяснимым.

DoD:
1. Единая state machine и exit-коды.
2. Retry только для технических сбоев.
3. Dead-letter после лимита попыток.
4. Для любого FAIL есть понятный next step.

## E3. Task Board (Kanban) MVP

Цель: визуальная прозрачность задач и этапов.

DoD:
1. Все активные задачи видны на доске.
2. Статусы синхронны с БД/API.
3. По каждой карточке доступны owner/action/run/checks.
4. В первой версии доска ориентирована на coder tasks, а не на общий бизнес-backlog.

## E4. Ролевой OpenClaw-контур кодеров

Цель: автономный handoff внутри этапа при сохранении жестких gate.

DoD:
1. Handoff идет через task bus, а не через ручные скриптовые ветки.
2. Orchestrator остается единственной точкой общения с владельцем.
3. Надежность не ниже baseline E2.
4. На карточке и в timeline видны роли `executor / reviewer / deployer`.

## E5. Deferred-patterns из AAF

Цель: расширить автономность после стабилизации.

DoD:
1. Event-driven очередь и lifecycle run.
2. Watchdog/self-heal на уровне сервисов.
3. Плагинный слой только с allowlist.

## 4.1) Детальный план внедрения (исполняемый)

Детальный пошаговый план исполнения вынесен в:
1. `plans/PLAN_Implementation_Reliability_Kanban.md`
2. `plans/PLAN_UX_CoderFactory_and_Business_Control.md`

Связка roadmap -> execution:
1. E0-E1 = Фазы A-B (state machine + gate + quality checklist).
2. E2 = Фазы C-D (review discipline + task isolation).
3. E3-E4 = Фаза E (web-пульт и управляемый multi-agent процесс).
4. E5 = Фаза F (операционная надежность и эксплуатация).
5. UX-логика и разделение coder/business dashboard зафиксированы в отдельном UX blueprint.

## 5) Формальные критерии SUCCESS

SUCCESS только если одновременно:
1. cycle exit = 0
2. есть новый commit SHA в рамках текущего run
3. reviewer: P1 = 0
4. smoke: PASS по обязательным сценариям

Если commit отсутствует:
1. ALREADY_UP_TO_DATE (если задача уже выполнена), или
2. EXECUTOR_FAILED_NO_DIFF (если требуемый diff не создан)

## 6) UX-протокол

## Start

1. Что будет сделано.
2. Что не будет изменяться.
3. Критерий успеха.
4. Нужен ли approve.

## End

1. Статус понятным языком.
2. Что реально сделано.
3. Проверки (коротко).
4. Коммит (или "новых изменений нет").
5. Следующий шаг.

## 7) Risk policy

1. Low-risk: автозапуск.
2. Medium-risk: автозапуск + явное предупреждение.
3. High-risk: обязательное подтверждение владельца.

High-risk включает:
1. destructive shell operations
2. schema/data destructive operations
3. системные команды вне allowlist
4. внешние действия с необратимым эффектом

## 8) Task Board (Kanban) — подробная реализация

Важная фиксация:
1. Ниже описан прежде всего `Coder Dashboard`.
2. `Business Dashboard` появляется после стабилизации E4 и использует тот же engine, но другой UX-слой.
3. Подробный UX-контракт вынесен в `plans/PLAN_UX_CoderFactory_and_Business_Control.md`.

## Колонки

1. Backlog
2. Ready
3. In Progress
4. Review
5. Blocked
6. Done

## Поля карточки

1. task_id
2. title
3. stage
4. status
5. assignee
6. risk_level
7. blocked_reason
8. needs_approval
9. updated_at
10. last_run_status
11. last_commit
12. checks_summary

## Действия на карточке (MVP)

1. Открыть детали задачи.
2. Посмотреть run history.
3. Перейти к логам.
4. Approve / Reject (если нужен выбор владельца).
5. Pause / Resume.

## API для Kanban MVP

1. GET /tasks?view=kanban
2. GET /tasks/:id
3. GET /tasks/:id/runs
4. GET /approvals/pending/summary
5. POST /approvals/:id/approve
6. POST /approvals/:id/reject
7. GET /health/summary

## Обновление данных

1. MVP: polling 3-5 секунд.
2. V2: WebSocket/stream updates.

## Режимы отображения

1. Owner view: полный технический контекст.
2. CEO view: задачи, блокеры, решения и next step без тех-шума.

## 9) Метрики качества

1. False SUCCESS rate
2. Cycle success rate
3. Mean time to clear blocker
4. Review block clarity rate
5. Dashboard freshness lag
6. Stage Start/End compliance

## 10) Границы и отложенный scope

В текущий этап НЕ входят:
1. Multi-company tenancy
2. Docker-in-Docker с docker.sock
3. Full GraphRAG memory stack для кодерского контура
4. Полностью автономный self-modifying loop без human gate

## 11) Статус внедрения (срез на 2026-03-28)

Готово:
1. Базовый Control API в рабочем контуре.
2. `GET /health/summary`.
3. Kanban API: `GET /tasks?view=kanban`.
4. Web dashboard endpoint: `/dashboard`.
5. Gate-команды в Telegram: `/gate_start` и `/gate_end`.
6. Миграция `011_task_step_gates_and_chat.sql` (task gates + chat table).

В работе:
1. Доведение quality checklist до обязательного hard-gate перед `Done`.
2. Полная дисциплина review P1/P2 на уровне серверных ограничений.
3. Расширение dashboard до «операционного пульта» (таймлайн, ревью, быстрые действия).

Следующий фокус:
1. Завершить Фазы A-B из `PLAN_Implementation_Reliability_Kanban.md`.
