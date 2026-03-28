# План реализации OpenClaw Control Plane (отдел из "джарвисов")

## 1) Цель плана
Собрать поверх OpenClaw устойчивый контур управления командой агентов:
- агенты работают проактивно по расписанию и событиям;
- агенты могут вызывать друг друга по формальному протоколу handoff;
- задачи, цели, статусы и решения хранятся в структурированном data layer;
- Telegram остается удобной "панелью управления" для человека.

Идея:
- `OpenClaw` = runtime исполнения агентов;
- `Control Plane` = оркестрация, состояние, надежность и контроль.

## 1.1) Порядок продуктовой сборки (обязательная фиксация)
Чтобы не потерять исходную логику проекта, порядок реализации фиксируется явно:
1. Сначала разворачиваем `AI software factory` — отдел программистов с ролями `executor / reviewer / deployer`.
2. Затем этот отдел программистов сам допиливает бизнес-контур — "отдел джарвисов" для управляющего Stemford.
3. Только после стабилизации обоих уровней обобщаем решение в масштабируемую платформу/услугу для внедрения в любой бизнес.

Отдельные продуктовые планы:
1. `plans/PLAN_Coder_Factory.md`
2. `plans/PLAN_Business_Control_Plane.md`
3. `plans/PLAN_Service_Productization.md`

Следствие:
1. Первый главный dashboard = пульт фабрики кодеров.
2. Business dashboard = второй слой, а не первая цель.
3. Любые UX-решения для web-пульта сначала проверяются на полезность для coder-factory pipeline.

## 2) Что входим в MVP, а что нет
### Входит в MVP
1. DB-first слой состояния (`goals/tasks/agents/runs/handoffs/actions_log`).
2. API слой (локальный сервис) для чтения/записи состояния.
3. Оркестратор маршрутов и handoff между ролями.
4. Базовая надежность: idempotency, retry, dead-letter, watchdog.
5. Базовая наблюдаемость и операционные runbook.

### Не входит в MVP
1. Полный UI уровня Paperclip.
2. Сложная RBAC-модель уровня enterprise.
3. Автономные облачные агенты с внешними API-биллингами.

## 3) Архитектура целевого состояния
1. Execution Layer:
- OpenClaw, skills, heartbeat/cron, Telegram-канал.
2. Control Data Layer:
- SQLite (старт) -> PostgreSQL (масштабирование).
- SQL-схема + миграции + ограничения целостности.
3. Control API Layer:
- Локальный сервис `127.0.0.1`, JSON API для агентов.
4. Orchestration Layer:
- оркестратор, маршруты S/M/L, межагентные handoff, anti-loop.
5. Artifact Layer:
- markdown-файлы остаются как документы (брифы/планы/итоги), но не как источник статуса.

## 4) Принципы реализации
1. Один источник истины по статусам = БД.
2. Файлы = человекочитаемые артефакты, БД = операционное состояние.
3. Любое действие агента с эффектом фиксируется в `actions_log`.
4. Никаких "немых" автозапусков: у каждого запуска есть `run_id`, статус и причина.
5. Каждый этап закрывается измеримыми критериями готовности.

## 5) Пошаговая дорожная карта
Актуальная дорожная карта внедрения (детальная, по шагам) вынесена в:
1. `plans/PLAN_Implementation_Reliability_Kanban.md`
2. `plans/PLAN_UX_CoderFactory_and_Business_Control.md`

Это сделано, чтобы:
1. разделить стратегический план и операционный план внедрения;
2. отдельно зафиксировать UX-контракт для coder factory и business control plane;
3. вести реализацию по ясным фазам, без дублирования и конфликтов между документами.

Текущая каноника этапов внедрения:
1. Фаза A: нормализация статус-машины (жесткие переходы).
2. Фаза B: усиление start/end gate и quality checklist перед `Done`.
3. Фаза C: дисциплина ревью P1/P2 (блокировка при `P1 > 0`).
4. Фаза D: изоляция задач и run hygiene (одна задача = один чистый контекст выполнения).
5. Фаза E: развитие web-пульта (kanban + карточка + чат + действия).
6. Фаза F: операционный контур надежности (health/runbook/smoke после релиза).

Ключевой принцип этой ревизии:
1. сначала надежность и управляемость процесса;
2. затем масштабирование автономности.
3. сначала coder factory, потом business control plane, потом reusable platform.

## 6) Риски и контрмеры
1. Риск: "перегруз документацией и процессом".
- Контрмера: минимальный обязательный артефакт на этап, остальное по требованию.
2. Риск: "loop между агентами".
- Контрмера: hard limit на глубину/повторы + обязательная эскалация.
3. Риск: "SQLite блокировки при росте".
- Контрмера: WAL + короткие транзакции + план миграции на PostgreSQL.
4. Риск: "разрыв между файлами и БД".
- Контрмера: БД как источник статуса, файлы как отчеты; регулярная сверка.
5. Риск: "тихие падения cron/heartbeat".
- Контрмера: watchdog + Telegram alerts + daily health report.

## 7) План миграции SQLite -> PostgreSQL (когда станет тесно)
Триггеры миграции:
1. Регулярные `SQLITE_BUSY` под рабочей нагрузкой.
2. Рост параллельных запусков.
3. Требование более сложной аналитики и конкурентной записи.

Порядок:
1. Заморозка схемы версии `v1`.
2. Экспорт данных и dry-run миграции.
3. Переключение API на PostgreSQL.
4. Прогон regression smoke.
5. Возврат в работу.

## 8) Таймлайн (реалистичный)
1. Неделя 1: Этапы 0-2 (контракт + DB + API + skill).
2. Неделя 2: Этап 3 (надежность) + часть этапа 4 (handoff).
3. Неделя 3: завершение этапов 4-5 (проактивность + наблюдаемость).
4. Неделя 4: Этап 6 (боевой пилот + корректировки).

Итого: 3-4 недели до устойчивого MVP уровня "отдел из джарвисов".

## 9) Definition of Done для MVP
1. Есть единый реестр задач/целей/запусков в БД.
2. Есть рабочие multi-agent handoff и anti-loop.
3. Есть retry/dead-letter/watchdog.
4. Есть health checks и восстановление по runbook.
5. Есть минимум 1 успешный боевой сценарий end-to-end.
6. Человек управляет через Telegram и получает понятный executive summary.


## 10) Контракт очереди (обязательный, до боевого пилота)
Цель: формализовать поведение очереди задач, чтобы исключить дубли, гонки и потерю состояния.

Обязательные операции:
1. `claim(task_id, worker_id)` - атомарно берет задачу в работу, если она свободна.
2. `lease(run_id, ttl)` - продлевает «аренду» задачи во время выполнения.
3. `ack(run_id)` - фиксирует успешное завершение шага/задачи.
4. `requeue(run_id, reason)` - возвращает задачу в очередь с причиной и backoff.

Обязательные поля в модели очереди:
1. `status` (`queued|claimed|running|done|failed|dead_letter`).
2. `claimed_by`, `claimed_at`, `lease_until`.
3. `attempt_count`, `max_attempts`, `next_attempt_at`.
4. `idempotency_key`, `last_error_code`, `last_error_message`.

Gate-критерий (обязательный):
1. Один и тот же `idempotency_key` не может породить дублирующий run.
2. После истечения lease задача либо requeue, либо dead-letter, но не зависает бесконечно.

## 11) Политика миграций схемы (обязательная)
Цель: изменять БД безопасно, без поломки процесса и потери данных.

Правила:
1. Каждое изменение схемы идет через версионированную миграцию (`vNNN`).
2. Любая миграция имеет `up` и `rollback` сценарий.
3. Перед применением на рабочем контуре обязателен dry-run на копии данных.
4. Запрещены «ручные» изменения схемы в production без миграции.
5. Контракт обратной совместимости: API не ломается в пределах минорной версии.

Gate-критерий (обязательный):
1. На каждый релиз схемы есть запись: версия, цель, риск, rollback, факт проверки.

## 12) Failure Matrix и тесты отказов (обязательные)
Цель: доказать устойчивость не на словах, а на воспроизводимых сценариях отказа.

Минимальная матрица отказов:
1. Провайдер недоступен (network/timeout).
2. Падение процесса в середине handoff.
3. Перезапуск сервиса во время running-задач.
4. Конфликт claim (два воркера пытаются взять одну задачу).
5. Повторное событие с тем же `idempotency_key`.
6. Исчерпаны попытки retry -> переход в dead-letter.

Для каждого кейса фиксируется:
1. Ожидаемое поведение.
2. Фактическое поведение.
3. Время восстановления.
4. Нужна ли ручная эскалация.

Gate-критерий (обязательный):
1. Все кейсы матрицы имеют `PASS/WARN/FAIL` и артефакты проверки.

## 13) SLA и эскалация (операционный контур)
Цель: заранее определить, что считается инцидентом и кто за него отвечает.

Минимальные SLA для MVP:
1. P1 (критический простой оркестрации): реакция до 15 минут.
2. P2 (деградация части маршрутов): реакция до 60 минут.
3. P3 (некритичные сбои/долги): фиксация в backlog в тот же день.

Правила эскалации:
1. P1: немедленный alert в Telegram + остановка новых запусков рискованного маршрута.
2. P2: alert + автоматический fallback на безопасный маршрут.
3. P3: запись в `OPEN_ISSUES`/backlog с владельцем и сроком.

Операционные роли:
1. Incident owner (кто ведет восстановление).
2. Approver (кто принимает решение о временных обходах).
3. Reporter (кто фиксирует postmortem и корректирующие действия).

Gate-критерий (обязательный):
1. Для P1/P2 есть рабочий runbook с пошаговым восстановлением.

## 14) Дополнение к Definition of Done MVP
Дополнительно к разделу 9, MVP считается завершенным только если:
1. Формально принят контракт очереди `claim/lease/ack/requeue`.
2. Есть журнал миграций схемы и проверенный rollback последней версии.
3. Пройдена минимальная failure matrix с артефактами.
4. SLA и эскалация P1/P2 подтверждены тестовым инцидентом.

## 15) Goal ancestry — обязательный контракт (итог сравнения Paperclip/OpenClaw)
Цель: зафиксировать, как в OpenClaw реализуется жесткая иерархия целей уровня Paperclip и где мы идем дальше.

Непреодолимых ограничений нет:
1. Реализация возможна полностью, если иерархия enforced на уровне БД и API.
2. Мягкие правила в markdown/SOUL недостаточны без технических ограничений.

Реальные ограничения (инженерные, а не концептуальные):
1. Это не "из коробки": нужен отдельный data/API слой.
2. Исторические задачи нужно привязать к целям (очистка "сирот").
3. Без hard validation в API drift останется.

Базовые требования (minimum parity с Paperclip):
1. Иерархия Mission -> Stage(A/B/C) -> Goal -> Task обязательна.
2. tasks.goal_id обязательный (NOT NULL).
3. Запрет на создание task для неактивной goal.
4. Endpoint GET /goals/:id/ancestry обязателен для подъема цепочки "зачем".
5. Любой run стартует только после проверки ancestry-цепочки.

Как сделать лучше, чем Paperclip (для отдела из джарвисов):
1. У каждой task есть primary_goal_id (обязательный) плюс secondary_goal_links (опционально).
2. У каждой goal есть KPI, deadline и definition of done (не только title/description).
3. При закрытии task фиксируется вклад в KPI (дельта/оценка эффекта) в run-log.
4. Включена версионность goals, чтобы смена стратегии не ломала историю.

Обязательные поля v1:
1. goals: id, parent_id, stage, title, status, kpi_name, kpi_target, due_at, version.
2. tasks: id, title, primary_goal_id, status, assignee, due_at.
3. task_goal_links: task_id, goal_id, link_type (для secondary связей).

Gate-критерии (обязательные):
1. 100% новых задач создаются только с валидной ancestry-цепочкой.
2. 0% "сирот" в новых задачах после включения контракта.
3. Любой agent-run без ancestry-check получает blocked и логирует причину.
4. На пилоте подтверждено: итоговый summary содержит явную связь Task -> Goal -> Mission.

## 16) Goal ancestry — техническое усиление v1
Цель: превратить ancestry из декларации в проверяемый runtime-контракт.

Обязательный артефакт: рекурсивный SQL-запрос ancestry
1. Для любой task ancestry поднимается через `WITH RECURSIVE`:
```sql
WITH RECURSIVE ancestors AS (
  SELECT id, parent_id, title, stage, status
  FROM goals
  WHERE id = :goal_id
  UNION ALL
  SELECT g.id, g.parent_id, g.title, g.stage, g.status
  FROM goals g
  JOIN ancestors a ON g.id = a.parent_id
)
SELECT * FROM ancestors;
```
2. Этот запрос обязателен для pre-run проверки "зачем".
3. Контракт переносим между SQLite и PostgreSQL без изменения логики запроса.

Ограничение глубины и защита от циклов
1. На уровне схемы: `CHECK (id <> parent_id)`.
2. На уровне API: максимальная глубина ancestry `<= 5` (Mission -> Stage -> Goal -> Sub-goal -> Task).
3. При попытке создать цикл или глубину > 5 API возвращает `validation_error` и пишет событие в `actions_log`.

Cleanup legacy-данных (исторические "сироты")
1. Шаг инвентаризации: посчитать все legacy task без валидного `goal_id`.
2. Временная стратегия: привязка к технической цели `Legacy/Unclassified` с обязательной ручной сортировкой.
3. Плановая стратегия: разнос legacy task по целям A/B/C.
4. Gate: ancestry enforcement включается только после 100% привязки legacy task.

