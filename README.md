# Coastwood Field Ops

A field-operations and resource-management platform for a custom-home general contractor — crew scheduling, QR-tagged equipment tracking, worker and asset compliance, preventive maintenance, and an honest weather-risk overlay, in one system instead of four disconnected ones.

This is a working demonstration build, not a deployed product. **Coastwood Builders is a fictional company invented for this project.** Every job, worker, certification, and asset in the seed data is synthetic — there is no real client, project, or pricing information anywhere in this repository.

## Why this exists

Most GCs I've worked around run field operations across a pile of point tools: a fleet-GPS subscription for equipment, a spreadsheet for certifications, a paper binder for calibration records, a text thread for "is the excavator still at Harbor Point," and a gut check on whether tomorrow's pour is going to get rained out. None of those tools talk to each other, and the person who has to reconcile them is usually a superintendent standing in a parking lot at 6 a.m.

I built this to see what it looks like when crew availability, equipment location, compliance status, maintenance due dates, and weather risk live in one place and are judged against each other automatically — so "is this job ready to run tomorrow" is a question the system can answer, not one a PM has to assemble by hand every morning.

## What it does

**Crew scheduling.** Every worker assignment is checked against every other assignment for that worker automatically — a double-booking shows up as a flagged conflict the moment it happens, not when two crews show up to the same truck. A rolling 30-day utilization figure sits on each worker's profile, and a three-week look-ahead board (`/schedule`) lays the whole crew out against the calendar so open capacity and overcommitment are both visible at a glance.

