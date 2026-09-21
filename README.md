# Coastwood Field Ops

A field-operations and resource-management platform for a custom-home general contractor — crew scheduling and staffing plans, QR-tagged equipment tracking and reservations, worker, subcontractor, and asset compliance, permits and inspections, preventive maintenance, daily field documentation, and an honest weather-risk overlay, in one system instead of a pile of disconnected ones.

This is a working demonstration build, not a deployed product. **Coastwood Builders is a fictional company invented for this project.** Every job, worker, certification, and asset in the seed data is synthetic — there is no real client, project, or pricing information anywhere in this repository.

## Why this exists

Most GCs I've worked around run field operations across a pile of point tools: a fleet-GPS subscription for equipment, a spreadsheet for certifications, a paper binder for calibration records, a shoebox of permit paperwork nobody's checked the expiration on, a text thread for "is the excavator still at Harbor Point," and a gut check on whether tomorrow's pour is going to get rained out. None of those tools talk to each other, and the person who has to reconcile them is usually a superintendent standing in a parking lot at 6 a.m.

I built this to see what it looks like when crew availability, equipment location, compliance status, maintenance due dates, permit and inspection standing, and weather risk live in one place and are judged against each other automatically — so "is this job ready to run tomorrow" is a question the system can answer, not one a PM has to assemble by hand every morning.

## What it does

**Crew scheduling.** Every worker assignment is checked against every other assignment for that worker automatically — a double-booking shows up as a flagged conflict the moment it happens, not when two crews show up to the same truck. A rolling 30-day utilization figure sits on each worker's profile, and a three-week look-ahead board (`/schedule`) lays the whole crew out against the calendar so open capacity and overcommitment are both visible at a glance.

**Crew and equipment requirements.** Assignments show who's on a job; a requirement shows who's *supposed* to be. Each job carries its own staffing plan — a role or trade and how many of it — checked against actual assignments the same way a double-booking is checked, so a job can be free of scheduling conflicts and still be flagged for the licensed electrician nobody's assigned yet. Equipment gets the same treatment from the other direction: a forward reservation is a plan for where an asset is going, distinct from custody (where it physically is right now, set by scan events) — two jobs booking the same skid steer over an overlapping window shows up as a conflict before either superintendent finds out about it in the yard.

**Equipment registry.** Every asset gets a QR tag. Scanning it (or typing its printed code, when a tag's been sanded off a bucket for the third time) pulls up a check-out/check-in flow — who has it, which job it's going to, a condition note, an optional photo. The scan log is append-only, so it reads as a chain-of-custody record, not an editable status field.

**Worker certifications.** OSHA cards, crane and rigging certs, first-aid/CPR, trade licenses — tracked per worker with expiry-driven status, and a hard stop on assigning someone to a role that requires a certification they don't currently hold. Status isn't just current/expiring/expired: a certification's *renewal pattern* — a hard annual wall, a card that never formally expires but ages out of informal currency (OSHA 10/30), a state license cycle, or a fixed cycle with a filing grace period (EPA RRP's 90-day rule) — changes what "past its date" actually means, and only a true hard expiry blocks an assignment.

**Subcontractor compliance.** A subcontractor firm's certificate of insurance and trade license are tracked at the entity level — general liability, workers' comp, commercial auto, and umbrella coverage, each with its own carrier, policy number, and expiry — separately from the person-level certifications an individual crew member from that firm holds. A dispatch decision is really gated by whether the *business* is currently insured and licensed, not by a training card belonging to whoever happens to be standing on site that day, so a firm can show as lapsed on its own standing even while every one of its people is personally current.

**Equipment compliance.** Calibration, inspection, and warranty tracking modeled on aviation maintenance-records practice rather than the single-counter approach most construction fleet tools use: a compliance item runs on a fixed interval with an explicit, non-cumulative grace window, and safety-critical items carry a hard limit that tolerance doesn't apply to. An asset tracked on more than one counter (calendar age *and* run-hours, say) is due whichever comes first.

**Preventive maintenance.** Service plans nest — a 30-day check folded inside a 90-day check — so completing the larger service also closes out the smaller one for that cycle instead of leaving a stale duplicate work order on the board. A defect reported from a field scan opens its own work order automatically and takes the asset out of service until it's resolved.

**Permits & inspections.** The legal gate on whether work can proceed at all, tracked as its own readiness component rather than folded into worker/asset compliance — a permit is about the structure, not the people or equipment on it, and a failed inspection stops a job regardless of who's on site or what's parked out front. Each permit carries its own inspection sequence (footing through final, or a single rough-in for a trade permit), and a failed inspection or an expired permit blocks the job outright. Permit types include fire and health alongside the residential set, because tenant-improvement work routinely pulls concurrent permits from more than one authority on different clocks — a lapsed building permit sitting next to a perfectly fine fire permit on the same job is a real, common state a job-level-only view would hide. A failed inspection also carries what's actually being done about it — correction notes, who's responsible for the fix, and how re-inspection gets scheduled (in person, by phone, through an online portal, or by remote video, mirroring the channels a real jurisdiction like Portland, OR actually documents) — rather than just a red "failed" flag with no path back to passing.

