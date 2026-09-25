# Resource Scheduling & Tracking System

Field operations for a custom-home general contractor in one app: crew scheduling, equipment tracking, compliance, permits, maintenance and weather risk, judged against each other automatically.

**Live demo: https://resource-scheduling-tracking-system.onrender.com/**

First load can take about a minute while the free host wakes up.

<!-- HERO-IMAGE -->

This is a field-operations and resource-management platform for a custom-home general contractor. It covers crew scheduling and staffing plans, QR-tagged equipment tracking and reservations, worker, subcontractor and asset compliance, permits and inspections, preventive maintenance, daily field documentation, a mobile-first field view, and a weather-risk overlay. Everything lives in one system, so "is this job ready to run tomorrow" is a question the software answers.

**Coastwood Builders is a fictional company invented for this project.** Every job, worker, certification and asset in the seed data is synthetic. No real client, project or pricing information exists anywhere in this repository.

## Try it in 60 seconds

1. Open the dashboard. Three jobs read **Blocked**.
2. Open **Maple Crossing Custom Home** to see the subcontractor insurance and licence hard-stop.
3. Open **Cedar Hollow** or **Harbor Point** to see the double-booking flag.
4. Try `/expiring` for the cross-job sweep of everything that needs attention.
5. Switch the "Viewing as" role in the header and watch controls hide and show.

Each visitor gets an isolated temporary copy of the data, so change anything you like.

## Why this exists

Most GCs I've worked around run field operations across a pile of point tools: a fleet-GPS subscription for equipment, a spreadsheet for certifications, a paper binder for calibration records, a shoebox of permit paperwork nobody's checked the expiration on, a text thread for "is the excavator still at Harbor Point," and a gut check on whether tomorrow's pour will get rained out. None of those tools talk to each other. The person who reconciles them is usually a superintendent standing in a parking lot at 6 a.m.

I built this to see what happens when crew availability, equipment location, compliance status, maintenance due dates, permit and inspection standing, and weather risk live in one place and are judged against each other automatically. A PM no longer assembles the readiness picture by hand every morning.

## What it does

**Getting records into the system.** Jobs, crew, equipment and subcontractor firms are created directly in the app, and seed data is only the starting point. A new job needs a name, address and coordinates (both weather layers and the map depend on a real lat/lng, entered by hand since no geocoding provider is wired in). A new asset gets the next sequential QR tag automatically, using the same numbering as the seed data. A worker's certifications are added on the worker's own page. Without that, a worker created after the seed data loaded could never hold a certification, and the hard-stop below would have nothing to check for anyone but the demo crew. Assigning a worker to a job is where that hard-stop runs at write time. The role picker is a dropdown of the job's own staffing-plan roles instead of free text, so a typo or wording mismatch can't defeat the exact-string match the gate depends on. If the role's staffing-plan requirement names a required certification and the worker fails it, the assignment is rejected outright.

**Crew scheduling.** Every worker assignment is checked against every other assignment for that worker. A double-booking shows up as a flagged conflict the moment it happens, well before two crews arrive at the same truck. A rolling 30-day utilization figure sits on each worker's profile, and a three-week look-ahead board (`/schedule`) lays the whole crew out against the calendar so open capacity and overcommitment are both visible at a glance.

**Crew and equipment requirements.** Assignments show who is on a job. A requirement shows who is supposed to be. Each job carries its own staffing plan: a role or trade, how many of it, and optionally which certifications that role requires. The plan is checked against actual assignments the same way a double-booking is checked, so a job can be free of scheduling conflicts and still be flagged for the licensed electrician nobody has assigned yet. A role's required certifications are what the assignment hard-stop checks a worker against. Equipment gets the same treatment from the other direction. A forward reservation is a plan for where an asset is going, distinct from custody (where it physically is right now, set by scan events). Two jobs booking the same skid steer over an overlapping window show up as a conflict before either superintendent finds out in the yard.

