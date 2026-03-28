# PLAN: Coder Factory

Status: Active Canon  
Version: 1.2  
Date: 2026-03-28  
Scope: first product layer + concrete implementation order

## 0) Read This Plan Together With

If you want the full picture without getting lost, read in this order:
1. `PLAN_Coder_Factory.md`
2. `PLAN_OpenClaw_Control_Plane.md`
3. `PLAN_Implementation_Reliability_Kanban.md`
4. `PLAN_UX_CoderFactory_and_Business_Control.md`

Meaning:
1. this file explains both the product and the practical build order
2. control-plane explains the safe rails under the product
3. implementation plan explains the shared reliability-first execution sequence
4. UX plan explains the owner-facing interface

## 1) What Already Exists Under The Factory

The coder factory is not built from zero.

It is built on top of an already assembled reliability skeleton:
1. task state machine
2. approvals
3. retry
4. dead-letter
5. watchdog
6. audit trail
7. chat / action log

Important distinction:
1. `Control Plane` = safe rails, state, reliability, control
2. `OpenClaw` = execution runtime attached to those rails
3. `Coder Factory Dashboard` = owner-facing control surface on top of that engine

## 2) Purpose

Build an AI software factory where the owner manages work through an orchestrator, and the internal pipeline is executed by:
1. `executor`
2. `reviewer`
3. `deployer`

## 3) Core promise

The coder factory must provide:
1. reliable execution
2. visible ownership by role
3. formal Start/End stage approvals
4. review discipline with P1/P2
5. deploy + smoke before finish

## 4) Owner interaction model

The owner:
1. speaks only to the orchestrator
2. discusses the plan in free language
3. approves stage start
4. approves stage finish
5. inspects progress, blockers, and internal coder discussion when needed

The owner does not:
1. run terminal commands on VPS
2. talk directly to executor
3. talk directly to reviewer
4. talk directly to deployer

## 5) Pipeline

Mandatory flow:
1. orchestrator prepares the stage
2. owner approves Start
3. executor works
4. reviewer checks
5. if `P1 > 0`, task returns for fixes
6. if `P1 = 0`, deployer deploys and runs smoke
7. orchestrator summarizes the stage
8. owner approves End

## 6) Runtime model

The runtime layer is role-based, not "one universal agent".

Required role profiles:
1. `orchestrator-profile`
2. `executor-profile`
3. `reviewer-profile`
4. `deployer-profile`

Each profile must have:
1. its own system prompt
2. its own allowed tools
3. its own return format
4. its own provider fallback order
5. its own failure policy

Non-negotiable rule:
1. fallback is configured per role, not globally
2. every fallback event is logged in the run history
3. repeated runtime failure moves the run to `blocked` or `dead_letter`

## 7) Required contracts

Before full runtime autonomy, these contracts must exist together:
1. task contract
2. role run contract
3. isolated work context per coder task
4. reviewer verdict protocol
5. deploy + smoke protocol
6. owner dashboard with orchestrator chat

### 7.1 Task contract

The orchestrator must compile owner text into:
1. task id
2. title
3. goal
4. scope
5. forbidden changes
6. definition of done
7. required checks
8. risk level
9. stage summary

### 7.2 Role run contract

For every runtime role invocation, the system must pass:
1. role
2. task id
3. stage id
4. input context
5. allowed tools
6. required output format
7. timeout / budget policy
8. fallback policy

## 8) Provider routing policy

Recommended default routing:

1. `orchestrator`
   - primary: strongest planning / human-facing model
   - secondary: strongest practical fallback model
   - tertiary: last-resort general model

2. `executor`
   - primary: strongest coding + tool-use model
   - secondary: strongest backup coding model
   - tertiary: last-resort coding-capable model

3. `reviewer`
   - primary: strongest review / risk-detection model
   - secondary: strongest backup reviewer
   - tertiary: last-resort reviewer

4. `deployer`
   - primary: most predictable low-creativity model
   - secondary: safest fallback
   - tertiary: last-resort deploy operator

## 9) Main dashboard

Primary dashboard for this product:
1. left column = human-readable plan with checkboxes
2. center columns = `executor / reviewer / deployer`
3. right side = orchestrator chat + decision inbox + task detail

Canonical UX source:
1. `PLAN_UX_CoderFactory_and_Business_Control.md`

## 10) Technical implementation sources

Canonical technical sources:
1. `PLAN_OpenClaw_Control_Plane.md`
2. `ROADMAP_OpenClaw_Front_CICD_Back.md`
3. `PLAN_Implementation_Reliability_Kanban.md`

## 11) Concrete build order

### Phase A. Freeze the contracts

Step 1. Fix the canonical coder-factory statuses.
1. `Queued`
2. `Executor`
3. `Review`
4. `Deploy`
5. `Done`

Result:
1. UI, API, runtime, and logs use the same language.

Step 2. Finalize the task contract.

Result:
1. coder roles receive a strict machine-readable assignment instead of a vague prompt.

Step 3. Finalize the role run contract.

Result:
1. runtime behavior becomes predictable and auditable.

### Phase B. Separate the runtime contour

Step 4. Create a separate coder-factory runtime contour on the VPS.
Required separation:
1. separate system user
2. separate workspace root
3. separate OpenClaw profile/config root
4. separate systemd units
5. separate logs

