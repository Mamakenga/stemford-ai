# PLAN: UX for Coder Factory and Business Control Plane

Status: Draft for execution  
Version: 1.0  
Date: 2026-03-28  
Scope: interaction model + dashboard UX for two separate products on one control engine

## 1) Purpose

This plan fixes the human interaction logic so the project does not drift into a generic task board.

Product order is mandatory:
1. First product: `Coder Factory`.
2. Second product: `Business Control Plane` for Stemford.
3. Third product: reusable platform/service for other businesses.

Main rule:
1. The coder factory and the business control plane use one engine.
2. They do not use one dashboard.
3. They do not use one UX language.

## 2) Shared engine, separate interfaces

Shared backend engine:
1. task bus
2. state machine
3. approvals
4. actions log
5. chat
6. quality gates
7. review findings P1/P2
8. runtime runs / retry / dead-letter

Separate UI layers:
1. `Coder Factory Dashboard`
2. `Business Dashboard`

Do not mix:
1. coder stages with business stages
2. code review with business acceptance
3. deploy pipeline with business task movement
4. owner discussion with orchestrator and direct discussion with coder roles

## 3) Coder Factory: interaction model

The owner talks only to the orchestrator.

The orchestrator is responsible for:
1. understanding the owner request in free language
2. translating it into a strict task contract
3. proposing a step-by-step plan
4. requesting owner approval to start a stage
5. coordinating `executor -> reviewer -> deployer`
6. escalating blockers back to the owner
7. requesting owner approval to finish a stage

The owner does not:
1. talk directly to executor
2. talk directly to reviewer
3. talk directly to deployer
4. run terminal commands on VPS

The owner does:
1. discuss the plan with the orchestrator
2. approve stage start
3. approve stage finish
4. inspect progress, blockers, and internal discussion when needed

## 4) Coder Factory: task model

Main management object:
1. a stage of the plan

Execution object:
1. a coder task/card under that stage

Meaning:
1. the plan step is what the owner manages
2. the coder card is how the factory executes that step

Mandatory visible roles:
1. `executor`
2. `reviewer`
3. `deployer`

Mandatory stage gates:
1. `Start`
2. `End`

Mandatory inner loop:
1. orchestrator prepares the stage
2. owner approves stage start
3. executor works
4. reviewer checks
5. if `P1 > 0`, the task returns for fixes
6. if `P1 = 0`, deployer deploys and runs smoke
7. orchestrator summarizes result
8. owner approves stage finish

## 5) Coder Factory Dashboard: target layout

### A. Top executive bar

Always answer these questions:
1. where are we in the plan
2. who is active now
3. is there a blocker
4. does the owner need to act now

Recommended fields:
1. current stage
2. active role
3. blocker state
4. next owner action

### B. Left column: human-readable plan

The left column is the route map.

Requirements:
1. the plan is written in human language
2. each step has a checkbox
3. each step has a current status
4. each step shows who is currently working on it
5. each step can show progress across child cards

Recommended statuses:
1. not started
2. waiting for start approval
3. in execution
4. in review
5. in deploy
6. waiting for finish approval
7. done
8. blocked

### C. Middle area: coder role columns

Separate columns:
1. `Executor`
2. `Reviewer`
3. `Deployer`

Card meaning:
1. a live work unit owned by one role at one moment

Card should show only:
1. title
2. linked plan step
3. current state
4. latest short update
5. blocker badge if needed
6. one main next action if owner action is required

Card should not overload the owner with:
1. internal ids by default
2. raw API reason codes
3. low-level shell detail
4. every technical knob

### D. Right area: orchestrator chat

The owner chat is always with the orchestrator.

Two message modes are mandatory:
1. normal working message
2. decision request

Decision request must stand out visually and provide clear actions:
1. approve stage start
2. reject stage start
3. approve stage finish
4. return for rework

### E. Decision inbox

In addition to chat, the dashboard should have a separate inbox for decisions.

Purpose:
1. important approvals must not be lost in chat history

