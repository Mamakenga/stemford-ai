# Plans Map

Status: Active Canon  
Version: 1.1  
Date: 2026-03-28

## 1) If You Are Lost, Read Only This

Use this order and stop as soon as the picture becomes clear:
1. `PLAN_Coder_Factory.md` - what we build first
2. `PLAN_Coder_Factory_Implementation.md` - how we build the coder factory step by step
3. `PLAN_OpenClaw_Control_Plane.md` - what technical rails already exist under it
4. `PLAN_Implementation_Reliability_Kanban.md` - what is being implemented step by step
5. `PLAN_UX_CoderFactory_and_Business_Control.md` - how the two dashboards must differ

This is the shortest safe navigation path for coder-factory work.

## 2) Project Ladder

The project has three product layers. They must not be mixed.

1. `Coder Factory`
   - first product
   - private owner dashboard
   - internal roles: `orchestrator / executor / reviewer / deployer`

2. `Business Control Plane`
   - second product
   - separate business-facing dashboard
   - built by the coder factory

3. `Reusable Service`
   - third product
   - generalized version for other businesses

Hard order:
1. first build the coder factory
2. then let the coder factory build the business control plane
3. then generalize the result into a reusable service

## 3) Foundation vs Products

There is one more split that matters:

1. `Control Plane`
   - safe rails
   - state
   - approvals
   - retry
   - dead-letter
   - watchdog
   - audit
   - chat

2. `OpenClaw`
   - execution runtime
   - attached on top of those rails

3. `Dashboards`
   - human-facing control surfaces built on top of the engine

Short rule:
1. first rails
2. then runtime
3. then product dashboards

## 4) Active Canon

### Product plans
1. `PLAN_Coder_Factory.md` - level 1 product plan
2. `PLAN_Business_Control_Plane.md` - level 2 product plan
3. `PLAN_Service_Productization.md` - level 3 product plan

### Technical canon
1. `PLAN_Coder_Factory_Implementation.md` - executable build order for the coder factory
2. `PLAN_OpenClaw_Control_Plane.md` - technical strategy and architecture
3. `ROADMAP_OpenClaw_Front_CICD_Back.md` - stage-by-stage roadmap
4. `PLAN_Implementation_Reliability_Kanban.md` - executable implementation phases
5. `PLAN_UX_CoderFactory_and_Business_Control.md` - dashboard UX canon

### Stemford business canon
1. `PLAN_Stemford_Three_Echelons.md` - strategic business ladder
2. `PLAN_Stemford_Business.md` - detailed Stemford business plan

## 5) Archive / Reference Only

These files are useful only as historical context:
1. `CONCEPT_Stemford_AI_Deputies_Codex.md`
2. `PLAN_Deputies_Launch_Opus.md`

Important:
1. archive files may explain the history
2. archive files do not define current implementation choices

## 6) Reading Recipes

If the question is "What are we building right now?":
1. `PLAN_Coder_Factory.md`
2. `PLAN_Coder_Factory_Implementation.md`

If the question is "What technical base already exists?":
1. `PLAN_OpenClaw_Control_Plane.md`
2. `PLAN_Implementation_Reliability_Kanban.md`

If the question is "What exactly do we do next for coder factory?":
1. `PLAN_Coder_Factory_Implementation.md`

If the question is "How should the coder dashboard look and behave?":
1. `PLAN_UX_CoderFactory_and_Business_Control.md`

If the question is "What comes after coder factory?":
1. `PLAN_Business_Control_Plane.md`
2. `PLAN_Service_Productization.md`

If the question is "What belongs only to Stemford business logic?":
1. `PLAN_Stemford_Three_Echelons.md`
2. `PLAN_Stemford_Business.md`

## 7) Anti-Conflict Rules

When two files seem to overlap:
1. product plan wins over historical concept
2. technical canon wins over launch drafts
3. UX canon defines dashboard behavior
4. Stemford business plans do not define coder-factory pipeline
5. coder-factory dashboard and business dashboard must remain separate

## 8) One-Sentence Summary Of Each Main File

1. `PLAN_Coder_Factory.md` - the first real product we are building now
2. `PLAN_Coder_Factory_Implementation.md` - the concrete build sequence for the coder factory
3. `PLAN_Business_Control_Plane.md` - the second product, built later by the coder factory
4. `PLAN_Service_Productization.md` - the future generalized service
5. `PLAN_OpenClaw_Control_Plane.md` - the safe technical skeleton under everything
6. `ROADMAP_OpenClaw_Front_CICD_Back.md` - the roadmap of technical stages
7. `PLAN_Implementation_Reliability_Kanban.md` - the current execution plan
8. `PLAN_UX_CoderFactory_and_Business_Control.md` - the UX split between the two dashboards
