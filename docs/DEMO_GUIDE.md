# 3-Minute System Tour

This guide provides a short path through the system's core operating workflows and design decisions.

## 1. Start at the dashboard

Open the [live demo](https://resource-scheduling-tracking-system.onrender.com/).

Read the job-readiness cards as an exception-management view, not as a generic dashboard. Each job is evaluated across **crew, equipment, compliance, weather and permits**, and the overall verdict reflects the worst applicable component.

The important point: the system shows **why** intervention is required rather than hiding the decision behind one score.

## 2. Open the Action Centre

Use **Action Centre** to move from visibility to management action.

The view separates blockers and down-for-service work from warnings and planning uncertainty. A single job can therefore produce more than one actionable exception instead of disappearing behind one rolled-up status.

This is the management loop the application is built around:

```text
operating data → rule evaluation → visible exception → intervention
```

## 3. Open a job with a blocker

Open a blocked job and inspect the component breakdown.

Look for examples such as:

- an unfilled staffing requirement;
- worker or subcontractor compliance exposure;
- an equipment availability problem;
- an expired permit;
- a failed or overdue inspection.

The data model keeps **requirements separate from assignments** and **reservations separate from custody**, so the system can distinguish what was planned from what is actually true.

## 4. Check Schedule or Equipment

In **Schedule**, look at the three-week resource view and conflict indicators.

In **Equipment**, inspect an asset's reservation/custody and maintenance information. QR field scans create an append-only custody history. Reporting a defect takes the asset out of service and creates a work order as one transaction.

The design choice is deliberate: overlapping bookings remain visible conflicts rather than being silently prohibited, because an operations manager may need to create an exception before resolving it.

## 5. Finish with Expiring or Field

Use **Expiring** for the cross-operation compliance sweep: credentials, subcontractor standing, equipment compliance, permits and inspections are brought into one exception view.

Use **Field** to see the same operating system from a job-site perspective: today's crew, equipment and permit state plus field-documentation actions in a mobile-oriented layout.

## What to look for in the repository

For the implementation behind these workflows, continue with:

1. [Portfolio case study](PORTFOLIO_CASE_STUDY.md) — management problem and product decisions.
2. [Architecture](ARCHITECTURE.md) — domain separation, demo isolation and production boundary.
3. `lib/domain/` — framework-free operating rules.
4. `lib/readiness/` — readiness component evaluators.
5. `lib/__tests__/workflows.integration.test.ts` — database-backed cross-domain regression coverage.
6. `.github/workflows/ci.yml` — automated quality gates.

## Demo boundary

All data is synthetic and every visitor receives a private temporary SQLite copy.

The role switcher demonstrates UI permission concepts; it is not authentication. The hosted database/session architecture is appropriate for an isolated portfolio demo, not presented as the production architecture for a multi-user enterprise system.
