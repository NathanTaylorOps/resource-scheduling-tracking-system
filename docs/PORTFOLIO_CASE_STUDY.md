# Portfolio Case Study

## Resource Scheduling & Tracking System

**Role:** Product owner, operations-domain designer and developer  
**Problem space:** Construction field operations, resource scheduling, compliance and job readiness

## The operating problem

Field operations are often split across scheduling spreadsheets, fleet/GPS tools, certification records, permit folders, maintenance logs, weather checks and text messages. Each source can be individually correct while the operation as a whole is still not ready.

The project was built around a management question rather than a software feature list:

> Can this job run as planned, and what needs intervention before it can?

## What the system does

The application combines crew availability, staffing requirements, equipment reservations and custody, worker and subcontractor compliance, equipment maintenance/compliance, permits and inspections, and weather risk.

It then evaluates those inputs as explicit readiness components rather than forcing them into an opaque score.

Examples include:

- detecting a worker booked to overlapping jobs;
- blocking assignment to a role when a required credential has truly expired;
- identifying an unfilled staffing-plan role even when the existing crew has no conflicts;
- distinguishing equipment custody from future reservation;
- blocking a job for a failed inspection even when its people and equipment are otherwise ready;
- taking defective equipment out of service and creating maintenance work;
- separating a real seven-day weather forecast from longer-range climatological context.

## Product decisions

### Explainability over scoring

A manager needs to know why a job is blocked. Readiness therefore exposes crew, equipment, compliance, weather and permit status independently and rolls the worst applicable condition upward.

### Plans and facts are different records

A reservation is not proof of custody. A staffing requirement is not an assignment. Keeping those concepts separate prevents the data model from hiding operational gaps.

### Compliance reflects the underlying rule

Not every date means the same thing. Certification renewal patterns and equipment compliance intervals are modeled so that an informational aging date is not automatically treated like a legal hard stop.

### Honest forecasting

The application does not manufacture a 30-day deterministic weather forecast. Near-term forecast data and longer-range historical context are presented as different information.

### Portfolio demo safety

Every visitor receives an isolated temporary dataset. The seed is synthetic and contains no real client, employee or project information.

## Engineering approach

The project uses Next.js, TypeScript, Prisma and SQLite for the hosted demonstration. Business rules are separated into a domain layer and exercised by automated regression tests. CI runs linting, type checking, schema verification, domain tests, database-backed operational workflow tests, a production build, Playwright UI smoke tests and accessibility checks. Multi-record operational changes use deliberate transaction boundaries, disputed record edits use stale-write protection, and material state changes feed the audit trail.

The current public deployment intentionally optimizes for a safe, low-cost portfolio demo. The repository documents the changes required before a real multi-user deployment: authentication, server-side RBAC, PostgreSQL/tenant boundaries, migrations, concurrency controls and production observability.

## What this demonstrates

The project is intended to demonstrate more than software implementation. It shows an operations approach to:

- translating field failure modes into system rules;
- distinguishing leading indicators from historical records;
- designing controls around resource conflicts and compliance;
- making exceptions visible before they become site problems;
- keeping management decisions traceable and explainable;
- defining product scope instead of accumulating unrelated features.

## Current maturity boundary

The major portfolio-hardening steps originally identified for this build are now implemented: the Action Centre, validated CSV import/export, focused readiness evaluators, modular seed data, stale-write and transaction protection, database-backed workflow tests, and expanded operational audit events.

The principal remaining production boundary is architectural rather than feature volume: committed database migration history, real authentication and server-side authorization, PostgreSQL/tenant boundaries, backups, observability and deployment controls. Those are intentionally not disguised by the hosted portfolio-demo architecture.