Result:
1. the coder factory becomes an isolated execution environment.

Step 5. Attach one OpenClaw runtime layer with four role profiles.
Implementation target:
1. one coder-factory contour
2. multiple role profiles inside that contour
3. role-specific prompts, tools, and fallback chains

Result:
1. the system behaves like a team, not like one general-purpose bot.

Step 6. Configure per-role provider routing and cooldown rules.
Required runtime signals:
1. quota exhausted
2. auth failure
3. timeout
4. model unavailable
5. repeated low-quality failure

Required behavior:
1. mark provider cooldown
2. log reason
3. switch to next provider in the role chain
4. stop after bounded attempts

Result:
1. model rotation becomes controlled instead of chaotic.

### Phase C. Wire runtime to control plane

Step 7. Build the orchestrator bridge: owner request -> task contract.
The orchestrator must:
1. receive owner free-text request
2. produce task contract
3. propose the stage
4. ask for Start

Result:
1. owner interaction is human-readable while the backend stays strict.

Step 8. Build the executor bridge: task contract -> isolated execution run.
Executor runtime must:
1. claim task
2. enter isolated context
3. perform work
4. return structured result
5. attach artifacts and checks

Result:
1. executor becomes a controlled worker, not a free-form chatbot.

Step 9. Build the reviewer bridge: artifacts -> formal verdict.
Reviewer output must contain:
1. verdict
2. `P1` list
3. `P2` list
4. acceptance summary
5. required rework if blocked

Allowed verdicts:
1. `approved`
2. `approved_with_followups`
3. `changes_required`
4. `blocked`

Result:
1. reviewer becomes a formal gate, not an informal commenter.

Step 10. Build the deployer bridge: approved result -> deploy + smoke.
Deployer must:
1. apply approved result
2. run smoke checks
3. return deploy status
4. recommend rollback if needed

Result:
1. deploy becomes visible, bounded, and auditable.

### Phase D. Build the owner-facing product surface

Step 11. Finish the separate `Coder Factory Dashboard`.
The dashboard must contain:
1. left plan column
2. center role columns: `executor / reviewer / deployer`
3. right orchestrator chat
4. owner decision inbox
5. task detail drawer

Result:
1. the owner sees a team at work, not a generic kanban board.

Step 12. Make the orchestrator chat the main interaction surface.
The chat must support:
1. free-text discussion
2. Start approval requests
3. End approval requests
4. blocker escalation
5. short stage summaries

Result:
1. the owner controls the factory without terminal work or role micromanagement.

Step 13. Add owner decisions as a separate inbox.
Must include:
1. approve stage start
2. reject stage start
3. approve stage finish
4. reject stage finish
5. resolve blocker

Result:
1. important decisions do not get lost in chat history.

Step 14. Add task detail with internal role dialogue.
Task detail must show:
1. summary
2. executor output
3. reviewer feedback
4. deploy result
5. checks and artifacts

Result:
1. the owner can inspect the real work when needed without living in logs.

### Phase E. Prove the end-to-end cycle

Step 15. Run the first full internal scenario on a safe task.
Required path:
1. owner request
2. orchestrator plan
3. Start approval
4. executor run
5. reviewer verdict
6. deployer smoke
7. End approval

Result:
1. the factory works as a closed loop.

Step 16. Run one forced rework scenario.
Required path:
1. reviewer raises `P1`
2. task returns to executor
3. fix is delivered
4. reviewer clears `P1`
5. deploy proceeds

Result:
1. review loop is proven under real conditions.

Step 17. Run one fallback scenario.
Required path:
1. primary provider fails for a role
2. runtime logs the reason
3. fallback provider is used
4. run completes or blocks safely

Result:
1. provider rotation is proven as part of factory reliability.

Step 18. Run one blocked/timeout scenario.
Required path:
1. task stalls or runtime fails repeatedly
2. watchdog / retry policy reacts
3. system produces a visible blocked state
4. orchestrator escalates to owner

Result:
1. failure handling is proven, not assumed.

### Phase F. Move from prototype to working factory

Step 19. Lock the operational runbook.
The coder factory must have:
1. start procedure
2. restart procedure
3. deploy procedure
4. smoke checklist
5. incident checklist

Result:
1. the contour can be operated predictably.

Step 20. Declare factory readiness only after one real owner-managed task.
Readiness gate:
1. no terminal work by the owner
2. Start/End approvals visible
3. role handoff visible
4. `P1` gate visible
5. deploy + smoke visible
6. result accepted by owner

Result:
1. the coder factory is no longer a demo board; it is an operating system for the coding team.

## 12) Recommended first practical sequence

The next practical order should be:
1. finalize task contract
2. finalize role run contract
3. separate runtime contour on VPS
4. configure role profiles and provider routing
5. wire orchestrator -> executor -> reviewer -> deployer
6. finish owner dashboard
7. run the first full end-to-end task

## 13) Boundaries

This product is not:
1. the Stemford business dashboard
2. the general business kanban board
3. the reusable service for external clients

Those are later layers.

## 14) Definition of done

The coder factory is considered working only if:
1. owner can run one real task end-to-end without terminal work
2. roles `executor / reviewer / deployer` are visible in the interface
3. Start/End approvals work
4. reviewer P1 blocks finish
5. deploy + smoke are part of the visible flow
6. fallback is role-based and logged
7. no stage bypasses owner control