Types:
1. approve start
2. approve finish
3. resolve blocker
4. accept reviewer recommendation

### F. Task detail view

When a card is opened, the owner sees a structured task view.

Recommended tabs:
1. `Summary`
2. `Discussion`
3. `Artifacts`

`Summary` shows:
1. what the task is
2. what stage it belongs to
3. what is done
4. what is blocked
5. what is needed from the owner

`Discussion` shows:
1. executor <-> reviewer dialogue
2. orchestrator interventions
3. key clarification messages

`Artifacts` shows:
1. diff summary
2. commit / branch / run info
3. checks
4. smoke result
5. deploy result

## 6) Coder Factory: UX rules

1. The owner should feel they manage a software factory, not a CLI wrapper.
2. Orchestrator remains the single conversational front.
3. Plan steps are more important than raw tasks.
4. The dashboard must expose role ownership clearly.
5. Reviewer feedback must be structured, not noisy.
6. Deployer must be visible as a separate accountable role.
7. Every owner-required action must be visible both in chat and in decision inbox.

Recommended reviewer verdicts:
1. approved
2. approved with follow-ups
3. changes required
4. blocked

Recommended deployer outcomes:
1. deploy queued
2. deploy running
3. smoke passed
4. smoke failed
5. rollback needed

## 7) Coder Factory: borrowed mechanics from kanban-style tools

Useful mechanics to adopt:
1. one task = one isolated execution context
2. visual card ownership
3. visible dependencies between plan steps/cards
4. quick open into detailed discussion
5. live status refresh
6. strong review surface before finish

How to adapt them:
1. do not expose them as a generic to-do board
2. bind them to the factory pipeline
3. keep owner approvals as formal Start/End stage gates

## 8) Business Control Plane: interaction model

This is the second-layer product, built after coder factory stabilizes.

Main difference:
1. the owner manages business work
2. not the software delivery pipeline

The owner may still talk to an orchestrator-like front role, but the meaning is different:
1. business goals
2. marketing tasks
3. finance tasks
4. operations tasks
5. decision support

The business owner does not need:
1. diff view
2. commit view
3. deploy stages
4. executor/reviewer/deployer inner mechanics

## 9) Business Dashboard: target layout

Recommended visible columns:
1. `Backlog`
2. `In Progress`
3. `Review`
4. `Done`

Meaning:
1. `Backlog` = planned work for later
2. `In Progress` = active business work
3. `Review` = waiting for acceptance, decision, or rework
4. `Done` = accepted result

Business card should show:
1. title
2. business owner or agent owner
3. current progress
4. blocker state
5. next needed decision

Business card should not show:
1. code review artifacts
2. deploy details
3. branch/commit/run ids by default

## 10) Business Dashboard: UX rules

1. speak business language, not engineering language
2. show outcomes, blockers, and decisions
3. hide internal factory mechanics by default
4. review means business acceptance, not code review
5. blocked state should be a card condition, not a separate mental model explosion

The dashboard must answer:
1. what is happening now
2. what is blocked
3. what needs the owner decision
4. what result is ready to accept

## 11) Explicit anti-mixing rules

Coder Factory Dashboard must not become:
1. a generic business task board
2. a Trello clone for Stemford operations

Business Dashboard must not become:
1. a thin wrapper around engineering cards
2. a surface for code review and deploy control

Separation rule:
1. same engine
2. different dashboards
3. different language
4. different default detail level

## 12) Implementation order

1. Stabilize backend engine.
2. Build `Coder Factory Dashboard`.
3. Run one real end-to-end coder-factory scenario.
4. Let coder factory implement the business control plane.
5. Build `Business Dashboard`.
6. Generalize into reusable service.

## 13) Definition of done for UX split

The split is considered real only if:
1. coder dashboard and business dashboard are different pages/products
2. coder dashboard uses role columns `executor / reviewer / deployer`
3. owner speaks only with orchestrator in coder factory
4. business dashboard uses business stages `Backlog / In Progress / Review / Done`
5. business dashboard hides engineering noise by default