**Equipment registry.** Every asset gets a QR tag. Scanning it (or typing its printed code, when a tag's been sanded off a bucket for the third time) pulls up a check-out/check-in flow — who has it, which job it's going to, a condition note, an optional photo. The scan log is append-only, so it reads as a chain-of-custody record, not an editable status field.

**Worker certifications.** OSHA cards, crane and rigging certs, first-aid/CPR, trade licenses — tracked per worker with expiry-driven status (current / expiring soon / expired) and a hard stop on assigning someone to a role that requires a certification they don't currently hold.

**Equipment compliance.** Calibration, inspection, and warranty tracking modeled on aviation maintenance-records practice rather than the single-counter approach most construction fleet tools use: a compliance item runs on a fixed interval with an explicit, non-cumulative grace window, and safety-critical items carry a hard limit that tolerance doesn't apply to. An asset tracked on more than one counter (calendar age *and* run-hours, say) is due whichever comes first.

**Preventive maintenance.** Service plans nest — a 30-day check folded inside a 90-day check — so completing the larger service also closes out the smaller one for that cycle instead of leaving a stale duplicate work order on the board. A defect reported from a field scan opens its own work order automatically and takes the asset out of service until it's resolved.

**Weather risk.** A two-layer overlay: a real 7-day forecast from the National Weather Service for the window where forecasting is actually skillful, and a clearly separate climatological outlook — historical averages for the same calendar window, not a prediction — for anything beyond it. The two are never blended into a single number, and the outlook layer is never allowed to look like a forecast it isn't.

## What makes this different

A few decisions here are deliberate departures from how most tools in this space handle the same problem, and they're the part of this build I'd point to first:

- **The weather overlay tells the truth about its own limits.** Forecast skill for a specific day's rain chance is essentially gone past 10–14 days out — that's a predictability limit, not a data or vendor problem. Rather than paper over that with a manufactured 30-day forecast, the second layer is explicitly framed as a climatological normal (what this window has looked like historically, averaged over ten years of actual observations), visually distinct from the real forecast and never rendered as a day-specific prediction. I'd rather a PM trust every number this tool shows them than have one flashy-looking layer undermine the rest.
- **Compliance runs on a fixed grid, not a floating one.** A late-but-in-tolerance service doesn't push every future due date back by the same margin — the next due point is always calculated from the *nominal* due point plus the interval, never from the date the work actually happened. Without that rule, a fleet that regularly uses its grace window drifts further from its real service interval every cycle, silently, for years.
- **Readiness is a breakdown, not a badge.** The job-readiness score isn't a single opaque number — it's four component statuses (crew, equipment, compliance, weather), each independently visible, rolled up to an overall verdict that's always the worst of the four. A PM should be able to see *why* a job isn't ready, not just that it isn't.
- **Nothing here pretends to be smarter than arithmetic.** Equipment-usage forecasting is a rolling usage rate projected forward against the service interval — not a machine-learning model dressed up to look more sophisticated than the problem requires. It's transparent, it's auditable, and it's right for what this actually needs to do.

## Scope — what this deliberately leaves out

This is an **operational** tool, not a financial one, and that boundary is intentional rather than an oversight. Equipment day-rates, job costing, margin tracking, and depreciation schedules all came up during planning and were deliberately left out — that's a different tool, answering a different question for a different audience (the accounting/PM-cost side of the business, not the field). Bolting a thin costing feature onto an operational tool tends to produce something that does both jobs poorly; keeping the boundary sharp keeps this one focused.

A few other things are out of scope for this pass, on purpose:

- No authentication or multi-tenant accounts — this is a single-operator field tool, not a SaaS product.
- No background jobs or cron workers — the weather layer refreshes on view (plus a manual "Refresh now") rather than polling on a schedule nothing here needs.
- Weather sensitivity is tagged per job for this first pass, not per task (a pour vs. a roofing day vs. a crane lift, each with its own threshold) — the right long-term design, and a documented next step rather than a v1 requirement.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**, **React 18**
- **Prisma** ORM over **SQLite** — a local, file-based database; no external database server to stand up
- **Tailwind CSS**, with a small custom "outdoor mode" palette tuned for field/mobile readability over desk-monitor subtlety
- **html5-qrcode** for in-browser camera QR scanning, **qrcode** for tag generation
- **Leaflet / react-leaflet** for the multi-site map view
- National Weather Service API and Open-Meteo's historical archive API for the two weather layers — both free, no API key required

This is a local, clone-and-run application by design — SQLite and no hosted deployment target, so reviewing it doesn't require standing up any infrastructure first.

## Getting started

```bash
git clone <this-repo-url>
cd coastwood-fieldops
npm install

cp .env.example .env
# .env.example documents both variables — DATABASE_URL needs no changes for
# local use; NWS_USER_AGENT should be a real identifying string per NWS's
# usage policy (any descriptive value works for local testing).

npx prisma migrate dev --name init   # creates dev.db and applies the schema
npm run db:seed                      # loads the synthetic Coastwood Builders demo data

npm run dev
```

Then open `http://localhost:3000`. The dashboard is the entry point — every other view is reachable from the nav bar.

Other scripts worth knowing about:

```bash
npm run test:domain   # runs the dependency-free domain-logic test suite (lib/domain/__tests__)
npm run db:studio     # Prisma Studio — a GUI over the local SQLite database
```

## Project structure

```
app/                  Next.js App Router pages and API routes
  api/                 Route handlers (weather refresh, equipment scans, work-order completion)
  jobs/ workers/ equipment/ schedule/ map/   One route tree per major screen
components/           Shared React components (StatusBadge, WeatherPanel, the equipment scan form, the map)
lib/domain/           Pure, framework-free business logic — scheduling, compliance, certifications,
                       maintenance hierarchy, forecasting, readiness scoring. No Prisma or Next.js
                       imports in this folder; it's tested standalone (see below).
lib/domain/__tests__/  A dependency-free assertion-based test suite for lib/domain — runs under tsx,
                       no test framework required.
lib/weather/          The two weather-layer integrations (NWS forecast, Open-Meteo climatology)
lib/readiness-service.ts   Wires the pure domain logic to live Prisma data for job readiness
prisma/schema.prisma  The full data model, with the design rationale documented inline
prisma/seed.ts        Synthetic Coastwood Builders demo data
```

The domain-logic separation is deliberate: `lib/domain` holds every rule that actually matters — tolerance windows, overlap detection, the nested-maintenance hierarchy, the readiness rollup — as plain TypeScript functions with no framework dependency. That's what makes it possible to verify the rules that matter most in complete isolation, run in seconds, with nothing to install or mock.

## Data model

`prisma/schema.prisma` is the source of truth, and it's commented in place rather than duplicated here. At a glance: `Job`, `Worker`, and `Assignment` cover crew scheduling; `Equipment`, `EquipmentLifeCounter`, `EquipmentCompliance`, and `MaintenancePlan` (self-referential, for the nested-hierarchy logic) cover the asset side; `WorkOrder` and the append-only `ScanEvent`/`ScanPhoto` pair cover custody and repair history; `WeatherCache` holds the two forecast layers separately, keyed by job and layer.

## Known limitations / roadmap

Written down here rather than left for someone to discover:

- **No per-job crew or equipment requirements model yet.** Readiness currently checks the crew and equipment already assigned to a job, not against a required-roles or required-certs specification for that job — so it can tell you a worker's cert lapsed, but not yet that a job needing a licensed electrician doesn't have one assigned at all. Equipment works the same way: custody is tracked (who has it, right now), but there's no forward equipment-reservation schedule the way crew assignments are scheduled ahead of time, so two jobs can't yet be flagged as needing the same excavator on the same day before it actually happens. Both are natural extensions of the pattern already in place for crew scheduling, not architectural changes.
- **Equipment usage logging isn't built yet.** Run-hours and cycle counters exist in the schema and drive compliance/maintenance status, but nothing in the UI currently lets a user update `EquipmentLifeCounter.currentValue` day to day — right now it advances only via the seed data. A "log today's hours" action on the equipment detail page is the natural next feature.
- **Per-task weather sensitivity** (see Scope, above) — currently tagged at the job level.
- **No photo storage service.** Condition photos captured during a scan are compressed client-side and stored inline as the scan record's data — the right call for a single-file local SQLite deployment, not the right call if this ever needed to run as a hosted multi-user service.
- **The Next.js/Prisma/React layer needs a real `npm install` to fully verify.** The domain-logic layer (`lib/domain`) has its own standalone test suite and is independently verified — `npm run test:domain` — but the application layer on top of it depends on packages this environment couldn't install, so the first `npm run dev` after cloning is also its first true end-to-end run.

## About this build

Built through AI-paired development — I set the requirements, worked through the competitive research and domain rules myself, made every architecture and data-model call stage by stage before any code was written, and reviewed the implementation against that plan as it went. The commit history reflects that process rather than a single dump at the end.

## License

MIT — see `LICENSE`.
