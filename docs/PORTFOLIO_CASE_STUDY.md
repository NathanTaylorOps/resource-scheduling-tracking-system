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

The project uses Next.js, TypeScript, Prisma and SQLite for the hosted demonstration. Business rules are separated into a domain layer and exercised by automated domain tests. CI runs linting, type checking, schema verification, domain tests, a production build, Playwright UI smoke tests and accessibility checks.

The current public deployment intentionally optimizes for a safe, low-cost portfolio demo. The repository documents the changes required before a real multi-user deployment: authentication, server-side RBAC, PostgreSQL/tenant boundaries, migrations, concurrency controls and production observability.

## What this demonstrates

The project is intended to demonstrate more than software implementation. It shows an operations approach to:

- translating field failure modes into system rules;
- distinguishing leading indicators from historical records;
- designing controls around resource conflicts and compliance;
- making exceptions visible before they become site problems;
- keeping management decisions traceable and explainable;
- defining product scope instead of accumulating unrelated features.

## Next maturity steps

The highest-value next steps are engineering and workflow improvements rather than feature volume:

1. committed database migrations;
2. focused domain and integration test suites;
3. an Action Centre for cross-job blockers and interventions;
4. CSV import/export for operational interoperability;
5. stale-write and transactional protections;
6. expanded audit events;
7. production authentication/RBAC if the application moves beyond portfolio use.