**Daily field log.** One entry per job per day — actual weather, crew count, work performed, delays — the standard GC documentation that matters in a dispute or a warranty claim, not just a nice-to-have. Informational rather than a readiness input: it's a record of what happened, the same way scan history documents custody without itself gating anything.

**Toolbox talks.** Safety briefings logged per job — topic, who ran it, who attended — as evidence of an operating safety program rather than a compliance gate on its own; a missed toolbox talk is a conversation with a superintendent, not a blocked job the way a failed inspection is.

**Weather risk.** A two-layer overlay: a real 7-day forecast from the National Weather Service for the window where forecasting is actually skillful, and a clearly separate climatological outlook — historical averages for the same calendar window, not a prediction — for anything beyond it. The two are never blended into a single number, and the outlook layer is never allowed to look like a forecast it isn't.

## What makes this different

A few decisions here are deliberate departures from how most tools in this space handle the same problem, and they're the part of this build I'd point to first:

- **The weather overlay tells the truth about its own limits.** Forecast skill for a specific day's rain chance is essentially gone past 10–14 days out — that's a predictability limit, not a data or vendor problem. Rather than paper over that with a manufactured 30-day forecast, the second layer is explicitly framed as a climatological normal (what this window has looked like historically, averaged over ten years of actual observations), visually distinct from the real forecast and never rendered as a day-specific prediction. I'd rather a PM trust every number this tool shows them than have one flashy-looking layer undermine the rest.
- **Compliance runs on a fixed grid, not a floating one.** A late-but-in-tolerance service doesn't push every future due date back by the same margin — the next due point is always calculated from the *nominal* due point plus the interval, never from the date the work actually happened. Without that rule, a fleet that regularly uses its grace window drifts further from its real service interval every cycle, silently, for years.
- **Readiness is a breakdown, not a badge.** The job-readiness score isn't a single opaque number — it's five component statuses (crew, equipment, compliance, weather, permits), each independently visible, rolled up to an overall verdict that's always the worst of the five. A PM should be able to see *why* a job isn't ready, not just that it isn't.
- **Nothing here pretends to be smarter than arithmetic.** Equipment-usage forecasting is a rolling usage rate projected forward against the service interval — not a machine-learning model dressed up to look more sophisticated than the problem requires. It's transparent, it's auditable, and it's right for what this actually needs to do.
- **A requirement is data, not an inference.** Crew and equipment readiness don't guess at what a job needs from who happens to be assigned or parked on site — they're checked against an explicit staffing plan and forward equipment bookings, the same plan-versus-actual pattern applied twice. That's also why custody (where an asset physically is, set by a scan) and a reservation (where it's booked to go) are two different tables rather than one: conflating a plan with a fact is exactly the kind of thing that reads fine in a demo and falls apart on a real job.
- **Permits get their own lane.** Most tools that track compliance lump permits in with certifications and calibration as one vague "compliance" bucket. Here a permit is its own readiness component, because it's a categorically different kind of blocker — a failed framing inspection stops the job regardless of whether every worker's OSHA card is current and every piece of equipment is freshly calibrated.
- **A certification's expiry date isn't always a wall.** Treating every credential's date field as a hard cutoff is the easy, wrong model — an OSHA 10 card never formally expires, and a renewal filed on time under a program like EPA RRP keeps a certification valid while the paperwork is pending. Four renewal patterns drive genuinely different status math here (see `lib/domain/certifications.ts`), so "past its date" reads as *aging* or *renewal pending* when that's what it actually means, and reserves *expired* — the one status that blocks an assignment — for when a credential has truly lapsed.
- **A firm's standing and a person's standing are different records.** Most tools that track "subcontractor compliance" really mean one worker-shaped row with a COI attached to it. Here, a subcontractor's insurance and business license live on the firm, independent of which of its people is on site that day — so a firm can lapse on its trade license while its own crew's individual training is completely current, exactly the kind of nuance that gets lost when everything is flattened into one compliance table.

## Scope — what this deliberately leaves out

