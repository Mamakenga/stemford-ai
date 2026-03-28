# PLAN: Business Control Plane

Status: Active Canon  
Version: 1.0  
Date: 2026-03-28  
Scope: second product layer, built by coder factory

## 1) Purpose

Build a business-facing AI control plane for the Stemford owner after the coder factory is stable.

This layer helps manage:
1. strategy
2. marketing
3. finance
4. operations
5. decisions and reviews

## 2) Dependency

This plan starts after:
1. the coder factory works reliably
2. coder dashboard exists
3. owner approvals and role pipeline are stable

## 3) Main rule

This is not the coder pipeline dashboard.

The business dashboard:
1. uses business language
2. hides engineering noise by default
3. shows outcomes, blockers, and decisions
4. does not expose code review and deploy mechanics

## 4) Main dashboard

Recommended business stages:
1. `Backlog`
2. `In Progress`
3. `Review`
4. `Done`

The owner should see:
1. what is happening now
2. what is blocked
3. what needs decision
4. what is ready for acceptance

Canonical UX source:
1. `PLAN_UX_CoderFactory_and_Business_Control.md`

## 5) Stemford business source

Business meaning is defined by:
1. `PLAN_Stemford_Three_Echelons.md`
2. `PLAN_Stemford_Business.md`

## 6) Definition of done

The business control plane is working only if:
1. the owner can manage business tasks without engineering noise
2. review means business acceptance, not code review
3. the business dashboard is clearly separate from coder dashboard
