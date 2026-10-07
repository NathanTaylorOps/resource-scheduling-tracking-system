# Changelog

Notable changes to the Resource Scheduling & Tracking System are documented here.

This project is developed as a portfolio-grade field-operations platform. Entries focus on meaningful product, architecture, reliability and presentation changes rather than every internal commit.

## Unreleased

### Changed
- Replaced probabilistic visitor-session cleanup with a deterministic request-driven sweep interval.
- Continued repository hardening and portfolio presentation cleanup.

### Planned
- Split the domain smoke suite into focused domain test modules.
- Add API/integration coverage for critical scheduling, compliance, permit and equipment workflows.
- Introduce committed Prisma migration history before treating the data layer as production-deployable.
- Add an operations Action Centre for cross-job blockers and interventions.
- Add CSV import/export for core operational records.
- Add stale-write protection and targeted transactional boundaries for concurrent mutations.

## 0.1.0

### Added
- Crew scheduling, staffing plans and utilization views.
- Equipment registry, QR custody scans, reservations, maintenance and compliance tracking.
- Worker certification and subcontractor compliance management.
- Permit and inspection workflows.
- Daily field logs, toolbox talks, hazard analyses and safety incident tracking.
- Lien-waiver and payroll-entry tracking for enterprise/public-work scenarios.
- Job readiness engine combining crew, equipment, compliance, weather and permit status.
- Seven-day National Weather Service forecast plus separately labelled climatological outlook.
- Mobile-first field view and responsive desktop operations interface.
- Per-visitor isolated demo databases.
- Role-based UI demonstration and selected-field audit trail.
- CI gates for linting, type checking, domain logic, production build, Playwright smoke testing and accessibility.