**Equipment registry.** Every asset gets a QR tag. Scanning it (or typing its printed code, when a tag has been sanded off a bucket for the third time) opens a check-out/check-in flow with who has it, which job it's going to, a condition note and an optional photo. The scan log is append-only, so it reads as a chain-of-custody record and has no editable status field.

**Worker certifications.** OSHA cards, crane and rigging certs, first-aid/CPR and trade licenses are tracked per worker with expiry-driven status. Assigning someone to a role that requires a certification they don't currently hold is a hard stop. Status goes beyond current, expiring and expired. A certification's *renewal pattern* changes what "past its date" means: a hard annual wall, a card that never formally expires but ages out of informal currency (OSHA 10/30), a state license cycle, or a fixed cycle with a filing grace period (EPA RRP's 90-day rule). Only a true hard expiry blocks an assignment.

**Subcontractor compliance.** A subcontractor firm's certificate of insurance and trade license are tracked at the entity level: general liability, workers' comp, commercial auto and umbrella coverage, each with its own carrier, policy number and expiry. These records are separate from the person-level certifications an individual crew member from that firm holds. A dispatch decision depends on whether the *business* is currently insured and licensed. A training card belonging to whoever is standing on site that day doesn't answer that, so a firm can show as lapsed on its own standing while every one of its people is personally current.

**Equipment compliance.** Calibration, inspection and warranty tracking follows aviation maintenance-records practice instead of the single-counter approach most construction fleet tools use. A compliance item runs on a fixed interval with an explicit, non-cumulative grace window, and safety-critical items carry a hard limit that tolerance doesn't apply to. An asset tracked on more than one counter (calendar age and run-hours, say) is due whichever comes first.

**Preventive maintenance.** Service plans nest, so a 30-day check can sit inside a 90-day check. Completing the larger service also closes out the smaller one for that cycle, which avoids a stale duplicate work order on the board. A defect reported from a field scan opens its own work order automatically and takes the asset out of service until it's resolved.

**Permits & inspections.** Permits are the legal gate on whether work can proceed at all. They are tracked as their own readiness component, separate from worker and asset compliance, because a permit concerns the structure and a failed inspection stops a job regardless of who is on site or what is parked out front. Each permit carries its own inspection sequence (footing through final, or a single rough-in for a trade permit), and a failed inspection or an expired permit blocks the job outright. Permit types include fire and health alongside the residential set, because tenant-improvement work routinely pulls concurrent permits from more than one authority on different clocks. A lapsed building permit next to a perfectly fine fire permit on the same job is a common state that a job-level-only view would hide. A failed inspection also carries what is being done about it: correction notes, who is responsible for the fix, and how re-inspection gets scheduled (in person, by phone, through an online portal, or by remote video, mirroring the channels a real jurisdiction like Portland, OR documents). A permit has a path forward after it's filed. Mark it issued, record its permit number once known, and set or update its expiry, including filing a renewal (a new expiry date on the same permit, since it is the same permit continuing).

**Cross-job "what's expiring" view.** Every other expiring or overdue indicator in this app lives inside one job's, one worker's or one asset's own page. That works when you're already looking at the record, but it leaves no single screen for the Monday-morning sweep across the whole operation. `/expiring` is that screen. It lists every certification, subcontractor compliance item, equipment compliance item, permit and inspection that isn't fully current, from every job, worker and asset, sorted worst first (already expired, overdue or failed).

**Daily field log.** One entry per job per day: actual weather, crew count, work performed and delays. This is the standard GC documentation that matters in a dispute or a warranty claim. It is informational and never a readiness input. It records what happened, the same way scan history documents custody without gating anything.

**Toolbox talks.** Safety briefings are logged per job with topic, who ran it and who attended, as evidence of an operating safety program. A missed toolbox talk leads to a conversation with a superintendent and doesn't block a job the way a failed inspection does.

**Weather risk.** A two-layer overlay. The first layer is a real 7-day forecast from the National Weather Service, covering the window where forecasting is skillful. The second is a clearly separate climatological outlook (historical averages for the same calendar window, with no prediction claimed) for anything beyond it. The two are never blended into a single number, and the outlook layer never looks like a forecast.

**Mobile-first field view.** Every other screen is built for someone looking at the whole operation, such as a GM or PM across every job. `/field` covers one job at a time. Pick a job and it shows today's crew, equipment and permit status for that job, plus the daily-log and toolbox-talk quick actions, laid out for a thumb and a truck dashboard. The rest of the app is responsive down to phone width too. A five-column table on desktop (jobs, equipment, crew, subcontractors) becomes a stacked card list below that breakpoint. Status never relies on color alone: every status badge pairs its color with a distinct icon (a check, a triangle, an X), so the read survives a colorblind viewer or a washed-out phone screen in direct sun, which is the condition this app's "outdoor mode" palette targets.

## What makes this different

A few decisions here depart deliberately from how most tools in this space handle the same problem. I'd point to these first.

- **The weather overlay states the limits of its own forecast.** Forecast skill for a specific day's rain chance is essentially gone past 10 to 14 days out. That is a predictability limit and has nothing to do with data or vendors. The second layer is explicitly framed as a climatological normal (what this window has looked like historically, averaged over ten years of actual observations), visually distinct from the real forecast and never rendered as a day-specific prediction. A PM should be able to trust every number this tool shows, and a manufactured 30-day forecast would undermine the rest.
- **Compliance runs on a fixed grid.** A late-but-in-tolerance service doesn't push every future due date back by the same margin. The next due point is always calculated from the *nominal* due point plus the interval, and the date the work actually happened plays no part. Without that rule, a fleet that regularly uses its grace window drifts further from its real service interval every cycle, silently, for years.
- **Readiness is a breakdown.** The job-readiness score is five component statuses (crew, equipment, compliance, weather, permits), each independently visible, rolled up to an overall verdict that is always the worst of the five. A PM can see *why* a job isn't ready.
- **Arithmetic does the forecasting.** Equipment-usage forecasting is a rolling usage rate projected forward against the service interval. It is transparent and auditable, and it fits what the problem needs.
- **A requirement is data.** Crew and equipment readiness don't guess at what a job needs from who happens to be assigned or parked on site. They are checked against an explicit staffing plan and forward equipment bookings, the same plan-versus-actual pattern applied twice. That is also why custody (where an asset physically is, set by a scan) and a reservation (where it's booked to go) are two different tables. Conflating a plan with a fact reads fine in a demo and falls apart on a real job.
- **Permits get their own lane.** Most tools that track compliance lump permits in with certifications and calibration as one vague "compliance" bucket. Here a permit is its own readiness component, because it blocks in a different way: a failed framing inspection stops the job even when every worker's OSHA card is current and every piece of equipment is freshly calibrated.
- **A certification's expiry date is sometimes a wall and sometimes a hint.** An OSHA 10 card never formally expires, and a renewal filed on time under a program like EPA RRP keeps a certification valid while the paperwork is pending. Four renewal patterns drive different status math here (see `lib/domain/certifications.ts`), so "past its date" reads as *aging* or *renewal pending* when that is what it means. *Expired*, the one status that blocks an assignment, is reserved for a credential that has truly lapsed.
- **A firm's standing and a person's standing are different records.** Most tools that track "subcontractor compliance" really keep one worker-shaped row with a COI attached. Here a subcontractor's insurance and business license live on the firm, independent of which of its people is on site that day. A firm can lapse on its trade license while its crew's individual training is completely current, a nuance that gets lost when everything is flattened into one compliance table.