Визуализация для человека (Telegram-first)
1. Добавить endpoint `GET /goals/tree`.
2. Формат ответа: ASCII/markdown дерево для быстрого чтения в Telegram.
3. Команда управления: "покажи дерево целей" возвращает актуальную иерархию Mission -> ... -> Task.

Gate-критерии (обязательные):
1. `GET /goals/:id/ancestry` и `GET /goals/tree` покрыты smoke-тестом.
2. В проде нет task без `primary_goal_id`.
3. Проверка глубины/циклов работает и фиксируется в журнале событий.

## 17) Org chart — MVP Core контракт (без overengineering)
Цель: формально описать иерархию агентов и правила handoff в данных, а не в тексте SOUL.

Непреодолимых ограничений нет:
1. Модель уровня Paperclip реализуется в OpenClaw через БД + API + runtime-валидацию.
2. SOUL остается слоем поведения роли, но не источником орг-правил.

### 17.1 Обязательная схема MVP (только 3 таблицы)
1. `roles`:
- `role_id` (PK)
- `title`
- `domain` (strategy/finance/pmo/orchestration)
- `status` (active/inactive)
2. `org_edges`:
- `manager_role_id` (FK -> roles.role_id)
- `child_role_id` (FK -> roles.role_id)
- `relation_type` (`reports_to`)
3. `handoff_policies`:
- `caller_role_id` (FK -> roles.role_id)
- `callee_role_id` (FK -> roles.role_id)
- `allowed` (0/1)
- `notes`

Важно:
1. Таблицы `permissions` и `approvals` не входят в MVP (перенесены в v2).
2. Если `1 role = 1 agent`, отдельная таблица `agents` не обязательна для MVP.

### 17.2 Обязательные endpoint'ы MVP (только 3)
1. `GET /org/chart` — вернуть текущее дерево ролей.
2. `POST /handoff/validate` — можно ли роли A вызвать роль B.
3. `POST /handoff/execute` — выполнить разрешенный handoff и записать событие в `actions_log`.

### 17.3 Конкретный оргчарт для отдела джарвисов (текущий контекст)
```text
Human Owner
└── Orchestrator
    ├── Strategy Gatekeeper
    ├── Finance KPI
    └── PMO
```

Handoff matrix MVP:
1. orchestrator -> strategy: allowed
2. orchestrator -> finance: allowed
3. orchestrator -> pmo: allowed
4. strategy -> orchestrator: allowed
5. finance -> orchestrator: allowed
6. pmo -> orchestrator: allowed
7. finance -> pmo: denied (через orchestrator)
8. strategy -> finance: denied (через orchestrator)
9. pmo -> strategy: denied (через orchestrator)

### 17.4 Мост БД -> контекст агента (обязательный runtime-протокол)
1. На старте каждого run оркестратор делает `GET /org/chart`.
2. Перед каждым handoff оркестратор вызывает `POST /handoff/validate`.
3. Только при `allowed=true` выполняется `POST /handoff/execute`.
4. Результат валидации записывается в run-context (чтобы агент видел "почему можно/нельзя").
5. Если `allowed=false`, run получает `blocked` с причиной `forbidden_handoff`.

### 17.5 Миграция из SOUL.md в org chart (чеклист)
1. Инвентаризация:
- выписать текущие связи "кто кого вызывает" из SOUL каждого агента.
2. Нормализация:
- перенести связи в `handoff_policies`;
- перенести иерархию в `org_edges`.
3. Разделение ответственности:
- в SOUL оставить "как работает роль";
- из SOUL убрать "кому можно вызывать" как источник истины.
4. Валидация миграции:
- прогнать 3 smoke-сценария (A/B/C) и сравнить маршруты "до/после";
- все ожидаемые handoff проходят, запрещенные блокируются.

### 17.6 V2 (не блокирует MVP)
1. `permissions` (тонкие права на ресурсы/действия).
2. `approvals` (governance и пороги по риску/бюджету).
3. `GET /org/capacity` и динамический routing по загрузке.
4. Временные task-force группы с TTL.

Gate-критерии MVP (обязательные):
1. 100% межагентных вызовов идут через `POST /handoff/validate`.
2. 0 обходов policy в smoke-сценариях.
3. Новый агент добавляется правкой орг-таблиц без массового редактирования SOUL у остальных.

## 18) Budgets — MVP контракт ресурсного контроля
Цель: сделать предсказуемый контроль ресурса задач в OpenClaw-контуре, даже при модели подписок без точного API-биллинга.

Непреодолимых ограничений нет:
1. Временной и операционный бюджет реализуется строго через БД + runtime-проверки.
2. Точный токен/деньги-бюджет ограничен без usage API, но это не блокирует MVP.

### 18.1 Что считаем бюджетом в MVP
1. `time_budget_min` — максимум минут на задачу.
2. `attempt_budget` — максимум запусков (retry/run) на задачу.
3. `deadline_at` — крайний срок выполнения задачи.
4. `budget_mode` — `strict` или `soft`.

Важно:
1. Денежный бюджет и точный токен-бюджет для подписок считаются `best effort` и не блокируют запуск.
2. Главный управленческий ресурс в MVP: время и число попыток.

### 18.2 Бюджет на уровне цели и задачи
1. У цели задается policy по умолчанию: `default_time_budget_min`, `default_attempt_budget`, `default_mode`.
2. У задачи допускается override policy (если явно утверждено orchestrator/human).
3. При создании задачи без явного бюджета применяется policy цели автоматически.
4. Источник назначения бюджета в MVP:
- human может задать бюджет вручную при создании задачи;
- если бюджет не задан вручную, orchestrator ставит бюджет по классу задачи `S/M/L`;
- если orchestrator не определил класс, применяется goal default policy.
5. Дефолты по классу задачи `S/M/L` (обязательные для MVP):
- `S`: `15 min`, `2 attempts`;
- `M`: `60 min`, `3 attempts`;
- `L`: `180 min`, `5 attempts`.

### 18.3 Runtime-протокол контроля
1. На первом budget-check система автоматически делает budget-claim (фиксирует старт и доступный остаток).
2. На heartbeat пересчитывает:
- `elapsed_min`
- `attempt_count`
- `deadline_breach` (true/false)
3. Правило измерения `elapsed_min` для режима подписок:
- используется `wall-clock` время;
- время в статусе ожидания человека не расходует бюджет (`waiting_human` не учитывается в `elapsed_min`);
- в бюджет входит только активное время выполнения (`running/processing`).
4. Пороговые события:
- `>= 80%` бюджета: warning + запись в `actions_log`.
- `>= 100%` в `strict`: блокировка ветки и эскалация.
- `>= 100%` в `soft`: допускается 1 дополнительная попытка с обязательным обоснованием.
5. После исчерпания soft-надбавки: обязательная эскалация в orchestrator/human.

### 18.4 Обязательные endpoint'ы MVP (budgets)
1. `POST /budgets/check` — единая точка budget-контроля:
- при первом вызове для run выполняет auto-claim;
- при следующих вызовах делает проверку лимитов.
2. `GET /budgets/report` — сводка по бюджетной дисциплине.

Важно:
1. Отдельные `claim/escalate` endpoint'ы не обязательны для MVP.
2. Эскалация фиксируется как действие в `actions_log` внутри `POST /budgets/check`.

### 18.5 Логи и метрики
1. `% задач в бюджете времени`.
2. `% задач с превышением attempt_budget`.
3. Среднее/медианное время закрытия по типам задач.
4. Топ причин эскалаций по бюджету.

### 18.6 Ограничения режима подписок (зафиксировано явно)
1. Без API usage нельзя гарантировать точный лимит токенов/стоимости по run.
2. В MVP вместо этого используется surrogate-контроль:
- `step_budget` (макс. число шагов),
- `attempt_budget`,
- `time_budget_min`.
3. При переходе на API-провайдеры раздел расширяется точным `token_budget` и `cost_budget`.

### 18.7 V2: связка budgets с goal ancestry и стратегической важностью
1. Бюджет задачи учитывает приоритет ancestry-цепочки (Mission/Stage/Goal).
2. Задачи стратегических целей (например Stage A) получают повышенный baseline бюджета относительно операционных.
3. Появляется коэффициент значимости цели (`goal_weight`) для автоматического перераспределения ресурса.
4. При конфликте бюджетов orchestrator выбирает задачу с большим вкладом в KPI цели.

Gate-критерии MVP (обязательные):
1. 100% run имеют активный budget-claim до начала работы.
2. Превышение бюджета не проходит "тихо" (есть warning/escalation в журнале).
3. На пилоте минимум 1 кейс в `strict` и 1 кейс в `soft` подтверждены smoke-тестом.
4. Для задач `S/M/L` бюджет автоматически назначается по дефолту класса, если не задан вручную.
5. `waiting_human` не расходует `time_budget_min`, что подтверждено smoke-кейсом.

## 19) Governance — MVP контракт формализованных approvals
Цель: исключить несанкционированные действия проактивных агентов через формальные approval-gates.

Непреодолимых ограничений нет:
1. Agent-to-agent approvals реализуются в OpenClaw через policy-слой в БД и runtime-валидацию.
2. PLAN->APPLY для host-изменений остается как отдельный слой, но governance покрывает бизнес-действия агентов.

### 19.1 Классы действий (action classes) v1
1. `safe_read` — чтение/анализ без внешних изменений.
2. `internal_write` — внутренние изменения в артефактах/тасках.
3. `external_comm` — внешняя коммуникация (email/пост/сообщение клиенту).
4. `financial_change` — действия, влияющие на цену/платеж/финпараметры.
5. `policy_change` — изменение политики, правил маршрутизации, governance-контура.

### 19.2 Политики approval v1
1. Для каждого `action_class` фиксируются:
- `approval_required` (0/1)
- `approver_role_id`
- `ttl_min`
- `fallback_role_id`
- `auto_escalation` (0/1)
2. Политики хранятся в БД и являются единственным источником истины для approvals.

### 19.3 Runtime-протокол approval
1. Перед чувствительным действием агент вызывает `POST /approvals/validate`.
2. Если approval не нужен -> действие может выполняться сразу.
3. Если approval нужен:
- создается `approval_request`;
- run получает статус `awaiting_approval`;
- инициируется handoff к approver-роли.
4. Approver выдает `approved` или `rejected` с причиной.
5. Только при `approved` разрешается выполнение через `POST /approvals/execute`.
6. При `rejected` задача возвращается инициатору с причиной и требуемым next-step.
7. Все шаги записываются в единый audit trail (`actions_log`) без двойной записи в отдельные runtime-логи.

### 19.4 Минимальная approval-матрица (текущий контекст 4 ролей)
1. `safe_read` -> approval не требуется.
2. `internal_write` -> approval не требуется (в рамках policy роли).
3. `external_comm` -> approver: `Strategy Gatekeeper`.
4. `financial_change` -> approver: `Finance KPI`, затем подтверждение `Orchestrator`.
5. `policy_change` -> approver: `Orchestrator` + human override обязателен.

### 19.5 Обязательные endpoint'ы MVP (approvals)
1. `POST /approvals/validate` — требуется ли approval для действия.
2. `POST /approvals/request` — создать approval-request.
3. `POST /approvals/decide` — решение approver (`approved/rejected`).
4. `POST /approvals/execute` — выполнить действие после approval.
5. `GET /approvals/report` — сводка по approvals, отказам, эскалациям.

### 19.6 Что можно сделать лучше, чем Paperclip (V2)
1. Risk-based approvals (политика по risk-tier, а не только по action class).
2. Two-man rule для high-risk действий (2 независимых approver).
3. Approval by exception для low-risk (автоодобрение типовых операций).
4. Timeboxed approvals с автоматической эскалацией при TTL breach.
5. Simulation mode: dry-run политики approvals до включения в прод.

Gate-критерии MVP (обязательные):
1. 100% `external_comm`/`financial_change`/`policy_change` проходят через approval-flow.
2. Невозможно выполнить чувствительное действие без `approved` статуса.
3. Все approval-решения трассируются в журнале с role/time/reason.
4. На пилоте есть минимум 1 кейс `approved` и 1 кейс `rejected` для проверки возврата в работу.

## 20) Unified Query Interface — MVP контракт единого доступа к данным
Цель: убрать неоднозначность чтения markdown и перевести всех агентов на единый структурированный интерфейс данных.

Непреодолимых ограничений нет:
1. Единый query interface реализуется поверх существующего OpenClaw как отдельный control API.
2. Файлы остаются артефактами, но не источником операционного статуса.

### 20.1 Принцип single source of truth
1. Источник истины для задач/целей/handoff/budgets/approvals — только БД через API.
2. Markdown-файлы используются как human-readable output, а не как runtime-state.
3. Любой агентный run читает и пишет состояние только через API-клиент `data-query`.

### 20.2 Единый JSON-контракт v1
1. Все ответы API имеют единый envelope:
- `ok` (true/false)
- `data` (object/array)
- `error` (code/message, если `ok=false`)
- `meta` (schema_version, timestamp, request_id)
2. Поля статусов и приоритетов — только из фиксированных enum.
3. Схема версионируется (`schema_version=v1`) и меняется только через migration policy.
4. Ошибки API имеют стабильные коды (`validation_error`, `not_found`, `forbidden`, `conflict`, `internal_error`).

### 20.3 Обязательный endpoint set MVP
1. `GET /tasks?status=&assignee=&goal_id=` — структурированный список задач.
2. `PATCH /tasks/:id` — обновление статуса/полей задачи по схеме.
3. `GET /goals/:id/ancestry` — цепочка цели до верхнего уровня.
4. `GET /goals/tree` — дерево целей для человека и Telegram.
5. `POST /handoff/validate` — проверка допустимости межагентного вызова.
6. `POST /budgets/check` — бюджетная проверка (auto-claim на первом вызове).
7. `POST /approvals/validate` — проверка необходимости approval.

