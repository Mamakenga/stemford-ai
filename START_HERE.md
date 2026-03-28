# START HERE

This file is the main entry point.

## Read This First

If you feel lost, read only these files in this order:
1. `START_HERE.md`
2. `AGENTS.md`
3. `plans/README.md`
4. Then choose exactly one branch:
   - `plans/PLAN_Coder_Factory.md`
   - `plans/PLAN_Business_Control_Plane.md`
   - `plans/PLAN_Service_Productization.md`

Rule:
1. Do not read the whole repository "just in case".
2. First choose the product layer.
3. Then open only the technical plan that supports that layer.

## Project Map In 60 Seconds

1. `START_HERE.md` - start contract and navigation rules.
2. `AGENTS.md` - AI router and Executor / Reviewer working cycle.
3. `plans/README.md` - master map of all plans: active canon, archive, reading order.
4. `plans/PLAN_Coder_Factory.md` - product layer 1: coder factory.
5. `plans/PLAN_Business_Control_Plane.md` - product layer 2: business control plane.
6. `plans/PLAN_Service_Productization.md` - product layer 3: reusable service.
7. `plans/PLAN_OpenClaw_Control_Plane.md` - technical architecture and reliability rails.
8. `plans/ROADMAP_OpenClaw_Front_CICD_Back.md` - technical roadmap by stages.
9. `plans/PLAN_Implementation_Reliability_Kanban.md` - executable implementation phases.
10. `plans/PLAN_UX_CoderFactory_and_Business_Control.md` - UX canon for the two separate dashboards.
11. `docs/TASK_STATE_MACHINE.md` - canonical task transitions.
12. `docs/TECH_INSPECTION_PROTOCOL.md` - real-world inspection and change protocol.
13. `docs/VPS_CODERS_RUNBOOK.md` - VPS runtime and deployment runbook.
14. `docs/review/HANDOFF_LOG.md` + `docs/review/DEPLOY_LOG.md` - review and deploy trail.
15. `OPEN_ISSUES.md` - current open blockers and unresolved items.

## The Main Idea

There are three different layers. Do not mix them.

1. `Coder Factory`
   - first product
   - private dashboard for the owner
   - roles: `orchestrator / executor / reviewer / deployer`

2. `Business Control Plane`
   - second product
   - separate dashboard
   - built by the coder factory

3. `Reusable Service`
   - third product
   - generalized version for other businesses

## Foundation First, Runtime Second

The system was designed in this order:
1. first build safe rails:
   - state machine
   - approvals
   - retry
   - dead-letter
   - watchdog
   - audit
   - chat
2. then attach execution runtime on top of those rails
3. then build product dashboards on top of that engine

Important:
1. `Control Plane` = rules, state, reliability, control.
2. `OpenClaw` = execution runtime on top of the control plane.
3. Dashboards are not the engine. They are human-facing control surfaces.

## Which File To Read For Which Question

If the question is "What are we building first?":
1. `plans/PLAN_Coder_Factory.md`

If the question is "What comes after the coder factory?":
1. `plans/PLAN_Business_Control_Plane.md`
2. `plans/PLAN_Service_Productization.md`

If the question is "How does the safe technical skeleton work?":
1. `plans/PLAN_OpenClaw_Control_Plane.md`
2. `plans/PLAN_Implementation_Reliability_Kanban.md`
3. `docs/TASK_STATE_MACHINE.md`

If the question is "How should the dashboards behave?":
1. `plans/PLAN_UX_CoderFactory_and_Business_Control.md`

If the question is "What is live canon and what is archive?":
1. `plans/README.md`

If the question is "How do we deploy or inspect the VPS contour?":
1. `docs/TECH_INSPECTION_PROTOCOL.md`
2. `docs/VPS_CODERS_RUNBOOK.md`
3. `docs/review/DEPLOY_LOG.md`

## Start Context Levels

`T0` (mandatory in every new dialogue):
1. Read this file.
2. Read `AGENTS.md`.

`T1` (only when navigation is needed):
1. Read `plans/README.md`.

`T2` (open only for the current task):
1. Product logic:
   - `plans/PLAN_Coder_Factory.md`
   - `plans/PLAN_Business_Control_Plane.md`
   - `plans/PLAN_Service_Productization.md`
2. Technical logic:
   - `plans/PLAN_OpenClaw_Control_Plane.md`
   - `plans/ROADMAP_OpenClaw_Front_CICD_Back.md`
   - `plans/PLAN_Implementation_Reliability_Kanban.md`
   - `plans/PLAN_UX_CoderFactory_and_Business_Control.md`
   - `docs/TASK_STATE_MACHINE.md`
   - `docs/TECH_INSPECTION_PROTOCOL.md`
   - `docs/VPS_CODERS_RUNBOOK.md`
3. Stemford business context:
   - `plans/PLAN_Stemford_Three_Echelons.md`
   - `plans/PLAN_Stemford_Business.md`
4. Review / deploy trail:
   - `docs/review/HANDOFF_LOG.md`
   - `docs/review/DEPLOY_LOG.md`
   - `OPEN_ISSUES.md`

## Active Canon vs Archive

Active canon:
1. `plans/PLAN_Coder_Factory.md`
2. `plans/PLAN_Business_Control_Plane.md`
3. `plans/PLAN_Service_Productization.md`
4. `plans/PLAN_OpenClaw_Control_Plane.md`
5. `plans/ROADMAP_OpenClaw_Front_CICD_Back.md`
6. `plans/PLAN_Implementation_Reliability_Kanban.md`
7. `plans/PLAN_UX_CoderFactory_and_Business_Control.md`

Archive / reference only:
1. `plans/CONCEPT_Stemford_AI_Deputies_Codex.md`
2. `plans/PLAN_Deputies_Launch_Opus.md`

Historical rule:
1. Archive files may explain where ideas came from.
2. Archive files do not define current execution decisions.

## Scope Guard

For Stemford operational work:
1. Stay inside Stemford scope.
2. Do not scan Jarvis contour unless the user explicitly asks for it.
3. If search drifted into the wrong contour, stop and return to the target area.

## One-Step Rhythm

Work iteratively:
1. one meaningful step at a time
2. explain what is being done now
3. explain why it matters
4. explain what result was produced

## Conflict Rule

If any rule in this file conflicts with a newer direct user request, the latest explicit user request wins.