## Scope: what this deliberately leaves out

This is an **operational** tool, and that boundary is intentional. Equipment day-rates, job costing, margin tracking and depreciation schedules all came up during planning and were left out. They answer a different question for a different audience (the accounting and PM-cost side of the business). Bolting a thin costing feature onto an operational tool tends to produce something that does both jobs poorly, so the boundary stays sharp. Change orders and cost tracking, RFIs and submittals, and punch lists were weighed the same way and left out for the same reason. Each is a separate tool for contract administration and document control, and each would be a worse version of itself bolted onto this one.

A few other things are out of scope for this pass, on purpose:

- **No authentication. Everyone who opens it has full read/write access.** This is a deliberate boundary, modeled on a real tool. A system I've used to run a GC's own operations took exactly this shape: full access by default, with the option to lock specific employees down to read-only or a narrower slice of the app once you needed that. This build matches that shape as far as it goes, with single-tier full access and no login. A partial, unauthenticated "permissions" layer on top would be more dishonest than none at all. The lockable-access half of the pattern is real future work.
- No background jobs or cron workers. The weather layer refreshes on view (plus a manual "Refresh now") and doesn't poll on a schedule nothing here needs.
- Weather sensitivity is tagged per job for this first pass and applies to no individual task yet (a pour, a roofing day and a crane lift would each get their own threshold). That is the right long-term design and a documented next step.
- No OSHA 300-series injury/illness recordkeeping (Forms 300, 300A, 301). Toolbox talks capture safety-culture documentation: what's being taught and who attended. The federally mandated injury and illness log is a different record, with its own recordability rules, retention requirements and posting obligations. A partial, non-compliant version of a regulated recordkeeping system would be worse than none. If this ever became a real product, that would be a dedicated effort with its own compliance review.

