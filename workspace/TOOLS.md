# TOOLS.md - Stemford Environment

## Stemford Control API
Local task management system for Stemford STEM school.
- **URL:** `http://127.0.0.1:3210`
- **Auth:** none (loopback only)
- **What it does:** manages tasks, goals, approvals, org chart for the AI department
- **How to use:** see skill `stemford-data` — it has all endpoints and payload formats
- **When to use:** ANY question about tasks, goals, approvals, org structure, handoffs, KPIs

This is your PRIMARY work system. When someone asks about tasks, goals, or approvals — always query this API first via curl.

## Roles
- `orchestrator` — routes and coordinates
- `strategy` — strategic decisions
- `finance` — financial validation
- `pmo` — execution tracking
