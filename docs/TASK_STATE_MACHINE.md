# Task State Machine (v1, as implemented)

Статус: Canonical baseline  
Дата фиксации: 2026-03-28  
Источник: `app/control-api/server.js` + миграции `001..011`

## 1) Зачем нужен этот документ

Этот документ фиксирует одно правило:
1. как именно задача меняет статус в текущей системе;
2. в каких случаях переход блокируется;
3. какой код ошибки возвращается.

Цель:
1. чтобы команда, боты и веб-интерфейс работали по одной логике;
2. чтобы не было споров «а почему задача не запускается/не закрывается».

## 2) Статусы задачи

Базовые статусы:
1. `backlog`
2. `todo`
3. `in_progress`
4. `blocked`
5. `failed`
6. `done`

Примечание:
1. в Kanban-представлении это мапится в человеко-понятные колонки (`Backlog`, `Ready`, `In Progress`, `Review`, `Blocked`, `Done`).

## 3) Разрешенные переходы (Task API)

## 3.1 `POST /tasks/:id/claim`

Переход:
1. `todo -> in_progress`
2. `blocked -> in_progress`

Блокировки:
1. `start_gate_not_approved` — если нужен start gate, но он не approved.
2. `plan_step_blocked` — если предыдущий шаг плана не `done`.
3. `retry_not_ready` — если задача на паузе до `retry_after`.
4. `not_claimable` — если текущий статус не `todo/blocked`.

## 3.2 `POST /tasks/:id/complete`

Переход:
1. `in_progress -> done`
2. `blocked -> done`
3. `todo -> done`

Блокировки:
1. `end_gate_not_approved` — если нужен end gate, но он не approved.
2. `not_completable` — если текущий статус не `in_progress/blocked/todo`.

## 3.3 `POST /tasks/:id/block`

Переход:
1. `todo -> blocked`
2. `in_progress -> blocked`

Блокировки:
1. `invalid_transition_or_not_found`.

## 3.4 `POST /tasks/:id/fail`

Переход:
1. `todo -> failed`
2. `in_progress -> failed`
3. `blocked -> failed`

Блокировки:
1. `invalid_transition_or_not_found`.

## 3.5 `POST /tasks/:id/reopen`

Переход:
1. `done -> todo`
2. `failed -> todo`
3. `blocked -> todo`

Блокировки:
1. `invalid_transition_or_not_found`.

## 3.6 `POST /tasks/:id/retry`

Переход:
1. `failed -> todo`
2. `blocked -> todo`

Побочные эффекты:
1. увеличивает `retry_attempt`;
2. может поставить `retry_after`;
3. очищает `claimed_by`, `claimed_at`, `completed_at`.

Блокировки:
1. `invalid_transition_or_not_found` — если статус не `failed/blocked`.
2. `retry_limit_exceeded` — если достигнут лимит (`TASK_MAX_RETRY_ATTEMPTS`, по умолчанию 5).
3. `retry_conflict` — если статус изменился во время операции.

## 4) Дополнительные правила, которые влияют на переходы

## 4.1 Start Gate
1. Если `requires_start_approval=true`, запуск (`claim`) разрешен только после `start_gate_status='approved'`.
2. Решение gate приходит через `approval_requests` (`approved/rejected`).

## 4.2 End Gate
1. Если `requires_end_approval=true`, завершение (`complete`) разрешено только после `end_gate_status='approved'`.

## 4.3 Последовательность шагов плана
1. Если у задачи задан `plan_id + plan_step_order`, старт шага N блокируется, пока любой шаг `< N` не `done`.

## 4.4 Reject gate
1. Если gate отклонен (`rejected`), задача переводится в `blocked` (кроме случая, когда она уже `done`).
2. В `status_reason` пишется причина вида `start gate rejected` / `end gate rejected`.

## 4.5 Quality Gate перед `done`
1. У задачи может быть список обязательных проверок: `quality_checks_required`.
2. У задачи хранится список уже пройденных проверок: `quality_checks_passed`.
3. Завершение (`complete`) блокируется, если хотя бы одна обязательная проверка не закрыта.
4. Код отказа: `quality_gate_failed`.
5. Проверка `result_summary` засчитывается автоматически, если при завершении передан непустой `summary`.

## 4.6 Review Gate перед `done`
1. У задачи могут быть review findings с уровнем `p1` или `p2`.
2. Открытый `p1` считается блокером.
3. Завершение (`complete`) блокируется, если у задачи есть хотя бы один открытый `p1`.
4. Код отказа: `review_p1_blocked`.
5. `p2` не блокирует завершение, но остается в истории задачи как follow-up риск.

## 5) Маппинг в Kanban-колонки

1. `backlog` -> `Backlog`
2. `todo` + start gate approved/not required -> `Ready`
3. `todo` + start gate pending/rejected -> `Backlog`
4. `in_progress` + end gate pending -> `Review`
5. `in_progress` + end gate approved/not required -> `In Progress`
6. `blocked` или `failed` -> `Blocked`
7. `done` -> `Done`

## 6) Что считается каноникой

Каноника v1:
1. этот документ;
2. серверные ограничения в `server.js`;
3. SQL-ограничения в миграциях.

При расхождении:
1. источником правды считается поведение API и БД;
2. документ обновляется в том же PR/коммите.