## Scaling to enterprise

A later pass added features aimed at what a bigger GC needs on top of the operational core: more jobs, more subs, a real safety program, public-money work. They are real, usable features built on this app's per-visitor demo architecture. None of them makes this a certified-payroll system, a compliance-department replacement or a real access-control layer.

- **The "viewing as" role switcher** (`components/RoleSwitcher.tsx`, `lib/role.ts`, `lib/actor.ts`) lets you pick a role (Executive, PM, Superintendent, Safety Director, Subcontractor, Field Worker) and see the app hide or show controls the way that role's permissions say it should. This is a UI-only demonstration of the RBAC *concept*. Every check is enforced only in rendering and never in an API route, because this app has no login to verify who is asking (see Scope above). If this app ever got real auth, the permission matrix in `lib/role.ts` is what that auth would need to enforce server-side. A one-line `RoleContextBanner` on the job and worker pages states what the current role can and can't do there. A hidden Pencil icon or a missing dollar column is easy to miss, and the demo should show a reviewer the restriction directly.
- **The audit trail** (`lib/audit.ts`, `AuditLogEntry`) logs who changed what on the handful of fields that get disputed later: a permit's status, an inspection outcome, a lien waiver's status, a safety incident's status. It covers those fields only and does no field-by-field diffing of every mutation. Attribution is only as trustworthy as the "viewing as" identity that produced it, since no real login sits behind it. The record is honest about what this app can vouch for. Each job page has a read-only "Recent activity" card pulling every audit entry attached to that job's own permits, inspections, lien waivers and safety incidents, so the trail can be read as well as written.
- **Lien waivers** (`LienWaiver`) track which waiver (conditional or unconditional, progress or final) is outstanding against which pay period for which sub. Two independent enterprise-scale reviews of this app converged on this gap unprompted: a missing waiver blocks the GC's own pay application to the owner. It is a tracking record and does no document generation or e-signature.
- **Safety incidents** (`SafetyIncident`) log injuries, property damage, environmental events and near-misses as a first-class type of their own. A near-miss is a separate category and never a lesser severity of "injury," since it is the leading indicator a real safety program tracks trends against. This is incident tracking. OSHA 300-series recordkeeping (Forms 300/300A/301) stays out of scope for the same reasons toolbox talks do (see Scope, above).
- **Job hazard analyses** (`JobHazardAnalysis`) record a task, its identified hazards and the controls in place for it. This is the pre-task planning document a real safety program expects on file before higher-risk work starts, and nothing is auto-generated. A job flagged weather-sensitive or conditional gets a lightweight nudge on its JHA card if nothing on file reads like it covers weather exposure (cold/heat stress, wet footing, wind on elevated work). The nudge is a suggestion and gates nothing, and it goes away the moment a JHA mentions any of those terms.
- **Worker screenings** (`WorkerScreening`) record drug test and background check results per worker, append-only. A new test is a new row and old rows are never edited, so the history stays intact. It is a result log with no lab or background-check vendor integration.
- **Certified payroll entries** (`CertifiedPayrollEntry`) record hours, classification and rate by worker by week for jobs that carry `certifiedPayrollRequired`. A private residential job never needs one, while a job touching public money or Davis-Bacon-style prevailing-wage terms does. This is a record of the numbers a certified payroll report would be built from. It has no tax withholding, no benefits administration and no WH-347 export.
- **The portfolio rollup** (`/portfolio`) groups every job by `Job.division` and shows each division's job count and readiness mix. It gives a COO or regional Project Executive overseeing several jobs a view the flat jobs list can't. A single-office company (like the fictional Coastwood Builders this demo is seeded around) has little use for it, which is why `division` is nullable and unset jobs still appear, grouped as "Unassigned."

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**, **React 18**
- **Prisma** ORM over **SQLite**, a local file-based database with no external database server to stand up
- **Tailwind CSS**, with a small custom "outdoor mode" palette tuned for field and mobile readability
- **html5-qrcode** for in-browser camera QR scanning, **qrcode** for tag generation
- **Leaflet / react-leaflet** for the multi-site map view
- National Weather Service API and Open-Meteo's historical archive API for the two weather layers, both free and keyless
- A per-visitor session layer (`middleware.ts`, `lib/db.ts`) for hosted use. Each visitor gets an isolated copy of the seeded database, cleaned up after they've been idle a while, so a link can be shared without one visitor seeing another's changes