### 20.4 Валидация схемы и качество данных
1. Входные payload проверяются schema-validator до записи в БД.
2. Выходные payload валидируются перед отдачей агентам.
3. Невалидные данные не публикуются в API и фиксируются в журнале ошибок.
4. Контрактные smoke-тесты проверяют "запрос -> ожидаемая JSON-структура".

### 20.5 Cutover-план с файлового режима на API
1. Шаг 1: dual-mode (API как основной, файлы read-only для справки).
2. Шаг 2: все агентные skills переключены на `data-query`.
3. Шаг 3: hard-cut — операции состояния через файлы запрещены.
4. Шаг 4: контрольный аудит на обходы (по логам запросов и файловых write-path).

### 20.6 Что можно сделать лучше, чем Paperclip (V2)
1. Semantic endpoints уровня бизнеса (`/stage/health`, `/kpi/risk`) вместо чистого CRUD.
2. Context bundles для ролей (минимально достаточный пакет данных на run).
3. Deterministic snapshots для длинных run (фиксированная версия данных).
4. Query budget guard: лимиты на тяжелые выборки в рамках одного run.
5. Compatibility tests: проверка обратной совместимости API перед релизом.

Gate-критерии MVP (обязательные):
1. 100% агентных операций состояния идут через `data-query` API.
2. 0 критичных маршрутов зависят от парсинга markdown для принятия решения.
3. Контрактные smoke-тесты API проходят на всех обязательных endpoint'ах.
4. После hard-cut любые попытки write в файловый state фиксируются как инцидент.

## 21) Observability & Analytics — MVP контракт
Цель: сделать бизнес-аналитику по агентной системе мгновенной, проверяемой и пригодной для управленческих решений.

Непреодолимых ограничений нет:
1. PostgreSQL/SQLite data layer позволяет строить realtime-аналитику без парсинга markdown.
2. OpenClaw остается runtime-слоем, а аналитика формируется из структурированных событий и состояний.

### 21.1 Event-модель (обязательная)
1. Канонический журнал событий и действий: append-only `actions_log`:
- `task_created`, `task_started`, `task_completed`, `task_failed`
- `handoff_requested`, `handoff_approved`, `handoff_rejected`
- `budget_warning`, `budget_exceeded`
- `approval_requested`, `approval_approved`, `approval_rejected`
2. Каждая запись содержит:
- `action_id`, `action_type`, `entity_type`, `entity_id`
- `actor_role`, `run_id`, `timestamp`
- `payload` (JSON, versioned)
3. Записи не редактируются задним числом (только append).
4. В MVP запрещена двойная runtime-запись одновременно в `actions_log` и `events_log`.
5. Аналитические витрины строятся как производный слой (views/snapshots) из `actions_log`.
6. Если в V2 нужен отдельный `events_log`, он заполняется только через projector/outbox (idempotent), а не из runtime-кода агентов.

### 21.2 KPI-слой (read models)
1. `kpi_tasks_closed_by_role(period)`
2. `kpi_time_to_close_by_task_type(period)`
3. `kpi_budget_compliance(period)`
4. `kpi_approval_conversion(period)`
5. `kpi_pipeline_bottlenecks(period)`

Назначение:
1. Быстрые ответы без тяжелых ad-hoc запросов.
2. Единые определения KPI для всех ролей.

### 21.3 Обязательные endpoint'ы MVP (analytics)
1. `GET /analytics/kpi?period=week|month`
2. `GET /analytics/pipeline?period=week|month`
3. `GET /analytics/agents?period=week|month`
4. `GET /analytics/budgets?period=week|month`
5. `GET /analytics/approvals?period=week|month`

### 21.4 Производительность и snapshot-подход
1. Ежедневный snapshot KPI-агрегатов (materialized read tables).
2. Стандартный отчет должен открываться <= 3 сек.
3. Расширенный срез должен открываться <= 10 сек.
4. Если SLA нарушен, фиксируется perf-инцидент с причиной.

### 21.5 Telegram-first управленческая аналитика
1. Команда: "KPI за месяц" возвращает:
- краткую сводку по ключевым KPI;
- 3 главные красные зоны;
- 1 рекомендованный следующий шаг.
2. Команда: "Где bottleneck?" возвращает этап/роль/метрику узкого места.
3. Команда: "Статус бюджетов" возвращает долю задач в/вне бюджета.

### 21.6 Data quality guardrails
1. Проверка пропущенных timestamp.
2. Проверка отрицательных/аномальных длительностей.
3. Проверка orphan actions (записи без сущности).
4. Проверка согласованности state vs actions.
5. При сбое качества данных KPI-панель помечается `degraded`.

### 21.7 Что можно сделать лучше, чем Paperclip (V2)
1. Role-based executive dashboards (owner/orchestrator/pmo).
2. Drill-down "почему упал KPI" до run/handoff/approval.
3. Forecast backlog и перегруза ролей на 2–4 недели.
4. Auto-recommendations по управленческим действиям.
5. Reliability score по агентам (скорость/качество/перерасход/возвраты).

Gate-критерии MVP (обязательные):
1. KPI "за неделю/месяц" строятся без парсинга markdown и git-log.
2. Все KPI рассчитываются из API/БД-контракта с едиными формулами.
3. Команда "KPI за месяц" в Telegram выдает ответ в целевом формате.
4. Минимум 3 smoke-кейса подтверждают корректность time-to-close и bottleneck-метрик.
5. В runtime-контуре используется single-write в `actions_log` (без двойной записи в отдельный `events_log`).

## 22) Idempotent Operations — MVP контракт
Цель: гарантировать effectively-once эффект операций при повторных вызовах, retry и параллельной работе агентов.

Непреодолимых ограничений нет:
1. Идемпотентность обеспечивается на уровне БД и API при запрете state-write в файлы.
2. Абсолютный exactly-once недостижим в общем случае, но effectively-once достижим и обязателен для MVP.

### 22.1 Базовый контракт идемпотентности
1. Любая mutating-операция обязана иметь `idempotency_key`.
2. `idempotency_key` формируется детерминированно (пример: `entity_id + action_type + run_id + attempt_no`).
3. В MVP `idempotency_key` хранится в `actions_log` с unique constraint (отдельный `operation_ledger` не обязателен).
4. Повтор запроса с тем же key не создает новый side-effect.
5. Если пришел тот же key с другим payload -> `idempotency_conflict` (hard error).
6. В MVP idempotency keys не удаляются (без TTL/purge); политика очистки переносится в V2.

### 22.2 Транзакционный протокол write-операций
1. `BEGIN`
2. Проверка `idempotency_key` в `actions_log`
3. Если ключ новый -> применить изменение состояния
4. Записать `actions_log` (включая `idempotency_key`)
5. `COMMIT`
6. При ошибке -> `ROLLBACK`

Принцип:
1. Нет write вне транзакции.
2. Нет write состояния в markdown-файлы.

### 22.3 Конкурентный доступ и защита от race conditions
1. Для обновлений сущностей используется optimistic locking (`version` или `updated_at` check).
2. При конфликте версии API возвращает `conflict_retryable`.
3. Для очереди используются атомарные `claim/lease/ack/requeue` с lock-safe semantics.
4. Повторный `ack` одного run не меняет результат после первого успешного `ack`.

### 22.4 Области обязательной идемпотентности MVP
1. `tasks` (status/update/close).
2. `handoff` (request/execute).
3. `approvals` (request/decide/execute).
4. `budgets` (check/escalation decisions).
5. `queue operations` (claim/lease/ack/requeue).

### 22.5 Что можно сделать лучше, чем Paperclip (V2)
1. Отдельный `operation_ledger` с payload hash и статусом replay.
2. Idempotency TTL/purge policy для старых ключей без потери аудита.
3. Retry storm simulator (массовые повторы под нагрузкой) в CI.
4. SLO на idempotent replay latency.

Gate-критерии MVP (обязательные):
1. Повтор одной и той же операции 10 раз дает один и тот же финальный state.
2. Тест "same key + different payload" корректно возвращает `idempotency_conflict`.
3. Параллельный update одной сущности не приводит к silent overwrite.
4. Любые state-write в markdown считаются нарушением и фиксируются как инцидент.

## 23) GAP-реестр после сравнения Paperclip/OpenClaw
Цель: зафиксировать, что уже закрыто в дорожной карте концептуально, и что осталось до рабочего production-контура.

### 23.1 Покрытие 8 ключевых преимуществ Paperclip
1. Data layer: покрыто в плане (этапы 1-2, разделы 10-11, 20).
2. Goal ancestry: покрыто в плане (разделы 15-16).
3. Org chart: покрыто в плане (раздел 17).
4. Budgets: покрыто в плане (раздел 18).
5. Governance approvals: покрыто в плане (раздел 19).
6. Единый query interface: покрыто в плане (раздел 20).
7. Наблюдаемость и аналитика: покрыто в плане (раздел 21).
8. Idempotent operations: покрыто в плане (раздел 22).

Итог:
1. На уровне архитектуры и контрактов coverage = 8/8.
2. Основные gaps теперь не в "что делать", а в "как внедрить и проверить в проде".