This is an **operational** tool, not a financial one, and that boundary is intentional rather than an oversight. Equipment day-rates, job costing, margin tracking, and depreciation schedules all came up during planning and were deliberately left out — that's a different tool, answering a different question for a different audience (the accounting/PM-cost side of the business, not the field). Bolting a thin costing feature onto an operational tool tends to produce something that does both jobs poorly; keeping the boundary sharp keeps this one focused. Change orders and cost tracking, RFIs and submittals, and punch lists were weighed the same way and left out for the same reason — each is a genuinely different tool answering a different question (contract administration and document control, not field operations), and each would be a worse version of itself bolted onto this one.

A few other things are out of scope for this pass, on purpose:

- No authentication or multi-tenant accounts — this is a single-operator field tool, not a SaaS product.
- No background jobs or cron workers — the weather layer refreshes on view (plus a manual "Refresh now") rather than polling on a schedule nothing here needs.
- Weather sensitivity is tagged per job for this first pass, not per task (a pour vs. a roofing day vs. a crane lift, each with its own threshold) — the right long-term design, and a documented next step rather than a v1 requirement.
- No OSHA 300-series injury/illness recordkeeping (Forms 300, 300A, 301). Toolbox talks capture safety-*culture* documentation — what's being taught and who attended — which is a genuinely different record from the federally mandated injury and illness log, with its own recordability rules, retention requirements, and posting obligations. Building a partial, non-compliant version of a regulated recordkeeping system would be worse than not building one at all; if this ever became a real product, that's a dedicated effort with its own compliance review, not a bullet point added to an existing table.

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
  jobs/ workers/ subcontractors/ equipment/ schedule/ map/   One route tree per major screen
components/           Shared React components (StatusBadge, WeatherPanel, the equipment scan form, the map)
lib/domain/           Pure, framework-free business logic — scheduling, equipment-reservation conflicts,
                       compliance, certifications, subcontractor entity-level compliance, maintenance
                       hierarchy, forecasting, readiness scoring, scan-to-custody rules. No Prisma or
                       Next.js imports in this folder; it's tested standalone (see below).
lib/domain/__tests__/  A dependency-free assertion-based test suite for lib/domain — runs under tsx,
                       no test framework required.
