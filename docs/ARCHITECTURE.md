# Architecture

## Purpose

Resource Scheduling & Tracking System is a field-operations application for answering a practical question across active construction work:

> Is this job ready to run, and if not, what is preventing it?

The architecture keeps that decision explainable. Crew, equipment, compliance, weather and permits are evaluated independently and then rolled into an overall readiness result.

## Application shape

```text
Next.js UI
   |
Route handlers / server components
   |
Input validation and orchestration
   |
Domain rules
   |
Prisma
   |
Per-visitor SQLite database
```

The hosted portfolio demo deliberately gives each visitor an isolated temporary SQLite database copied from a seeded template. This lets reviewers change records freely without seeing or corrupting another visitor's session.

That design is for the demo, not a claim about the ideal enterprise deployment.

## Domain layer

Business rules live under `lib/domain` and are intentionally separated from React components and persistence concerns.

Key domains include:

- scheduling and overlap detection;
- worker certifications;
- subcontractor compliance;
- equipment custody and reservations;
- maintenance and compliance intervals;
- forecasting;
- readiness calculation.

The distinction between **plan** and **fact** is important throughout the system. For example, an equipment reservation says where an asset is planned to go; a custody scan says where it actually went.

## Readiness model

Readiness is not a single unexplained score. It is a set of independently visible components:

```text
Crew
Equipment
Compliance
Weather
Permits
   |
   v
Overall readiness = worst applicable component
```

This makes a blocked state actionable. A user can see whether the constraint is an unfilled role, unavailable asset, expired credential, failed inspection or weather risk.

`lib/readiness-service.ts` performs batched persistence orchestration and composes focused evaluators under `lib/readiness/` for crew, equipment, compliance, weather and permits. This keeps the public readiness result stable while preventing one service from owning every component rule.

## Demo session architecture

The hosted demo uses:

1. a generated, seeded SQLite template;
2. a UUID session cookie;
3. one temporary database copy per visitor;
4. a bounded Prisma-client pool;
5. idle/orphan cleanup;
6. throttling on creation of new visitor sessions.

Session identifiers are treated as untrusted input and validated before they can participate in filesystem paths.

Cleanup is request-driven because the free demo host has no dedicated worker requirement. It runs on a deterministic interval during ordinary traffic.

## Production evolution

A real multi-user deployment should replace the demo storage/authentication assumptions rather than stretch them beyond their purpose.

A production direction would be:

```text
Authenticated users
      |
Server-side RBAC
      |
Organisation / tenant boundary
      |
PostgreSQL
      |
Committed migrations + backups + observability
```

The existing UI role switcher demonstrates intended permission differences but is not an authentication or authorization mechanism.

## Reliability priorities

Before treating the application as production deployable, the principal engineering work is:

- committed Prisma migration history;
- broader route-level integration coverage where it adds value beyond the existing database-backed workflow tests;
- server-side authentication and authorization;
- structured logging/error monitoring;
- production database, backup and recovery design.

## Scope boundary

This application deliberately does not attempt to become a complete construction ERP. Estimating, accounting, job costing, RFIs, submittals and broad document management are separate problem domains.

The product is strongest when it remains focused on resource readiness, compliance and field operations.