The hosted demo is live at https://resource-scheduling-tracking-system.onrender.com/ and runs as a single persistent process on Render's free tier. Every visitor gets a private, temporary copy of the demo data (see `lib/db.ts`). You can also clone and run it locally. Because it uses SQLite, reviewing it needs no infrastructure beyond what's below.

## Getting started

To skip setup, use the [hosted demo](https://resource-scheduling-tracking-system.onrender.com/). To run it locally:

```bash
git clone <this-repo-url>
cd resource-scheduling-tracking-system
npm install

cp .env.example .env
# .env.example documents all three variables. DATABASE_URL and
# NWS_USER_AGENT need no changes for local use (NWS_USER_AGENT should be a
# real identifying string per NWS's usage policy in anything beyond local
# testing); SESSIONS_DIR is optional.

npx prisma generate
npm run db:build-template   # builds prisma/template.db: schema applied, then
                             # seeded with the synthetic Coastwood Builders data

npm run dev
```

Then open `http://localhost:3000`. Your first request provisions your own private copy of the seeded data automatically, the same per-visitor isolation the hosted demo uses. The dashboard is the entry point, and every other view is reachable from the nav bar.

Other scripts worth knowing about:

```bash
npm run test:domain       # runs the dependency-free domain-logic test suite (lib/domain/__tests__)
npm run typecheck         # tsc --noEmit
npm run lint              # next lint
npm run db:studio         # Prisma Studio, pointed at whatever DATABASE_URL currently names
npm run db:build-template # rebuilds prisma/template.db after a schema or seed-data change
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, `test:domain` and a production build on every push and pull request.

## Project structure

```
app/                  Next.js App Router pages and API routes
  api/                 Route handlers (weather refresh, equipment scans, work-order completion)
  jobs/ workers/ subcontractors/ equipment/ schedule/ map/ field/   One route tree per major screen
components/           Shared React components (StatusBadge, WeatherPanel, the equipment scan form, the map)
lib/domain/           Pure, framework-free business logic: scheduling, equipment-reservation conflicts,
                       compliance, certifications (including the assignment hard-stop), subcontractor
                       entity-level compliance, maintenance hierarchy, forecasting, readiness scoring,
                       scan-to-custody rules. No Prisma or Next.js imports in this folder; it's tested
                       standalone (see below).
lib/domain/__tests__/  A dependency-free assertion-based test suite for lib/domain, run under tsx
                       with no test framework required.
lib/weather/          The two weather-layer integrations (NWS forecast, Open-Meteo climatology)
lib/readiness-service.ts   Wires the pure domain logic to live Prisma data for job readiness
lib/db.ts              Hands every route and page its own visitor-scoped Prisma client (see "Tech stack")
lib/session.ts         The session-cookie name shared between middleware.ts and lib/db.ts
middleware.ts           Issues a visitor's session cookie on their first request
prisma/schema.prisma  The full data model, with the design rationale documented inline
prisma/seed.ts        Synthetic Coastwood Builders demo data
prisma/template.db     Built locally by `npm run db:build-template` and not committed (see .gitignore)
```

The domain-logic separation is deliberate. `lib/domain` holds every rule that matters (tolerance windows, overlap detection, the nested-maintenance hierarchy, the readiness rollup, the certification gate on assignments) as plain TypeScript functions with no framework dependency. That lets the rules be verified in isolation in seconds, with nothing to install or mock.

## Data model

`prisma/schema.prisma` is the source of truth, and it's commented in place instead of duplicated here. At a glance: `Job`, `Worker` and `Assignment` cover crew scheduling. `Subcontractor` and `SubcontractorCOI` cover a subcontractor firm's license and insurance standing at the entity level, linked from `Worker` but structurally distinct from `WorkerCertification`, which stays person-level. `Equipment`, `EquipmentLifeCounter`, `EquipmentCompliance` and `MaintenancePlan` (self-referential, for the nested-hierarchy logic) cover the asset side. `WorkOrder` and the append-only `ScanEvent`/`ScanPhoto` pair cover custody and repair history. `WeatherCache` holds the two forecast layers separately, keyed by job and layer. `JobRoleRequirement` and `EquipmentReservation` cover the staffing-plan and forward-booking side of crew and equipment, distinct from `Assignment` and custody. `Permit` and `Inspection` cover the legal-gate side, with `Permit` carrying an ordered sequence of `Inspection`s and, on a failed one, its own correction and re-inspection detail. `DailyLog` and the `SafetyMeeting`/`SafetyMeetingAttendee` pair cover field documentation, both informational and neither a readiness input.

Status and category fields (job status, equipment status, scan action, and so on) are plain `String` columns because SQLite has no native enum type, so the SQLite connector doesn't support the `enum` keyword in schema.prisma at all. `lib/enums.ts` is the single source of truth for each field's allowed values, exported as a const-object-plus-union-type pair so the rest of the app gets the same value/type ergonomics a generated enum would give.

## About this build

Built through AI-paired development: an AI coding agent wrote and iterated on the implementation, and I directed and reviewed it at every stage. I set the requirements, made the architecture and data-model calls, and checked the result against my own operational judgment as it went.

The judgment behind it comes from running field operations. I'm currently Operations Lead at a Pacific Northwest custom-home builder, covering crews, subcontractors, equipment, permits, and the back office (contracts, insurance, budgeting) behind live residential and commercial builds, at a scale where a scheduling conflict or a lapsed COI is a real Tuesday. Before that I worked in supply chain and facilities for a Seattle manufacturer, project management for an Atlanta commercial builder, and a partnership running the field crew and job costing for a residential/commercial builder in NSW. Most of "What makes this different" answers a specific way I've watched software get one of those situations wrong: a subcontractor's insurance status folded into one worker's row instead of the firm's own record, a fleet tool that tracks one counter per asset, a certification's expiry date treated as a hard wall when the real renewal rule is more involved.

That background is also where the access model comes from (see Scope, above). It mirrors a real tool I've relied on to run a GC's own operations, and I trust that shape because I've worked inside it.

## License

MIT, see `LICENSE`.
