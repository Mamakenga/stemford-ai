# START HERE

## Quick Ops Links
- Tech inspection protocol (must-read before real tasks): `docs/TECH_INSPECTION_PROTOCOL.md`
- Task state machine (canonical transitions): `docs/TASK_STATE_MACHINE.md`
- Ops 5-line regulation: `docs/OPS_5LINE_REGULATION.md`

## Карта проекта за 60 секунд
1. `START_HERE.md` — точка входа и правила старта.
2. `AGENTS.md` — минимальный роутер для AI-инструментов и рабочий цикл Executor / Reviewer.
3. `plans/README.md` — главная карта планов: что является active canon, что архив, и в каком порядке читать.
4. `plans/PLAN_Coder_Factory.md` — продуктовый план уровня 1: сначала разворачиваем фабрику кодеров.
5. `plans/PLAN_Business_Control_Plane.md` — продуктовый план уровня 2: потом фабрика кодеров пилит бизнес-контур.
6. `plans/PLAN_Service_Productization.md` — продуктовый план уровня 3: затем система обобщается в масштабируемую услугу.
7. `plans/PLAN_OpenClaw_Control_Plane.md` — стратегическая техническая рамка control plane.
8. `plans/ROADMAP_OpenClaw_Front_CICD_Back.md` — техническая дорожная карта по этапам.
9. `plans/PLAN_Implementation_Reliability_Kanban.md` — исполняемый план внедрения reliability-first контура.
10. `plans/PLAN_UX_CoderFactory_and_Business_Control.md` — каноника UX: отдельно для фабрики кодеров и отдельно для бизнес-контура.
11. `docs/review/HANDOFF_LOG.md` + `docs/review/DEPLOY_LOG.md` — журнал handoff/review/deploy.
12. `OPEN_ISSUES.md` — текущие незакрытые вопросы и блокеры.

Важно:
1. `Paperclip` больше не является активной каноникой этого репозитория.
2. Старые Paperclip-документы допускаются только как архивный или сравнительный контекст, если на них есть прямой запрос.

## Уровни контекста старта (T0/T1/T2)
`T0` (обязательно в каждом новом диалоге):
1. Открыть и прочитать этот файл целиком.
2. Открыть и прочитать `AGENTS.md`.

`T1` (подключать по триггеру, just-in-time):
1. Открыть `plans/README.md`, если нужно понять роли файлов, статус каноники или место нового артефакта в общей структуре.

`T2` (подключать точечно по задаче):
1. По продуктовой логике:
   - `plans/PLAN_Coder_Factory.md`
   - `plans/PLAN_Business_Control_Plane.md`
   - `plans/PLAN_Service_Productization.md`
2. По технической реализации:
   - `plans/PLAN_OpenClaw_Control_Plane.md`
   - `plans/ROADMAP_OpenClaw_Front_CICD_Back.md`
   - `plans/PLAN_Implementation_Reliability_Kanban.md`
   - `plans/PLAN_UX_CoderFactory_and_Business_Control.md`
   - `docs/TASK_STATE_MACHINE.md`
   - `docs/TECH_INSPECTION_PROTOCOL.md`
   - `docs/VPS_CODERS_RUNBOOK.md`
3. По Stemford business context:
   - `plans/PLAN_Stemford_Three_Echelons.md`
   - `plans/PLAN_Stemford_Business.md`
4. По handoff/review/deploy:
   - `docs/review/HANDOFF_LOG.md`
   - `docs/review/DEPLOY_LOG.md`
   - `OPEN_ISSUES.md`

После `T0` можно начинать работу. `T1/T2` подключаются по необходимости.

## Навигационные рельсы
Базовый маршрут:
1. `START_HERE.md`
2. `AGENTS.md`
3. `plans/README.md`
4. Переход к нужной ветке:
   - `plans/PLAN_Coder_Factory.md` — если задача про фабрику кодеров
   - `plans/PLAN_Business_Control_Plane.md` — если задача про бизнес-контур
   - `plans/PLAN_Service_Productization.md` — если задача про масштабируемую услугу
   - `plans/PLAN_OpenClaw_Control_Plane.md` + `plans/ROADMAP_OpenClaw_Front_CICD_Back.md` — если задача про техническую архитектуру
   - `plans/PLAN_Implementation_Reliability_Kanban.md` + `plans/PLAN_UX_CoderFactory_and_Business_Control.md` — если задача про внедрение и UX
   - `docs/TASK_STATE_MACHINE.md` — если задача про статусы и переходы
   - `docs/TECH_INSPECTION_PROTOCOL.md` — если задача про боевые проверки и реальные изменения
   - `docs/review/HANDOFF_LOG.md` + `docs/review/DEPLOY_LOG.md` — если задача про review/deploy trail
   - `agents/orchestrator/SOUL.md`, `agents/pmo/SOUL.md`, `agents/strategy-gatekeeper/SOUL.md`, `agents/finance-kpi/SOUL.md` — если нужна ролевая логика агентов

Правило структуры:
1. Каждый рабочий файл должен иметь понятную роль в системе.
2. Нельзя оставлять в навигации ссылки на несуществующие документы.
3. При добавлении нового важного файла нужно сразу:
   - зафиксировать его роль в `plans/README.md`,
   - добавить путь к нему в этот файл, если он критичен для старта или навигации.

## Каноника без конфликтов
Продуктовая лестница:
1. Сначала `Coder Factory`
2. Потом `Business Control Plane`
3. Потом `Reusable Service`

Техническая каноника:
1. `plans/PLAN_OpenClaw_Control_Plane.md`
2. `plans/ROADMAP_OpenClaw_Front_CICD_Back.md`
3. `plans/PLAN_Implementation_Reliability_Kanban.md`
4. `plans/PLAN_UX_CoderFactory_and_Business_Control.md`

Stemford business canon:
1. `plans/PLAN_Stemford_Three_Echelons.md`
2. `plans/PLAN_Stemford_Business.md`

Archive / reference only:
1. `plans/CONCEPT_Stemford_AI_Deputies_Codex.md`
2. `plans/PLAN_Deputies_Launch_Opus.md`

## Главный принцип
Работаем итеративно: 1 шаг за 1 раз.

Это означает:
1. Не делать длинную цепочку действий без остановки.
2. После каждого шага коротко объяснять: что сделано, зачем, какой результат.
3. Перед каждой новой командой или правкой заранее простыми словами говорить, что делаем и почему.

## Scope Guard
При операционных задачах по Stemford:
1. Работать только в целевом Stemford-контуре.
2. Не сканировать Jarvis-контур без прямого запроса пользователя.
3. Если поиск случайно вышел за нужный контур, остановиться и вернуться в целевую область.

## Уровень объяснений
Объяснять так, чтобы было понятно умному взрослому человеку без навыков программирования и системного администрирования.

Формат объяснения каждого шага:
1. Что делаем сейчас
2. Зачем это нужно проекту
3. Что получилось на выходе
4. Какой следующий шаг логичен

## При конфликте инструкций
Если правило в этом файле конфликтует с новым прямым запросом пользователя, приоритет у последнего явного запроса пользователя.