lib/weather/          The two weather-layer integrations (NWS forecast, Open-Meteo climatology)
lib/readiness-service.ts   Wires the pure domain logic to live Prisma data for job readiness
prisma/schema.prisma  The full data model, with the design rationale documented inline
prisma/seed.ts        Synthetic Coastwood Builders demo data
```

The domain-logic separation is deliberate: `lib/domain` holds every rule that actually matters — tolerance windows, overlap detection, the nested-maintenance hierarchy, the readiness rollup — as plain TypeScript functions with no framework dependency. That's what makes it possible to verify the rules that matter most in complete isolation, run in seconds, with nothing to install or mock.

## Data model

`prisma/schema.prisma` is the source of truth, and it's commented in place rather than duplicated here. At a glance: `Job`, `Worker`, and `Assignment` cover crew scheduling; `Subcontractor` and `SubcontractorCOI` cover a subcontractor firm's license and insurance standing at the entity level, linked from `Worker` but structurally distinct from `WorkerCertification`, which stays person-level; `Equipment`, `EquipmentLifeCounter`, `EquipmentCompliance`, and `MaintenancePlan` (self-referential, for the nested-hierarchy logic) cover the asset side; `WorkOrder` and the append-only `ScanEvent`/`ScanPhoto` pair cover custody and repair history; `WeatherCache` holds the two forecast layers separately, keyed by job and layer. `JobRoleRequirement` and `EquipmentReservation` cover the staffing-plan and forward-booking side of crew and equipment, distinct from `Assignment` and custody; `Permit` and `Inspection` cover the legal-gate side, with `Permit` carrying an ordered sequence of `Inspection`s and, on a failed one, its own correction and re-inspection detail; `DailyLog` and the `SafetyMeeting`/`SafetyMeetingAttendee` pair cover field documentation, both informational rather than readiness inputs.

Status- and category-style fields (job status, equipment status, scan action, and so on) are plain `String` columns rather than Prisma `enum`s — SQLite has no native enum type, so the SQLite connector doesn't support the `enum` keyword in schema.prisma at all. `lib/enums.ts` is the single source of truth for each field's allowed values, exported as a const-object-plus-union-type pair so the rest of the app gets the same value/type ergonomics a real generated enum would.

## Known limitations / roadmap

Written down here rather than left for someone to discover:

- **Crew requirements, equipment reservations, permits, field documentation, and subcontractor records are all read-only for this pass.** The staffing plan and forward equipment bookings, permits and inspections, daily logs, toolbox talks, and subcontractor license/COI records are fully modeled, seeded with realistic (synthetic) data, and feeding readiness where that's appropriate (staffing plans, reservations, permits, and subcontractor compliance) or displayed for reference (daily logs, toolbox talks) — but there's no UI yet to create or edit any of them from the app itself; today they exist because the seed data populates them, the same way equipment usage logging works below. Building those forms is additive to the existing structure, not a redesign — the pattern (a page, a form, a route handler) is already established by the equipment check-in/check-out flow.
- **Equipment usage logging isn't built yet.** Run-hours and cycle counters exist in the schema and drive compliance/maintenance status, but nothing in the UI currently lets a user update `EquipmentLifeCounter.currentValue` day to day — right now it advances only via the seed data. That's also why the usage-based forecast on the equipment page ("at lifetime-average pace, due in ~N days") is a lifetime average rather than a recent trend — it's derived from just two points, in-service date and today, because there's no logged history of dated readings to compute a rolling rate from yet. A "log today's hours" action on the equipment detail page is the natural next feature, and it would sharpen that forecast for free — `lib/domain/forecasting.ts` already supports a proper rolling-window rate, it just has nothing but two points to work with today.
- **Per-task weather sensitivity** (see Scope, above) — currently tagged at the job level.
- **Phase-aware weather sensitivity is the natural middle step before full per-task tagging.** Even short of tracking every individual task, a job's weather sensitivity realistically changes as it moves through phases — a foundation pour and interior finish work have very different weather thresholds on the same job. Tagging sensitivity by phase rather than only by job would sharpen the weather readiness component well before the fuller per-task model above is worth building.
- **No bulk actions.** Every record — a certification renewal, a reservation, a permit status — is a one-at-a-time edit once the forms above exist. A subcontractor renewing insurance for its whole crew at once, or a PM shifting a week of reservations off a piece of equipment going down for service, are real, common operations that a one-row-at-a-time UI makes needlessly tedious. Worth designing once the underlying single-record forms exist, not before.
- **No foreman-scoped view.** Every screen here is built for whoever's looking at the whole operation — a GM or PM across every job. A foreman or crew lead on a single site doesn't need five jobs' worth of readiness detail; they need today's crew, today's equipment, and today's permit status for the one job they're standing on, in a view fast enough to actually use from a phone in the parking lot. That's a read-only, single-job, mobile-first slice of the same data, not a new data model.
- **No photo storage service.** Condition photos captured during a scan are compressed client-side and stored inline as the scan record's data — the right call for a single-file local SQLite deployment, not the right call if this ever needed to run as a hosted multi-user service.
- **Hybrid, multi-counter compliance and maintenance items aren't representable yet.** `earliestDue` (`lib/domain/compliance.ts`) and `resolveHybridDueDate`/`bucketForecast` (`lib/domain/forecasting.ts`) already implement "whichever comes first" resolution for an item governed by more than one counter at once — the way a real OEM service manual is written ("every 6 months or 250 hours, whichever occurs first") — and are verified by their own worked examples in the domain suite. Nothing calls them yet: `EquipmentCompliance` and `MaintenancePlan` rows each govern exactly one counter today, so a hybrid requirement needs two rows treated as one, and the schema doesn't group rows that way. Grouping them, and building the fleet-wide rolling maintenance forecast `bucketForecast` is shaped for (what's coming due across every asset in the next 30/60/90 days, not just one asset's own detail page), is the natural next step for this corner of the model.
- **The Next.js/Prisma/React layer needs a real `npm install` to fully verify.** The domain-logic layer (`lib/domain`) has its own standalone test suite and is independently verified — `npm run test:domain` — but the application layer on top of it depends on packages this environment couldn't install, so the first `npm run dev` after cloning is also its first true end-to-end run. `.github/workflows/ci.yml` closes most of that gap going forward — install, lint, a throwaway schema push to a fresh SQLite database, the domain suite, and a full `next build` run on every push — so a broken build surfaces on the commit that caused it rather than at the next clone. No `package-lock.json` or `prisma/migrations/` history is committed yet, for the same reason: neither has ever been generated by a successful install in an environment that could run one. CI installs and syncs the schema directly (`npm install`, `prisma db push`) rather than the lockfile-pinned, migration-history-replaying commands (`npm ci`, `prisma migrate deploy`) a long-running production setup would graduate to once both exist.

## About this build

Built through AI-paired development, and rebuilt here from an existing, already-implemented field-operations system rather than designed from a blank slate — the domain model, the compliance and maintenance rules, and the overall product shape were already worked out and proven before this repository existed. My part was setting the requirements and target architecture for the rebuild, making the stack- and data-model calls needed to bring that existing design into Next.js, Prisma, and SQLite, and reviewing the implementation against the original design at every stage. That's also why the commit history reads the way it does: porting and re-implementing decisions that were already made moves at a different pace than discovering them for the first time, and this history shows that pace rather than a from-scratch one.

## License

MIT — see `LICENSE`.