### 23.2 Оставшиеся gaps (P0/P1/P2)
P0 (обязательные до боевого запуска):
1. Финализировать технические спецификации как артефакты:
- SQL DDL v1 (таблицы, индексы, constraints).
- OpenAPI v1 (endpoint'ы, payload, коды ошибок).
2. Реализовать миграцию legacy-данных:
- инвентаризация;
- backfill в БД;
- закрытие "сирот".
3. Реализовать contract-test suite:
- API schema tests;
- idempotency tests;
- concurrency tests;
- approval/budget guard tests.
4. Подтвердить runbooks:
- backup/restore drill;
- incident drill P1/P2;
- rollback последней миграции.
5. Зафиксировать human management bridge (Telegram -> Control API):
- команды постановки задач, смены статуса, эскалации, approve/reject;
- маппинг команд на endpoint'ы API;
- обработка ошибок и подтверждение действий человеку.
6. Зафиксировать deployment architecture control-plane:
- отдельный `systemd` unit, порт, health-check, restart policy;
- лимиты ресурсов (`MemoryMax`, `CPUQuota`) и anti-conflict с текущим OpenClaw;
- runbook обновления и отката версии сервиса.

P1 (обязательные сразу после пилота):
1. Нагрузочные тесты (retry storm, parallel heartbeats, hot endpoints).
2. BI-экспорт и первые внешние дашборды (Metabase/Looker Studio или эквивалент).
3. Улучшение observability (причинные drill-down отчеты по KPI).
4. Формальная политика изменений (versioning API/policies без поломки run).
5. Адаптация Behavioral DNA / SOUL под API-контур:
- убрать файловые runtime-инструкции из SOUL;
- добавить boot-протокол контекста из API;
- валидировать, что все роли работают через `data-query`, а не через чтение markdown-state.

P2 (план развития, не блокирует MVP):
1. Отдельный `operation_ledger` + TTL/purge для idempotency keys.
2. Risk-based approvals и two-man rule.
3. Capacity-aware routing и task-force TTL.
4. Расширенная связка budgets с goal ancestry через `goal_weight`.
5. Retention / archival policy для `actions_log`:
- срок хранения hot-данных;
- архивные партиции/сжатие;
- регламент восстановления аналитики из архива.

### 23.3 Критерий закрытия GAP-реестра
1. Все P0 отмечены `done` и подтверждены артефактами проверки.
2. Боевой пилот проходит end-to-end без ручных технических обходов.
3. Решение о старте масштабирования принимается только после закрытия всех P0.

## 24) Два изолированных контура на одном VPS (Personal vs Natalia)
Цель: сохранить личного Jarvis без изменений и параллельно развернуть полностью отдельный бизнес-контур для Натальи.

Базовый принцип:
1. Personal Jarvis = референс и отдельный рабочий контур.
2. Natalia AI Department = новый независимый контур.
3. Между контурами нет общего runtime-state, общих секретов и общих рабочих папок.

### 24.1 Что именно изолируем (обязательно)
1. Отдельные Linux users и systemd units.
2. Отдельные директории (`/opt/jarvis-personal` и `/opt/natalia-ai`).
3. Отдельные `.env`, токены Telegram, API-ключи, логи, backup-пути.
4. Отдельная БД/схема в Railway для Natalia-контура.
5. Отдельный web endpoint (поддомен) и отдельный bot identity.

### 24.2 Роль Personal Jarvis в проекте Natalia
1. Personal Jarvis используется только как reference-паттерн (архитектура, skills, runbook-практики).
2. Прямой доступ Natalia-контура к данным Personal Jarvis запрещен.
3. Любое заимствование логики делается через перенос кода/конфига вручную с ревью, без shared runtime.

### 24.3 Минимальная топология Natalia-контура
1. `natalia-control-api` (systemd service) — управление задачами/goal/org/budget/approval.
2. `natalia-openclaw-runtime` (systemd service) — исполнение агентных run.
3. `railway-postgres-natalia` — единый state store.
4. `natalia-telegram-bridge` — команды человека в control API.
5. `natalia-web-ui` — панель управления (опционально на MVP, но поддерживается архитектурно).

### 24.4 Gate-критерии изоляции (обязательные)
1. Ни один процесс Natalia-контура не имеет прав чтения/записи в директории Personal Jarvis.
2. Секреты двух контуров полностью разделены.
3. Инцидент в Natalia-контуре не влияет на доступность Personal Jarvis.
4. Для каждого контура есть собственный health-check и restart policy.

### 24.5 Ресурсные границы и capacity-профили
Профиль A (текущий VPS, пилотный режим):
1. Использовать жесткие лимиты systemd и не запускать одновременно два тяжелых runtime на постоянной основе.
2. `jarvis-personal`: `MemoryMax=1400M`, `CPUQuota=35%`.
3. `natalia-openclaw-runtime`: `MemoryMax=1200M`, `CPUQuota=35%` (on-demand/по расписанию, не 24/7 full load).
4. `natalia-control-api`: `MemoryMax=256M`, `CPUQuota=10%`.
5. `natalia-telegram-bridge`: `MemoryMax=192M`, `CPUQuota=5%`.
6. Резерв ОС: не менее `700M RAM` и `15% CPU`.

Профиль B (рекомендуемый для стабильного production):
1. Минимум `8 GB RAM`, `4 vCPU`, `40 GB SSD`.
2. `jarvis-personal`: `MemoryMax=2560M`, `CPUQuota=40%`.
3. `natalia-openclaw-runtime`: `MemoryMax=2560M`, `CPUQuota=40%`.
4. `natalia-control-api`: `MemoryMax=512M`, `CPUQuota=15%`.
5. `natalia-telegram-bridge`: `MemoryMax=256M`, `CPUQuota=5%`.
6. Резерв ОС: ~`500M+ RAM` и `10% CPU`.

### 24.6 Единый monitoring-слой для двух контуров
1. Общий watchdog-скрипт (`cron` каждые 5 минут) проверяет:
- `systemd is-active` по ключевым сервисам двух контуров;
- health endpoint'ы control API;
- базовую доступность БД.
2. Критические алерты отправляются в отдельный Telegram-канал владельца (Максима), не в рабочие каналы агентов.
3. При 2 подряд неуспешных проверках сервис помечается как incident P1.

### 24.7 Backup/restore стратегия
1. Railway PostgreSQL:
- ежедневный логический backup (`pg_dump`) + хранение минимум 14 дней;
- еженедельный контрольный restore-drill на тестовой базе.
2. Файловая часть Natalia-контура:
- ежедневный архив `/opt/natalia-ai` (без секретов в открытом виде);
- отдельный backup-путь от Personal Jarvis.
3. Offsite-хранение:
- минимум 1 внешняя копия (не на том же VPS).
4. До боевого запуска обязателен 1 успешный полный restore-drill.

### 24.8 Процедура обновления OpenClaw (безопасный порядок)
1. Версии OpenClaw пинятся по контурам (без auto-upgrade в production).
2. Порядок обновления:
- сначала dev/canary-контур;
- затем Natalia production;
- Personal Jarvis обновляется отдельно и независимо.
3. Для каждого обновления обязательны:
- smoke-тесты маршрутов;
- проверка health и логов;
- готовый rollback на предыдущую версию.

### 24.9 Модельная изоляция Natalia-контура
1. По умолчанию Natalia-контур использует отдельные креды/подписки/API-ключи от Personal Jarvis.
2. Использование общих подписок между контурами допускается только как временный режим пилота с явным риском "утрата изоляции".
3. Решение по модели доступа фиксируется в `.env` Natalia-контура и в журнале решений до боевого запуска.

---

## §25. Журнал проблем и решений: запуск Stemford OpenClaw (2026-03-15)

Полная хронология проблем, с которыми мы столкнулись при запуске OpenClaw в контуре Stemford (Наталья), и примененные решения.

### 25.1 Проблема: VPS недостаточно RAM (критическая)

**Симптом:** OpenClaw Stemford установлен, systemd-юнит создан, но порт 18790 не слушает. В логах — `heap limit Allocation failed` (OOM kill).

**Диагностика:**
```bash
free -h   # total 3.8Gi, used 2.6Gi, free 783Mi
```
VPS имел 4 GB RAM. Два контура OpenClaw (~2.5 GB каждый) + RAG (~1.5 GB) + система = ~7 GB. Не помещается.

**Решение:** Апгрейд VPS на тариф Memory #1: **8 GB RAM / 60 GB SSD / $8.00/мес**.

Выбор обоснования:
- Standard 8 GB = $9.60/мес, Memory 8 GB = $8.00/мес (дешевле за тот же RAM).
- Диск 60 GB достаточно (БД на Railway, код занимает мегабайты).
- 12 GB избыточно на этапе MVP.

**Статус:** ✅ Решено. `free -h` → `total 7.8Gi, available 4.9Gi`.

---

### 25.2 Проблема: MemoryMax и heap слишком низкие

**Симптом:** После апгрейда VPS сервис запустился, но:
```
Memory: 1.1G (max: 1.1G available: 16.4M peak: 1.1G)
```
Процесс занял 1.1 GB из лимита 1.1 GB — осталось 16 МБ. Любая нагрузка → OOM.

**Корневая причина:** В systemd-юните `stemford-openclaw-runtime.service`:
```ini
MemoryMax=1200M                            # systemd режет на 1.2 GB
Environment=NODE_OPTIONS=--max-old-space-size=1024  # Node.js ограничивает heap 1 GB
```
Оба лимита слишком низкие для OpenClaw (~2 GB рабочий объём).

**Решение:**
```bash
sed -i 's/MemoryMax=1200M/MemoryMax=2560M/' /etc/systemd/system/stemford-openclaw-runtime.service
sed -i 's/--max-old-space-size=1024/--max-old-space-size=2048/' /etc/systemd/system/stemford-openclaw-runtime.service
systemctl daemon-reload && systemctl restart stemford-openclaw-runtime
```

**Результат:** `Memory: 431.6M (max: 2.5G available: 2.0G)` — здоровый запас.

**Статус:** ✅ Решено.

---

### 25.3 Проблема: конфликт Telegram-токенов (критическая)

**Симптом:** Бот `@stemfordaibot` не отвечает на сообщения. В логах OpenClaw:
```
[telegram] getUpdates conflict: Call to 'getUpdates' failed!
(409: Conflict: terminated by other getUpdates request;
make sure that only one bot instance is running); retrying in 30s.
```
Ошибка повторялась каждые 30 секунд.

**Корневая причина:** Telegram bridge (`telegram_bridge.js`) и OpenClaw Stemford использовали **один и тот же токен бота** (`8616204641:AAE...`). Telegram разрешает только одному процессу делать `getUpdates` для бота. Bridge побеждал в гонке, OpenClaw проигрывал.

**Диагностика:**
```bash
grep TELEGRAM_BOT_TOKEN /opt/stemford/run/.env
# 8616204641:AAE1fYfdpk-...  ← тот же, что в openclaw.json channels.telegram.botToken
```

**Решение:** Создан **второй Telegram-бот** `@stemford_control_bot` через @BotFather.
- Bridge (`telegram_bridge.js`) переведён на нового бота — управление (/task, /done, /org).
- OpenClaw оставлен хозяином `@stemfordaibot` — AI-разговоры.

```bash
nano /opt/stemford/run/.env   # заменить TELEGRAM_BOT_TOKEN на токен @stemford_control_bot
systemctl restart stemford-telegram-bridge
systemctl restart stemford-openclaw-runtime
```

**Архитектурное решение:**
| Бот | Процесс | Назначение |
|---|---|---|
| `@stemfordaibot` | OpenClaw (нативный) | AI/LLM, свободный текст, стриминг |
| `@stemford_control_bot` | telegram_bridge.js | /task, /done, /org, /goals, /approvals |

Альтернатива (один бот + CLI `openclaw agent --message`) была отвергнута как **деградация**: потеря стриминга, сессий, реакций, typing indicator. OpenClaw должен владеть ботом нативно — как личный Jarvis.

**Статус:** ✅ Решено. Конфликт 409 исчез.

---

### 25.4 Проблема: dmPolicy "pairing" блокирует сообщения

**Симптом:** После разрешения конфликта OpenClaw ответил **один раз** — pairing challenge:
```
OpenClaw: access not configured.
Your Telegram user id: 132360928
Pairing code: D8G8YZ8V
```
Команда `openclaw --profile stemford pairing approve telegram D8G8YZ8V` вернула:
```
Error: No pending pairing request found for code: D8G8YZ8V
```
После этого бот замолчал навсегда.

**Корневая причина:** В конфиге `dmPolicy: "pairing"` — требует интерактивного одобрения через gateway. CLI не нашёл pending-запрос (видимо хранился в оперативной памяти gateway и истёк).

**Решение:** Изменили политику на `"open"` (бот приватный, знают только свои):
```bash
sed -i 's/"dmPolicy": "pairing"/"dmPolicy": "open"/' /home/stemford/.openclaw-stemford/openclaw.json
```

**Статус:** ✅ Решено (после дополнительного исправления — см. §25.5).

---

### 25.5 Проблема: dmPolicy "open" требует allowFrom: ["*"]

**Симптом:** После смены dmPolicy OpenClaw упал с ошибкой валидации конфига:
```
Config invalid:
- channels.telegram.allowFrom: channels.telegram.dmPolicy="open"
  requires channels.telegram.allowFrom to include "*"
```
Сервис вошёл в цикл restart → crash → restart.

**Корневая причина:** OpenClaw валидирует конфиг при старте. `dmPolicy: "open"` обязывает явно указать `allowFrom: ["*"]`.

**Попытка 1 (неудачная):** `openclaw config set channels.telegram.allowFrom '["*"]'` — команда сказала "Updated", но фактически **не записала** в файл (grep по конфигу — пусто).

**Попытка 2 (неудачная):** `openclaw --profile stemford doctor --fix` — выполнилась от root, исправила `/root/.openclaw-stemford/openclaw.json` вместо `/home/stemford/.openclaw-stemford/openclaw.json`.

**Попытка 3 (успешная):** Ручная правка конфига:
```bash
sed -i 's/"dmPolicy": "open"/"dmPolicy": "open",\n      "allowFrom": ["*"]/' \
  /home/stemford/.openclaw-stemford/openclaw.json
systemctl restart stemford-openclaw-runtime
```

**Урок:** Команды OpenClaw CLI, запущенные от root, работают с конфигом root, а не целевого пользователя. Для stemford-контура нужно либо `su - stemford -c "openclaw ..."`, либо редактировать файлы вручную.

**Статус:** ✅ Решено.

---

### 25.6 Проблема: нет API-ключей в Stemford-профиле

**Симптом:** Бот проснулся и ответил:
```
⚠️ Agent failed before reply: All models failed (4):
openai-codex/gpt-5.2-codex: No API key found for provider "openai-codex".
Auth store: /home/stemford/.openclaw-stemford/agents/main/agent/auth-profiles.json
```

**Корневая причина:** Stemford — изолированный контур. Auth-profiles.json (API-ключи провайдеров) существовал только у Jarvis (`/home/clawd/.openclaw/agents/main/agent/auth-profiles.json`), но не у Stemford.

**Решение:** Скопировали auth-profiles из Jarvis:
```bash
mkdir -p /home/stemford/.openclaw-stemford/agents/main/agent
cp /home/clawd/.openclaw/agents/main/agent/auth-profiles.json \
   /home/stemford/.openclaw-stemford/agents/main/agent/auth-profiles.json
chown stemford:stemford /home/stemford/.openclaw-stemford/agents/main/agent/auth-profiles.json
chmod 600 /home/stemford/.openclaw-stemford/agents/main/agent/auth-profiles.json
```

**Примечание по §24.9:** Использование общих подписок — временный пилотный режим. Для production у Natalia-контура должны быть свои креды.

**Статус:** ✅ Решено.

---

### 25.7 Проблема: EACCES на models.json

**Симптом:** После копирования auth-profiles:
```
⚠️ Agent failed before reply: EACCES: permission denied,
open '/home/stemford/.openclaw-stemford/agents/main/agent/models.json.6042.tmp'
```

**Корневая причина:** Команда `mkdir -p` выполнялась от root → каталоги принадлежали root:root. OpenClaw работает как пользователь `stemford` и не мог писать.

**Решение:**
```bash
chown -R stemford:stemford /home/stemford/.openclaw-stemford/agents
```

**Урок:** При любых операциях с файлами контура Stemford — проверять ownership. Процесс OpenClaw работает от `User=stemford` (systemd).

**Статус:** ✅ Решено.

---

### 25.8 Итоговое состояние после всех исправлений

**OpenClaw Stemford:**
- Сервис: `stemford-openclaw-runtime.service` — active (running)
- Gateway: `ws://127.0.0.1:18790`
- Telegram: `@stemfordaibot` — отвечает, стримит, персонализируется
- Модели: gpt-5.2-codex (primary) + 3 fallbacks
- dmPolicy: open, allowFrom: ["*"]
- MemoryMax: 2560M, heap: 2048M

**Stemford Bridge:**
- Сервис: `stemford-telegram-bridge.service` — active (running)
- Telegram: `@stemford_control_bot`
- Команды: /task, /done, /org, /goals, /approvals и др.
- API: http://127.0.0.1:3210

**Ресурсы VPS (8 GB Memory):**
```
total: 7.8Gi   used: 3.1Gi   available: 4.6Gi
```

### 25.9 Хронология решений

| # | Время (UTC) | Проблема | Решение | Затрачено |
|---|---|---|---|---|
| 1 | 20:45 | VPS 4 GB — OOM | Апгрейд на 8 GB Memory ($8/мес) | 10 мин |
| 2 | 20:54 | MemoryMax=1200M | Поднято до 2560M + heap 2048M | 2 мин |
| 3 | 21:18 | Telegram 409 Conflict | Создан второй бот, разделены токены | 10 мин |
| 4 | 21:33 | dmPolicy pairing → CLI не работает | Изменён на "open" | 5 мин |
| 5 | 21:44 | allowFrom не указан → crash | Добавлен allowFrom: ["*"] | 8 мин |
| 6 | 21:55 | Нет API-ключей | Скопирован auth-profiles.json от Jarvis | 3 мин |
| 7 | 21:57 | EACCES permissions | chown -R stemford:stemford | 1 мин |
| 8 | 22:00 | — | **OpenClaw отвечает в Telegram** ✅ | — |

### 25.10 Извлечённые уроки

1. **CLI от root ≠ CLI от stemford.** Все команды `openclaw --profile stemford` нужно выполнять либо от пользователя stemford (`su - stemford -c "..."`), либо править файлы вручную с последующим `chown`.

2. **Один токен = один процесс.** Telegram API строго запрещает двум процессам одновременно делать `getUpdates` на одном токене. При наличии нескольких сервисов каждый должен иметь своего бота.

3. **OpenClaw строго валидирует конфиг.** Неполное изменение (dmPolicy без allowFrom) приводит к crash-loop. Всегда проверять `journalctl` после правки конфига.

4. **Изоляция контуров = изоляция всего.** Отдельный Linux-пользователь, отдельные ключи, отдельный бот, отдельные права на файлы. Каждый шаг требует проверки ownership.

5. **Memory-тариф выгоднее Standard** при RAM-heavy нагрузках (OpenClaw). $8/мес за 8 GB вместо $9.60 — экономия 17% при том же объёме RAM.

6. **Не гадать протокол — искать CLI.** Попытка reverse-engineering WebSocket gateway заняла время. Правильный путь: `openclaw agent --help`, `openclaw channels --help`. CLI — первоисточник API.

7. **Нативная интеграция > прокси.** Вариант "bridge ловит текст → spawn CLI → ответ" — деградация по сравнению с нативным OpenClaw Telegram. Потеря стриминга, сессий, реакций. OpenClaw должен владеть каналом напрямую.

---

## §26. Адаптация паттернов OpenAI Symphony для Stemford (2026-03-16)

### 26.1 Зачем добавляем этот блок

Symphony подтверждает правильность выбранной архитектуры: оркестрация должна быть отдельным слоем, а не набором ad-hoc скриптов. Для Stemford это не замена Control API, а источник проверенных паттернов исполнения.

Цель секции: зафиксировать, какие идеи Symphony берем в ближайший спринт, а какие откладываем до пост-MVP.

### 26.2 Что берем в ближайший спринт (P1)

1. **Retry queue с экспоненциальным backoff для задач**
- Добавить явный переход повторного выполнения (`/tasks/:id/retry`).
- Ввести учет попыток (`retry_attempt`) и времени следующего запуска (`retry_after`).
- Базовый backoff: `delay = min(10s * 2^(attempt-1), 300s)`.

2. **Stall detection (защита от "вечного in_progress")**
- Фоновая проверка зависших задач в `in_progress`.
- Если нет активности дольше порога (например, 30 мин), перевод в `blocked`.
- Причина фиксируется как `stall_detected`, действие пишется в `actions_log`, отправляется уведомление в Telegram.

3. **Reconciliation loop**
- Периодическая сверка "системной правды":
  - статус в БД;
  - наличие/состояние runtime-процесса;
  - актуальность task-run связи.
- При расхождении: автоисправление статуса или постановка задачи в retry/blocked с объяснением причины.

### 26.3 Что откладываем до пост-MVP (P2/P3)

1. **Per-task workspace isolation**
- Полезно при высокой параллельности, но не критично при текущей нагрузке.

2. **Полный token accounting по сессиям**
- Оставляем на фазу оптимизации затрат и performance-аналитики.

3. **Полная policy-as-code автоматизация через единый executable workflow**
- Пока достаточно фиксировать политику в плане и внедрять поэтапно через Control API.

### 26.4 Практический мини-план внедрения

1. **Шаг A (Retry)**
- Миграция БД: добавить `retry_attempt`, `retry_after`.
- API: `POST /tasks/:id/retry`.
- Audit: `task_retry_queued` в `actions_log`.

2. **Шаг B (Stall watchdog)**
- Добавить фоновый цикл проверки зависших задач (интервал 5 мин).
- Правило: `in_progress` без активности > порога -> `blocked`.
- Уведомление в Telegram + запись причины.

3. **Шаг C (Reconciliation loop)**
- Сверка runtime/DB состояния.
- Автокоррекция переходов, исключающая "подвисшие" статусы без исполнителя.

### 26.5 Критерии готовности секции §26

1. Нет задач, которые остаются в `in_progress` бесконечно без активности.
2. Любой runtime-crash оставляет понятный след: `retry` или `blocked` с причиной.
3. Повторный запуск не создает хаотичных дублей, а идет через контролируемый backoff.
4. Все автоматические решения фиксируются в `actions_log`.

### 26.6 Позиция в дорожной карте отдела AI-ассистентов

Секция §26 — это мост между текущим "бот ожил" и целевым состоянием "команда агентов как в paperclip":

- уже сделан инфраструктурный фундамент (OpenClaw + Control API + audit trail);
- следующий этап — операционная зрелость оркестрации (retry, stall, reconciliation);
- после этого можно безопасно увеличивать автономность агентов на естественном языке.

### 26.7 Fast-path для частотных Telegram-запросов (P2, не срочно)

#### Контекст
1. Даже простые запросы ("покажи открытые задачи", "покажи pending approvals") сейчас проходят полный LLM-цикл.
2. Это повышает задержку ответа и делает UX менее "мгновенным" по сравнению со скриптовыми ботами.

#### Решение (отложенный backlog)
1. Добавить rule-based fast-path для фиксированного набора интентов:
- `покажи открытые задачи` -> прямой вызов `GET /tasks` с фильтрацией открытых статусов.
- `покажи pending approvals` -> прямой вызов `GET /approvals/pending`.
2. Для fast-path использовать шаблонные ответы (без LLM-рассуждения), с коротким markdown-форматом.
3. При любом нештатном сценарии (ошибка API, неоднозначный интент) делать fallback в стандартный NL-пайплайн.

#### Definition of Done
1. p50 времени ответа по fast-path запросам <= 10 секунд (внутри runtime, без учета внешних лагов Telegram).
2. p95 по fast-path <= 20 секунд.
3. Для fast-path запросов сохраняется текущий audit/logging-контур.
4. Fallback в обычный NL-пайплайн работает автоматически и прозрачно.

---

## §27. Режим MVP-тестирования и приоритеты безопасности

### 27.1 Контекст

Реальные участники и их роли (из CONTEXT_Main.md):

- **Дмитрий** — собственник сети из трёх офлайн-школ программирования для детей в Болгарии (Варна ≈170, Бургас ≈150, Пловдив ≈76 учеников). Принимает финансовые и стратегически рискованные решения.
- **Наталья** — новый управляющий школами. Переходит из маркетинга (контент, соцсети, видео, дизайн) в управление. Конечный пользователь AI-системы Stemford. Утверждает операционные решения без бюджетного риска.
- **Екатерина Хромова** — текущий управляющий, передаёт дела Наталье.
- **Максим** — муж Натальи. Не сотрудник компании, помогает неформально. Построил Telegram-бот, базу знаний в Obsidian, лендинги. Строит всю ИТ-инфраструктуру Stemford. Единственный человек с доступом к системе на этапе MVP.

До подключения Натальи система работает в **закрытом тестовом режиме** — Максим тестирует всё сам.

### 27.2 Решение по приоритетам безопасности

На этапе MVP-тестирования **вопросы безопасности сознательно деприоритизированы**:

| Задача | Было | Стало |
|---|---|---|
| SSL для PostgreSQL (rejectUnauthorized) | P0 | **P2** — отложено до подключения реальных пользователей |
| Отдельные API-ключи для Stemford (§24.9) | P0 | **P2** — пилотный режим с общими подписками допустим |
| RBAC / разграничение прав | не планировалось в MVP | подтверждено — **не нужно** на этом этапе |
| dmPolicy: "open" + allowFrom: ["*"] | потенциальный риск | **допустимо** — бот приватный, знает только Максим |

### 27.3 Условия выхода из тестового режима

Безопасность возвращается в P0, когда выполнено **любое** из условий:
1. Наталья начинает использовать систему.
2. Появляется хотя бы один пользователь кроме Максима.
3. Система обрабатывает реальные данные клиентов/учеников.
4. Бот становится доступен в групповых чатах с третьими лицами.

## §28. Бенчмарк AGiXT и заимствования (2026-03-17)

### 28.1 Контекст

Совместный анализ (Claude + Codex) проекта [AGiXT](https://github.com/Josh-XT/AGiXT) — крупной платформы оркестрации AI-агентов (FastAPI, PostgreSQL, Redis, 40+ расширений, мульти-LLM).

Цель: понять, что забрать точечно, сохранив наше преимущество в safety/reliability.

### 28.2 Что у AGiXT лучше

| Паттерн | Суть | Статус у нас |
|---------|------|-------------|
| Complexity scoring | Маршрутизация запросов на разные модели по сложности | Нет (есть §26.7 fast-path — зародыш) |
| Extension lifecycle | Manifest, версия, зависимости, enable/disable per-agent | Нет (SOUL.md описывает allowed-tools, но нет enforce) |
| Webhook events | Уведомления при ключевых событиях | Нет |
| Runtime DX | Health/readiness endpoints, стандартные диагностические команды | Частично (/health, /db/ping есть) |
| Enterprise features | Multi-tenancy, RBAC, OAuth/SSO | Не нужно на MVP |

### 28.3 Что у нас лучше

| Паттерн | Наша реализация | У AGiXT |
|---------|----------------|---------|
| Approval gates | approval_requests с классами действий, default approvers | Отсутствует — команды выполняются без одобрения |
| Retry flow | retry_after + max_attempts + watchdog для зависших задач | Нет retry, нет rollback — цепочка падает целиком |
| Audit ritual | Формализованный ритуал ревью actions_log (weekly/monthly/exception) | Текстовые логи, нет структурированного аудита |
| Role boundaries | 6-field Role Definition с явными Boundaries в SOUL.md | Unstructured key-value конфиги без валидации |
| Handoff policies | Проверка «кто кому может передавать» в БД | Нет — delegation без ограничений |
| Статус-машина задач | Явные переходы с guard-условиями | Chains — последовательные, без conditional branching |

### 28.4 План заимствований

**Забираем (4 пункта, в порядке приоритета):**

#### 28.4.1 Трёхуровневый роутер запросов (из complexity scoring)

Не ML-магия, а детерминированный роутер правил:

| Уровень | Когда | Что делает | Латентность |
|---------|-------|-----------|-------------|
| **Fast-path** | Чистые read-запросы: список задач, статусы, оргструктура | Прямой curl к Control API, форматирование без LLM | < 1 сек |
| **Light LLM** | Простая агрегация, форматирование ответа, перевод | Дешёвая/быстрая модель | 3-5 сек |
| **Full LLM** | Анализ KPI, стратегические решения, мульти-агентный синтез | Полная модель | 15-60 сек |

Реализация: в stemford-data SKILL.md добавить паттерн-матчер в описание + в TOOLS.md прописать routing hints.
Связь: расширение §26.7 (fast-path) до трёх уровней.
Этап: 3-4 (надёжность + команда агентов).

#### 28.4.2 Webhook → Telegram при критических событиях

Минимальный набор (по рекомендации Codex — начинаем с 3 событий):
- `task_failed` → уведомление
- `retry_limit_exceeded` → уведомление
- `approval_requested` → уведомление с кнопкой действия

Канал: Telegram (тот же бот или отдельный канал уведомлений).
Этап: 5 (наблюдаемость).

#### 28.4.3 Per-agent tool access enforcement

Текущее состояние: allowed-tools описаны в SOUL.md, но это документация, а не runtime enforce.
Целевое: при вызове команды проверять, разрешена ли она этому агенту. Формат: whitelist в конфиге или БД.
Этап: 4 (команда агентов).

#### 28.4.4 Стандартный набор runtime checks

Расширить /health и /db/ping до:
- `/readiness` — проверка всех зависимостей (DB + доступность скиллов)
- `/diagnostics` — текущее состояние: задачи in_progress, pending approvals, stalled count
Этап: 5 (наблюдаемость).

### 28.5 Что НЕ забираем

| Паттерн AGiXT | Почему нет |
|---------------|-----------|
| All-in-one core с 40+ extensions | Наш scope — школа, не универсальная платформа |
| docker.sock mount | Security-дыра: агент получает root-доступ к хосту |
| Insecure defaults (дефолтные креды) | Противоречит нашим принципам даже на MVP |
| Unstructured key-value конфиги | У нас — формализованные SOUL.md с валидируемой структурой |
| Векторная память через ONNX | Для нашего масштаба достаточно SQL + actions_log |

### 28.6 Главный вывод

AGiXT — широко, но поверхностно в safety/reliability.
Наша архитектура — уже, но глубже.
Стратегия: забрать их «ширину» точечно (4 паттерна), не жертвуя нашей «глубиной».

### 28.7 Метрики успеха

| Метрика | Как измеряем | Целевое значение |
|---------|-------------|-----------------|
| p50 latency (Telegram → ответ) | Timestamp в actions_log: запрос → ответ | Fast-path < 5s (факт: 4s), Light < 10s, Full < 60s |
| p95 latency | То же, 95-й перцентиль | Fast-path < 7s (факт: 6s), Light < 15s, Full < 90s |
| Error rate | `task_failed` + `retry_limit_exceeded` / total actions за неделю | < 5% |
| Доля fast-path | Запросы, обработанные без LLM / все запросы | > 40% после внедрения роутера |
| Время до ответа на approval | `approval_requested` → `approval_decided` в actions_log | < 30 мин (рабочее время) |

Замер: еженедельно в рамках audit ritual (§28.4.2 + docs/review/AUDIT_LOG_REVIEW_RITUAL.md).

### 28.8 Experiment cards

Каждое заимствование — отдельный эксперимент с фиксированной структурой.

#### EC-1: Трёхуровневый роутер запросов
- **Гипотеза**: детерминированный fast-path снизит p50 latency для read-запросов с ~120s до <1s.
- **Как меряем**: 10 тестовых запросов «покажи задачи» до и после. Timestamp в Telegram.
- **Срок**: 3 дня после старта.
- **Owner**: Codex (executor), Claude (reviewer).
- **Rollback**: убрать fast-path из SKILL.md, вернуть единый LLM-путь.
- **Результат (2026-03-17)**: skill-level fast-path реализован (H-08, H-09). Замер (H-10): p50=4s, p95=6s. Улучшение с ~120s до ~4s (30x). Строгий DoD (p95 < 2s) не достигнут — для этого нужен runtime bypass (LLM полностью исключается из цепочки). **Решение**: отложить runtime bypass до появления реальных запросов от Натальи. Текущая скорость (4-6 сек) достаточна для рабочего использования. OI-8 остаётся в backlog.

#### EC-2: Webhook → Telegram
- **Гипотеза**: уведомления при task_failed/retry_limit/approval_requested сократят время реакции на инциденты с «узнал случайно» до < 5 мин.
- **Как меряем**: 3 искусственных события → проверить доставку в Telegram + задержку.
- **Срок**: 2 дня после старта.
- **Owner**: Codex (executor), Claude (reviewer).
- **Rollback**: отключить webhook-эндпоинт, события продолжают писаться в actions_log.

#### EC-3: Per-agent tool access
- **Гипотеза**: runtime enforce предотвращает выход агента за пределы своей роли (например, PMO не может вызвать strategy-only команду).
- **Как меряем**: тест — вызов запрещённой команды от имени каждого агента → ожидаем 403.
- **Срок**: 2 дня после старта.
- **Owner**: Codex (executor), Claude (reviewer).
- **Rollback**: вернуть permissive mode (все команды доступны всем), сохранить whitelist как документацию.

#### EC-4: Runtime checks
- **Гипотеза**: /readiness и /diagnostics позволят обнаружить проблемы до того, как их увидит пользователь.
- **Как меряем**: искусственно убить DB-соединение → /readiness должен вернуть unhealthy за < 5s.
- **Срок**: 1 день.
- **Owner**: Codex (executor), Claude (reviewer).
- **Rollback**: не нужен — read-only endpoints, не влияют на рабочий flow.

### 28.9 Definition of Done

| Пункт 28.4 | Done = | Smoke test |
|-------------|--------|-----------|
| 28.4.1 Роутер | SKILL.md содержит паттерн-матчер, fast-path запросы не вызывают LLM, ответ < 2s | `curl` → «покажи задачи» в Telegram → ответ < 2s с корректными данными |
| 28.4.2 Webhooks | 3 события доставляются в Telegram-канал уведомлений | Создать task → fail → проверить Telegram-уведомление |
| 28.4.3 Tool access | Запрос от агента с запрещённой командой → 403 + запись в actions_log | `curl POST /tasks -d '{"actor_role":"pmo","...external_comm..."}' → 403` |
| 28.4.4 Runtime checks | /readiness отдаёт статус всех зависимостей, /diagnostics — текущие счётчики | `curl /readiness` при убитом DB → `{"ok":false,"db":"down"}` |

### 28.10 Guardrails (жёсткие ограничения)

Применяются ко всем заимствованиям и ко всей системе:

1. **Нет docker.sock** — ни один агент не получает доступ к Docker daemon. Нарушение = P1 блокер.
2. **Нет open-DM без изоляции** — dmPolicy: "open" допустим только в тестовом режиме (§27.3). При выходе на прод — whitelist.
3. **Нет невалидируемых KV-конфигов** — все настройки агентов формализованы в SOUL.md с 6-field Role Definition. Произвольные key-value запрещены.
4. **Нет fire-and-forget без лога** — каждое значимое действие пишется в actions_log до возврата ответа. Webhook — дополнение, не замена.
5. **Нет insecure defaults** — дефолтные креды, токены 123456 и подобное запрещены даже на dev-стенде.

### 28.11 Приоритизация и порядок внедрения

```
1. Fast-path роутер (§28.4.1)     ← максимальный UX-эффект, решает проблему латентности
   ↓
2. Per-agent tool access (§28.4.3) ← safety-enforce, нужен до подключения Натальи
   ↓
3. Webhooks (§28.4.2)              ← наблюдаемость, дёшево реализуется после роутера
   ↓
4. Runtime checks (§28.4.4)        ← финализация, полирует операционную зрелость
```

Обоснование порядка:
- **Fast-path первый** — единственное, что заметит пользователь (Наталья). Всё остальное — инфраструктура.
- **Tool access второй** — safety gate обязателен до выхода из тестового режима (§27.3).
- **Webhooks третий** — полезны, но actions_log уже покрывает аудит. Telegram-нотификации — ускорение, не необходимость.
- **Runtime checks последний** — /health и /db/ping уже есть, расширение — nice-to-have.

---

## §29. Бенчмарк CAMEL-AI и план внедрения (2026-03-17)

### 29.1 Контекст

Совместный анализ (Claude + Codex) проекта [CAMEL-AI](https://github.com/camel-ai/camel) — исследовательского фреймворка мульти-агентных систем (role-playing societies, workforce, memory, runtime guardrails).

Цель: забрать архитектурную зрелость CAMEL точечно, сохранив наше преимущество в safety/reliability.

### 29.2 Что у CAMEL лучше

| Паттерн | Суть | Статус у нас |
|---------|------|-------------|
| TaskSpecifyAgent | Автоуточнение размытых задач перед выполнением | Нет — бот задаёт открытые вопросы |
| Critic-in-the-loop | Второй проход оценки перед выполнением рискованного действия | Нет — действия выполняются без внутренней проверки |
| Memory persistence | Контекст между сессиями агента | Нет — каждый разговор с чистого листа |
| Runtime profiles | Разные режимы исполнения (docker/local/cloud) | Нет — единый режим для всех запросов |
| Workforce graph | Декомпозиция сложной задачи на подзадачи с графом зависимостей | Нет — только линейная статус-машина |
| Cookbook/benchmarks | Регрессионные сценарии для валидации | Нет — ручной smoke |

### 29.3 Что у нас лучше

| Паттерн | Наша реализация | У CAMEL |
|---------|----------------|---------|
| Approval gates | approval_requests с классами действий | Human-in-the-loop через внешний HumanLayer — opt-in, не by-default |
| Safety enforcement | Жёсткие правила, невозможно обойти | Вероятностный LLM-фильтр — можно подключить, но можно и пропустить |
| Audit trail | actions_log + review ritual + HANDOFF_LOG | Нет структурированного аудита |
| Role boundaries | 6-field Role Definition + per-agent tool access | Нет per-agent ограничений |
| Production readiness | systemd, миграции, health checks, deploy checklist | Исследовательская библиотека, не production |
| Memory ревизионность | — (пока нет памяти, но внедрим сразу с TTL + audit) | Память есть, но без TTL и без audit-следа → дрейф |

### 29.4 План заимствований

#### 29.4.1 TaskSpecify-lite — автоуточнение запросов в Telegram

**Что это:** Прослойка перед выполнением команды, которая сама додумывает недостающие детали.

**Порядок обработки (детерминизм → уточнение → подтверждение):**
1. **Детерминированные правила** (всегда первый шаг): если не указан assignee → определи по ключевым словам (презентация → PMO, бюджет → Finance, расписание → Orchestrator). Если не указан goal_id → текущий активный спринт. Если не указан приоритет → normal.
2. **Один уточняющий вопрос** (только если правила не покрыли): конкретный закрытый вопрос («Это задача для PMO или для Strategy?»), не открытый.
3. **Подтверждение** (всегда последний шаг): показать пользователю итог и спросить «Ок?» перед выполнением.

**Реализация:** логика в скилле stemford-data (SKILL.md + references/). Не требует изменений в Control API.

#### 29.4.2 Critic pattern — второй проход для рискованных действий

**Что это:** Перед выполнением опасного действия — внутренняя проверка безопасности.

**Двухслойная архитектура (hard-policy обязателен, LLM-критик опционален):**

| Слой | Что проверяет | Обязательность |
|------|--------------|---------------|
| **Hard-policy** (слой 1) | Входит ли действие в allowed-tools агента? Не превышен ли лимит? Есть ли approval для класса A? | **Обязателен всегда** — детерминированная проверка |
| **LLM-критик** (слой 2) | Семантическая проверка: «нет ли ошибки в логике?», «не противоречит ли контексту?» | Опционален — только для Guarded/Isolated профилей |

**Рискованные действия:** approve, delete, bulk update, любое действие с action_class = A, изменение оргструктуры.

**Если проверка не прошла:** агент не выполняет, а сообщает человеку что именно не так и почему.

#### 29.4.3 Память-карточка с TTL и audit-следом

**Что это:** Бот запоминает контекст между сессиями, но с «сроком годности» и защитой от дрейфа.

**Схема таблицы `memory_cards`:**

| Поле | Тип | Описание |
|------|-----|---------|
| id | SERIAL PK | — |
| agent_role | TEXT NOT NULL | Какой агент запомнил |
| user_id | TEXT NOT NULL | Для какого пользователя |
| topic | TEXT NOT NULL | Тема карточки |
| content | TEXT NOT NULL | Содержимое |
| is_sensitive | BOOLEAN DEFAULT false | Флаг чувствительных данных |
| created_at | TIMESTAMPTZ DEFAULT now() | Когда создана |
| expires_at | TIMESTAMPTZ NOT NULL | Когда истекает (TTL) |
| source_action_id | INTEGER REFERENCES actions_log(id) | Откуда бот «это запомнил» |

**TTL по умолчанию:** 7 дней. Переопределяется явно при создании карточки.

**Правила хранения:**
- Чувствительные данные (пароли, токены, персональные данные) **запрещены** без явного `is_sensitive = true`
- Карточки с `is_sensitive = true` получают TTL максимум 24 часа
- Фоновый таймер: раз в сутки — удаление истёкших, суммаризация старых (>3 дней) в короткую версию

**Аудит:** каждая карточка привязана к source_action_id → можно проследить, откуда бот запомнил факт.

#### 29.4.4 Три runtime-профиля

**Что это:** Разные режимы обработки запросов в зависимости от сложности.

| Профиль | Когда | Что делает | Латентность |
|---------|-------|-----------|-------------|
| **Fast** | Чистые read-запросы: «покажи задачи», «статус», «кто в команде» | Прямой curl к API, форматирование без LLM | < 1 сек |
| **Guarded** | Мутации: «создай задачу», «назначь», «одобри» | TaskSpecify + hard-policy Critic + выполнение | 3-10 сек |
| **Isolated** | Аналитика: «проанализируй KPI», «предложи план» | Полный LLM-проход, timeout 90 сек, budget limit | 15-60 сек |

**Классификатор:** детерминированный (по ключевым словам и типу эндпоинта), не LLM-магия.

**Связь с §28.4.1:** объединение complexity scoring (AGiXT) + runtime abstraction (CAMEL).

#### 29.4.5 Cookbook / smoke scenarios

**Что это:** Набор типовых сценариев, которые прогоняются после каждого деплоя.

| # | Сценарий | Профиль | Ожидаемый результат |
|---|----------|---------|-------------------|
| 1 | «Покажи задачи» | Fast | Список задач, < 2 сек |
| 2 | «Создай задачу: тест» | Guarded | Задача создана, confirmation показан |
| 3 | «Одобри заявку класса A» | Guarded | Запрос к человеку (не автоодобрение) |
| 4 | Задача зависла 3 часа | — | Watchdog → retry → запись в actions_log |
| 5 | Retry 5 раз подряд | — | retry_limit_exceeded → Telegram-уведомление |
| 6 | PMO вызывает finance-команду | Guarded | 403 + запись в actions_log |
| 7 | «Что обсуждали вчера?» | Fast | Ответ из memory_cards без уточнений |

**Реализация:** `tests/smoke_scenarios.sh` — запускается после каждого деплоя, результат в DEPLOY_LOG.

#### 29.4.6 JSON-лог + human-readable feed

**Что это:** Эндпоинт, который показывает последние действия агентов в читаемом виде.

**Новый эндпоинт:** `GET /actions/feed?limit=20&format=human`

**Формат записи в actions_log (стандартизированный):**
```json
{"actor": "pmo", "action": "create_task", "target": "task#47", "detail": "Презентация для родителей", "ts": "2026-03-17T14:32:00Z"}
```

**В Telegram:** команда «покажи лог» → бот вызывает эндпоинт и показывает ленту:
```
[14:32] PMO → создал задачу #47 "Презентация для родителей"
[14:33] Orchestrator → назначил #47 на PMO
[16:01] Watchdog → retry задачи #47 (зависла 2ч)
```

### 29.5 Что НЕ берём из CAMEL

| Идея CAMEL | Почему нет |
|-----------|-----------|
| 1M+ агентов | Нам нужно 5-7, но надёжных |
| Role-playing sessions | Наш Executor/Reviewer loop формализованнее и с audit-следом |
| Динамическая загрузка инструментов | Противоречит per-agent tool access — агент не должен сам себе добавлять инструменты |
| Safety через внешний LLM-фильтр | Вероятностная защита ≠ жёсткие правила. Наши approval gates надёжнее |
| Workforce для всех запросов | Только для сложных multi-step (будущее). Простые → Fast-path |

### 29.6 Порядок внедрения с DoD-метриками

| Шаг | Что | DoD-метрика | Срок |
|-----|-----|-----------|------|
| 1 | Fast-path профиль (§29.4.4 Fast) | p95 latency для read-запросов < 2 сек; доля fast-path > 40% от всех запросов | 2-3 дня |
| 2 | TaskSpecify-lite (§29.4.1) | 0 открытых вопросов бота при стандартных командах; confirmation step = 1 сообщение | 2-3 дня |
| 3 | Smoke scenarios (§29.4.5) | Все 7 сценариев проходят; 0 P1 по результатам smoke | 1-2 дня |
| 4 | JSON-лог viewer (§29.4.6) | «Покажи лог» → ответ < 3 сек, формат читаемый | 1 день |
| 5 | Память-карточка (§29.4.3) | Бот отвечает на «что обсуждали вчера?» из карточки; TTL = 7 дней по умолчанию; 0 sensitive-данных без флага | 3-4 дня |
| 6 | Critic pattern (§29.4.2) | Hard-policy блокирует 100% запрещённых действий; 0 false-negative по тестовым кейсам | 3-5 дней |
| 7 | Guarded + Isolated профили (§29.4.4) | Guarded p95 < 10 сек; Isolated p95 < 90 сек; 0 P1 по smoke | 2-3 дня |

**Общий срок:** ~15-23 рабочих дня (3-5 недель).

### 29.7 Главный вывод

CAMEL — академически сильный (архитектура, модульность, memory), но операционно незрелый (нет production safety, нет audit, нет deploy pipeline).

Стратегия: забрать их архитектурные паттерны (TaskSpecify, Critic, Memory, Runtime profiles), но реализовать в нашей safety-first парадигме (hard-policy first, TTL + audit, approval gates, per-agent access).

| Источник | Главный вклад в Stemford |
|----------|------------------------|
| AGiXT (§28) | Операционная зрелость: extension lifecycle, runtime checks, DX |
| CAMEL (§29) | Архитектурная зрелость: TaskSpecify, Critic, Memory, Runtime profiles |
| Stemford (своё) | Safety-first: approval gates, audit trail, handoff protocol, per-agent access |

---

## §30. Бенчмарк Eigent и план внедрения (2026-03-17)

### 30.1 Контекст

Совместный анализ (Claude + Codex) проекта [Eigent](https://github.com/eigent-ai/eigent) — desktop-платформы мульти-агентных систем с Coordinator + Task Planner + Worker архитектурой, MCP-интеграцией и UI для управления задачами.

Цель: забрать продуктовую зрелость Eigent (UX оркестрации, failure handling, event system), сохранив наше преимущество в safety/reliability.

**Важно:** у Eigent обнаружены security advisories (RCE в 0.0.60, непропатченная CI-уязвимость CVE-2026-22869). Берём только паттерны, не код и не зависимости.

### 30.2 Что у Eigent лучше

| Паттерн | Суть | Статус у нас |
|---------|------|-------------|
| Replan strategy | Задача провалилась → перепланирование (другой исполнитель, другая декомпозиция) | Нет — только retry той же задачи тем же агентом |
| Editable plan before execution | Пользователь видит план шагов, может отредактировать/удалить перед стартом | Нет — бот выполняет сразу |
| Budget signal | Агент сигнализирует «ресурсы исчерпаны» вместо тихого падения | Нет — retry_limit_exceeded логируется, но агент не сигнализирует проактивно |
| Typed events | Стандартизированные типы событий: TaskCreated, TaskFailed, ApprovalRequested | Частично — actions_log есть, но action_type не стандартизирован |
| Tool lifecycle | manifest → enable/disable per role → audit | Частично — SOUL.md описывает, но нет runtime enforce |
| Pause/Resume | Перехват управления у агента на лету | Нет — задачу нельзя поставить на паузу |
| Task archive/viewer | Прозрачная история шагов без раскрытия внутреннего reasoning | Нет — actions_log читается только через SQL |

### 30.3 Что у нас лучше

| Паттерн | Наша реализация | У Eigent |
|---------|----------------|---------|
| Approval gates | approval_requests с классами A/B/C, default approvers | HITL только «когда застряли» — реактивный, не policy-based |
| State persistence | PostgreSQL, миграции, WAL | In-memory — всё теряется при рестарте |
| Audit trail | actions_log + HANDOFF_LOG + DEPLOY_LOG + review ritual | Нет структурированного аудита |
| Security posture | Нет insecure defaults, нет docker.sock, токены в env | RCE в 0.0.60, непропатченная CI-уязвимость |
| Production deploy | systemd, health checks, миграции, deploy checklist | Desktop/Electron, не серверный deployment |
| CoT privacy | Внутренний reasoning не показывается пользователю | CoT/Reasoning отображается в UI — нежелательно для прода |

### 30.4 План заимствований

#### 30.4.1 Typed events — стандартизация actions_log

**Что это простыми словами:** Сейчас в actions_log поле `action_type` — произвольный текст. Typed events — это фиксированный список типов событий, как штрихкоды на товарах: каждый тип однозначно идентифицируется и обрабатывается.

**Стандартные типы:**

| Тип события | Когда | Payload |
|------------|-------|---------|
| `task_created` | Создана новая задача | `{task_id, title, assignee, goal_id}` |
| `task_claimed` | Агент взял задачу в работу | `{task_id, agent_role}` |
| `task_completed` | Задача завершена | `{task_id, result_summary}` |
| `task_failed` | Задача провалилась | `{task_id, error, attempt}` |
| `task_paused` | Задача поставлена на паузу | `{task_id, reason}` |
| `task_resumed` | Задача возобновлена | `{task_id}` |
| `retry_requested` | Запрошен retry | `{task_id, attempt, retry_after}` |
| `retry_limit_exceeded` | Исчерпаны попытки retry | `{task_id, max_attempts}` |
| `replan_requested` | Запрошено перепланирование | `{task_id, reason, new_assignee}` |
| `approval_requested` | Запрошено одобрение | `{approval_id, action_class, requester}` |
| `approval_decided` | Одобрение решено | `{approval_id, decision, decider}` |
| `budget_exhausted` | Агент исчерпал ресурсы | `{agent_role, resource_type, limit}` |

**Реализация:** CHECK constraint на `action_type` в PostgreSQL. Новые типы добавляются только через миграцию.

**Связь:** основа для §28.4.2 (webhooks) и §29.4.6 (JSON-лог viewer) — оба зависят от стандартных типов.

#### 30.4.2 Budget signal — «агент кричит, а не молчит»

**Что это простыми словами:** Когда у тебя на телефоне заканчивается батарея, он показывает предупреждение — а не просто выключается. Budget signal — то же самое для агентов: когда ресурсы (попытки, время, лимит вызовов) подходят к концу, агент записывает `budget_exhausted` в actions_log и уведомляет через Telegram.

**Типы ресурсов:**

| Ресурс | Лимит по умолчанию | Что происходит при исчерпании |
|--------|-------------------|------------------------------|
| Retry attempts | 5 (MAX_RETRY_ATTEMPTS) | retry_limit_exceeded → dead-letter |
| Replan attempts | 2 (MAX_REPLAN_ATTEMPTS) | replan_limit_exceeded → dead-letter + Telegram |
| Task duration | 120 мин (STALL_WATCHDOG_THRESHOLD) | Watchdog → retry или replan |
| API calls per task | 50 (настраиваемо) | budget_exhausted → pause + Telegram |

**Реализация:** проверка лимитов в Control API перед каждым действием. При превышении — запись в actions_log + webhook (когда §28.4.2 будет готов).

#### 30.4.3 Replan strategy — «не просто повторить, а переосмыслить»

**Что это простыми словами:** Retry — это «попробуй ещё раз то же самое». Replan — это «то же самое не работает, давай по-другому». Как если курьер не может доставить посылку через главный вход — retry = звонить ещё раз, replan = попробовать через чёрный ход или отправить другого курьера.

**Цепочка отказоустойчивости:**

```
Задача провалилась
  → retry (тот же агент, те же параметры) — до MAX_RETRY_ATTEMPTS (5)
    → replan (другой агент ИЛИ другая декомпозиция) — до MAX_REPLAN_ATTEMPTS (2)
      → dead-letter (задача в статусе failed, уведомление человеку)
```

**Лимиты (по рекомендации Codex — обязательны, иначе бесконечный цикл):**
- `MAX_RETRY_ATTEMPTS = 5` (уже есть)
- `MAX_REPLAN_ATTEMPTS = 2` (новое)
- При каждом replan — запись `replan_requested` в actions_log с причиной и новым assignee

**Реализация:** новый эндпоинт `POST /tasks/:id/replan` в Control API. Логика: сбросить retry_attempt, сменить assignee (или изменить описание задачи), увеличить replan_count, записать в actions_log.

**Новые поля в таблице tasks:**
- `replan_count INTEGER NOT NULL DEFAULT 0`
- `original_task_id INTEGER REFERENCES tasks(id)` — ссылка на исходную задачу (для трейсинга)

#### 30.4.4 Pause/Resume — «пауза / продолжить» из Telegram

**Что это простыми словами:** Как кнопка паузы на плеере. Написал боту «пауза задача #47» — задача замораживается. Watchdog её не трогает, retry не запускается. Написал «продолжить #47» — задача снова в работе.

**Реализация:**
- Новый статус `paused` в tasks (добавить в CHECK constraint)
- `POST /tasks/:id/pause` — переводит в paused, пишет `task_paused` в actions_log
- `POST /tasks/:id/resume` — переводит обратно в in_progress, пишет `task_resumed`
- Watchdog: `WHERE status = 'in_progress'` — paused задачи автоматически игнорируются
- Claim: нельзя claim задачу в статусе paused

**В Telegram:** команды «пауза #47» и «продолжить #47» через stemford-data skill.

### 30.5 Что НЕ берём из Eigent

| Идея Eigent | Почему нет |
|------------|-----------|
| Desktop/Electron архитектура | Наш контур — серверный (VPS + systemd), не desktop |
| In-memory state | Всё должно быть в PostgreSQL — персистентность обязательна |
| Широкие tool-права по умолчанию | Противоречит per-agent tool access (§28.4.3) |
| HITL «только когда застряли» | Наши approval gates = policy-by-default, не opt-in |
| Показ CoT/Reasoning пользователю | Внутренний reasoning — не для прода. Пользователь видит результат и actions feed |
| Зависимость от CAMEL API | Eigent построен поверх CAMEL — мы не берём ни одну из этих зависимостей (§29.5) |
| Чужой код | Security advisories (RCE, CI-уязвимость) — берём только паттерны |

### 30.6 Порядок внедрения с DoD-метриками

| Шаг | Что | DoD-метрика | Срок |
|-----|-----|-----------|------|
| 1 | Typed events (§30.4.1) | CHECK constraint на action_type; все 12 типов задокументированы; существующие записи мигрированы | 2 дня |
| 2 | Budget signal (§30.4.2) | budget_exhausted записывается при превышении каждого из 4 лимитов; 0 «тихих» падений по smoke | 2 дня |
| 3 | Replan strategy (§30.4.3) | POST /tasks/:id/replan работает; replan_count ≤ MAX_REPLAN_ATTEMPTS; dead-letter при превышении; 0 бесконечных циклов | 3 дня |
| 4 | Pause/Resume (§30.4.4) | «Пауза #N» / «Продолжить #N» работают из Telegram; watchdog игнорирует paused; smoke 0 P1 | 1-2 дня |

**Общий срок:** ~8-9 рабочих дней (~2 недели).

### 30.7 Experiment cards

#### EC-5: Typed events
- **Гипотеза**: стандартизация action_type позволит автоматизировать webhooks и viewer без ручного парсинга.
- **Как меряем**: добавить CHECK constraint → существующий код продолжает работать без ошибок; webhook (§28.4.2) маршрутизирует по типу за < 1 строки кода.
- **Срок**: 2 дня.
- **Owner**: Codex (executor), Claude (reviewer).
- **Rollback**: убрать CHECK constraint, вернуть свободный текст.

#### EC-6: Replan strategy
- **Гипотеза**: replan снизит долю задач в dead-letter на 30%+ (задачи, которые раньше падали после 5 retry, теперь решаются через смену подхода).
- **Как меряем**: 5 тестовых задач с намеренным провалом → без replan = 5 dead-letter, с replan = ≤ 3 dead-letter.
- **Срок**: 3 дня.
- **Owner**: Codex (executor), Claude (reviewer).
- **Rollback**: отключить replan, задачи после retry_limit → сразу dead-letter (текущее поведение).

### 30.8 Guardrails (дополнение к §28.10)

1. **MAX_REPLAN_ATTEMPTS = 2** — жёсткий лимит, не настраиваемый агентом. Только через env-переменную на VPS.
2. **Replan не сбрасывает audit** — все retry и replan попытки сохраняются в actions_log. original_task_id связывает всю цепочку.
3. **Pause не скрывает задачу** — paused задачи видны в GET /tasks, только watchdog их игнорирует.
4. **Нет auto-replan** — replan запускается только явно (человек или оркестратор), агент не может сам себя перепланировать.

### 30.9 Главный вывод

Eigent — продуктово зрелый (UX оркестрации, failure handling, editable plans), но операционно и security-незрелый (in-memory state, RCE, opt-in HITL).

Стратегия: забрать их продуктовые паттерны (typed events, budget signal, replan, pause/resume), но реализовать в нашей safety-first парадигме (лимиты, audit trail, policy-gates).

### 30.10 Сводная таблица трёх бенчмарков

| Проект | Главный вклад в Stemford | Главная слабость |
|--------|------------------------|-----------------|
| **AGiXT** (§28) | Операционная зрелость: extension lifecycle, runtime checks, DX | Safety поверхностная, docker.sock |
| **CAMEL** (§29) | Архитектурная зрелость: TaskSpecify, Critic, Memory, Runtime profiles | Research-first, нет production safety |
| **Eigent** (§30) | Продуктовая зрелость: typed events, replan, budget signal, pause/resume | Security advisories, in-memory, opt-in HITL |
| **Stemford** (своё) | **Safety-first**: approval gates, audit trail, handoff protocol, per-agent access, PostgreSQL persistence | Пока нет decomposition, replan, memory, fast-path |

Каждый бенчмарк закрывает конкретные пробелы. Ни один не заменяет нашу архитектуру.

---

## §31. Автономная работа агентов: страховка и контроль (2026-03-17)

### 31.1 Контекст

Переход от ручной диспетчеризации (человек = курьер между Codex и Claude) к автономному циклу: агенты работают на VPS самостоятельно, человек утверждает начало/конец этапов.

Совместный анализ Claude + Codex. Объединённый план из 6 уровней защиты + дополнения Codex (branch protection, разные пользователи VPS, signed deploys, policy-as-code, append-only аудит).

### 31.2 Шесть уровней защиты

#### Уровень 1: Blast Radius (ограничение масштаба ошибки)

Лимиты за один цикл:

| Что | Лимит | Если превышен |
|-----|-------|---------------|
| Файлы server.js / скрипты | Max 2 файла за коммит | Стоп + уведомление |
| Миграции БД | Max 1 за цикл | Стоп + уведомление |
| Изменённые строки кода | Max 150 | Стоп + уведомление |
| Удаление кода | Max 20 строк без одобрения | Стоп + уведомление |

Запрещённые действия (hardcoded):
- Изменение системных файлов (systemd, nginx, ssh, cron)
- Изменение конфигов OpenClaw (openclaw.json, токены)
- `rm -rf`, `DROP TABLE`, `TRUNCATE` без одобрения
- Изменение `.env` файлов
- `git push --force`
- Установка/удаление системных пакетов
- Изменение прав доступа (chmod, chown)
- Любые действия вне `/home/stemford/` и `/opt/stemford/`

#### Уровень 2: Auto-Rollback

Деплой с автооткатом:
1. Запомнить `last_known_good` SHA
2. `git pull` → новый код
3. Миграция (если есть) — только forward-safe (UP + DOWN + CHECK)
4. Рестарт сервиса
5. `smoke_scenarios.sh`
6. FAIL > 0 → `git checkout last_known_good` → рестарт → уведомление «откачено»
7. PASS = все → обновить `last_known_good` → уведомление «деплой ok»

#### Уровень 3: Three-Agent Gate (Executor → Reviewer → Deployer)

Три модели — три роли, каждая делает то, в чём сильна:

| Роль | Модель | Что делает | Почему именно она |
|------|--------|-----------|-------------------|
| **Executor** | Codex (GPT-5.2) | Пишет код, коммитит | Быстро реализует, хорош в генерации кода |
| **Reviewer** | Opus (Claude 4.6) | Ревьюит, ставит P1/P2 | Глубокий анализ, ловит ошибки, видит архитектуру |
| **Deployer** | Sonnet (Claude 4.6) | Деплоит, smoke, отчёт | Быстрый, дешёвый, идеален для детерминированных чеклистов |

Цикл:
```
Codex (Executor)  →  код + коммит
       ↓
Opus (Reviewer)   →  ревью + verdict P1/P2
       ↓  (только если P1=0)
Sonnet (Deployer) →  git pull → migrate → restart → smoke → отчёт
```

Правила:
- Executor **никогда** не деплоит сам.
- Reviewer **никогда** не пишет код.
- Deployer **никогда** не ревьюит и не пишет код — только pull/restart/smoke/rollback.
- Разные токены и системные пользователи VPS для каждой роли (дополнение Codex).

Почему Sonnet как Deployer:
1. Деплой — чеклист, не творчество. Sonnet отлично выполняет пошаговые инструкции.
2. Дешевле Opus за токен. Деплоится часто — экономия накапливается.
3. Быстрее. Для деплоя скорость важнее глубины мышления.
4. Blast radius минимален — deployer не пишет код. Даже при ошибке auto-rollback поймает.

#### Уровень 4: Observability

Три лога:
- `HANDOFF_LOG.md` — каждый цикл работы
- `DEPLOY_LOG.md` — каждый деплой
- `actions_log` (PostgreSQL) — каждое действие в системе

Дублирование в append-only хранилище (дополнение Codex) — агент не может «подчистить» свой лог.

Daily digest в Telegram (утро):
- Циклов за сутки, деплоев, P1 найдено/закрыто, P2 в backlog, smoke summary, откатов, следующий шаг.

Алерты:
- 🔴 Деплой откачен, P1 при ревью, smoke fail, превышен blast radius — немедленно
- 🟢 Этап завершён — summary
- ⚪ Daily digest — утром

#### Уровень 5: Kill Switch

Telegram-команды:
- `стоп` — остановить текущий цикл
- `продолжить` — возобновить
- `откатить` — вернуть на last_known_good
- `статус` — что в работе, последний smoke

Автоматический стоп (без команды):
- 2 деплоя подряд откачены
- 3 P1 подряд при ревью
- Регрессия в smoke (сценарий был PASS, стал FAIL)
- Запрещённая операция из списка Уровня 1

#### Уровень 6: Stage Gate

Начало этапа: уведомление с описанием → ожидание «да» → старт.
Конец этапа: отчёт (что сделано, что получилось, что нет) → подтверждение закрытия.
Агенты автономны **внутри** этапа, но **между** этапами — пауза и отчёт.

### 31.3 Дополнения Codex

| Пункт | Когда внедряем |
|-------|---------------|
| Branch protection (PR + review-check на GitHub) | Режим A |
| Разные системные пользователи VPS (codex-executor, opus-reviewer, deployer) | Режим A |
| Append-only аудит логов (дублирование в БД) | Режим A |
| Policy-as-code (blast radius и запреты в проверяемых правилах пайплайна) | Режим A-B |
| Подписанные коммиты/теги для деплоя | Режим B |
| Canary перед продом | Режим C |

### 31.4 Поэтапный запуск

**Режим A (1-2 дня): Автоматический handoff + review**
- Git push от Codex → Claude автоматически ревьюит → вердикт в HANDOFF_LOG
- Деплой НЕ автоматический. Уведомление: «P1=0. Деплоить? (да/нет)»
- Branch protection, разные токены, append-only аудит

**Режим B (после 3-5 успешных циклов A): Автодеплой с approve**
- P1=0 → подготовка деплоя → «approve deploy» (одно слово)
- Auto-rollback при smoke fail
- Policy-as-code, подписанные коммиты

**Режим C (после 10+ успешных циклов B): Полная автономия внутри этапа**
- Stage gate: человек утверждает начало/конец этапа
- Внутри этапа — полная автономия с 6 уровнями защиты
- Canary для multi-client (§32)

### 31.5 Definition of Done

| Режим | Done = |
|-------|--------|
| A | Ревью автоматически запускается по git push, вердикт пишется в HANDOFF_LOG без участия человека |
| B | Деплой по команде «да» проходит end-to-end: pull → migrate → restart → smoke → отчёт |
| C | 5 этапов подряд завершены автономно без ручного вмешательства внутри этапа |

---

## §32. Масштабируемый шаблон: AI-отдел как услуга (2026-03-17)

### 32.1 Контекст

Превращение Stemford Control Plane из единичного проекта в масштабируемый шаблон. Любой бизнес получает настроенный «отдел AI-ассистентов» — с ботом в Telegram, задачами, одобрениями, audit trail.

Stemford = первый клиент и полигон. Второй клиент = проверка шаблона.

### 32.2 Архитектура шаблона

#### Слой 1: Базовый шаблон (одинаковый для всех)

```
ai-department-template/
├── app/control-api/          # API сервер — без изменений
│   ├── server.js
│   ├── migrations/
│   └── scripts/
│       ├── smoke_scenarios.sh
│       ├── stall_watchdog.sh
│       └── deploy.sh
├── docs/review/
│   ├── HANDOFF_LOG.md
│   └── DEPLOY_LOG.md
├── skills/
│   └── client-data/          # скилл для бота (шаблон)
│       ├── SKILL.md
│       └── references/api.md
├── agents/                   # роли агентов (шаблон)
│   └── <role>/SOUL.md
├── config/
│   ├── client.env.example
│   ├── roles.json
│   ├── goals.json
│   └── keywords.json
├── AGENTS.md
├── START_HERE.md
└── plans/PLAN_template.md
```

#### Слой 2: Конфигурация клиента (уникальна)

Три JSON-файла + один env:

**roles.json**: определение ролей (name, boundaries, allowed_tools, escalates_via)
**goals.json**: миссия + стадии + цели клиента
**keywords.json**: keyword groups для TaskSpecify-lite (автоподстановка assignee)
**client.env**: CLIENT_NAME, TELEGRAM_BOT_TOKEN, VPS_HOST, DB_URL

#### Слой 3: Скрипт развёртывания

`./setup.sh <client_name>`:
1. Клонирует шаблон на VPS
2. Подставляет переменные из client.env
3. Генерирует SOUL.md для каждой роли из roles.json
4. Генерирует keyword groups в SKILL.md из keywords.json
5. Сеет goals в БД из goals.json
6. Создаёт systemd-сервисы
7. Запускает smoke → PASS = готово

### 32.3 Процесс для нового клиента

| День | Что делаем | Результат |
|------|-----------|----------|
| 1 | Бриф с клиентом → заполняем roles.json, goals.json, keywords.json | 3 файла + Telegram-бот создан |
| 2 | `./setup.sh client_name` → smoke pass → агенты запущены | Бот в Telegram работает |
| 3-5 | Агенты работают (executor + reviewer), модерация первых этапов | Кастомизация под бизнес-процессы |
| 6+ | Передача клиенту → daily digest → мониторинг как CEO | «Отдел» работает автономно |

### 32.4 Платформенные миграции (дополнение Codex)

Для обновления клиентов при изменении шаблона:

```
release/<version>/
├── manifest.yaml       # что меняется, from_version
├── migrations/
│   ├── db/*.sql         # миграции БД
│   ├── config/*.sh      # изменения env/config
│   └── runtime/*.sh     # таймеры/сервисы
├── UPGRADE.md           # preflight, пошаговый upgrade, rollback
└── upgrade.sh           # backup → apply → restart → smoke → rollback при fail
```

`platform_version` у клиента (в БД или файле) — апдейтер знает, с какой версии на какую мигрировать.

Rollout по волнам: sandbox → canary → batch.

### 32.5 Юнит-экономика (EUR)

#### Себестоимость одного клиента / месяц

| Статья | EUR/мес |
|--------|---------|
| VPS (2 CPU, 4GB RAM, Hetzner/Contabo) | 8-12€ |
| LLM токены (Codex + Opus) | 15-40€ |
| PostgreSQL (managed или на VPS) | 0-5€ |
| Telegram бот | 0€ |
| **Итого** | **25-55€** |

#### Модель ценообразования

| Статья | EUR |
|--------|-----|
| Setup (разовый) | 300-500€ |
| Подписка / месяц | 150-250€ |

#### Масштабирование

| Клиентов | Выручка/мес | Расходы/мес | Время CEO | Маржа |
|----------|-------------|-------------|-----------|-------|
| 1 | 150-250€ | 25-55€ | ~8ч | ~70% |
| 3 | 450-750€ | 75-165€ | ~12ч | ~75% |
| 5 | 750-1250€ | 125-275€ | ~15ч | ~78% |
| 10 | 1500-2500€ | 250-550€ | ~20ч | ~80% |

Fast-path роутер (§28.4.1) напрямую влияет на маржу: каждый запрос без LLM = экономия на токенах.

### 32.6 Что НЕ входит в шаблон

| Что | Почему |
|-----|--------|
| Кастомный UI/дашборд | MVP = Telegram. Дашборд — отдельная услуга |
| Интеграции с внешними системами | Per-client, не шаблонизируется |
| Multi-tenancy на одном сервере | Каждый клиент = свой VPS. Безопаснее |
| Обучение модели на данных клиента | Используем общие модели + контекст через skills |

### 32.7 Дополнения Codex для масштабирования

| Пункт | Когда |
|-------|-------|
| IaC (terraform/ansible или idempotent bootstrap) | С первого дня |
| Версионирование шаблона (semver + manifest) | С первого дня |
| Per-client secrets store + разные Linux users | С первого дня |
| Policy-as-code для blast radius и запретов | С 3-го клиента |
| Backup/restore как обязательный smoke | С первого дня |
| SLA / операционный пакет | До 2-го клиента |
| Финмодель на стоимости цикла | После 2-го клиента (реальные цифры) |
| Offboarding сценарий | До 3-го клиента |

### 32.8 MVP шаблона (что сделать)

1. Вынести специфику Stemford из хардкода в конфиги (roles.json, goals.json, keywords.json)
2. Написать setup.sh — скрипт клонирования и настройки
3. Параметризовать SKILL.md и SOUL.md — генерация из конфигов
4. Документация для клиента — «как пользоваться ботом»
5. Тест на втором клиенте — развернуть для другого бизнеса

### 32.9 Definition of Done

| Шаг | Done = |
|-----|--------|
| Шаблон готов | `setup.sh test_client` → smoke PASS за < 10 минут на чистом VPS |
| Второй клиент | Реальный бизнес работает через бота ≥ 1 неделю без P1 |
| Масштабирование | 3+ клиента, upgrade.sh обновляет всех без ручного вмешательства |
