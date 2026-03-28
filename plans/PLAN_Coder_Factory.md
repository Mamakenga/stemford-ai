# PLAN: Coder Factory

Status: Active Canon  
Version: 1.1  
Date: 2026-03-28  
Scope: first product layer

## 0) Read This Plan Together With

If you want the full picture without getting lost, read in this order:
1. `PLAN_Coder_Factory.md`
2. `PLAN_OpenClaw_Control_Plane.md`
3. `PLAN_Implementation_Reliability_Kanban.md`
4. `PLAN_UX_CoderFactory_and_Business_Control.md`

Meaning:
1. this file explains the product
2. control-plane explains the rails under the product
3. implementation plan explains the current execution sequence
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
2. `OpenClaw` = execution runtime attached to those rails later
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

## 6) Main dashboard

Primary dashboard for this product:
1. left column = human-readable plan with checkboxes
2. center columns = `executor / reviewer / deployer`
3. right side = orchestrator chat + decision inbox + task detail

Canonical UX source:
1. `PLAN_UX_CoderFactory_and_Business_Control.md`

## 7) Technical implementation source

Canonical technical sources:
1. `PLAN_OpenClaw_Control_Plane.md`
2. `ROADMAP_OpenClaw_Front_CICD_Back.md`
3. `PLAN_Implementation_Reliability_Kanban.md`

## 8) Boundaries

This product is not:
1. the Stemford business dashboard
2. the general business kanban board
3. the reusable service for external clients

Those are later layers.

## 9) Definition of done

The coder factory is considered working only if:
1. owner can run one real task end-to-end without terminal work
2. roles `executor / reviewer / deployer` are visible in the interface
3. Start/End approvals work
4. reviewer P1 blocks finish
5. deploy + smoke are part of the visible flow
