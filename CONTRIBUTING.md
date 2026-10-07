# Contributing

This is a solo portfolio project maintained by Nathan Taylor. Contributions and issue reports are welcome, but changes should preserve the project's central purpose: a credible field-operations and resource-readiness system rather than an all-purpose construction ERP.

## Development workflow

1. Create a focused branch from `main`.
2. Keep changes scoped to one coherent concern.
3. Run the full local verification suite before opening a pull request.
4. Explain both **what changed** and **why the operating workflow is better or safer**.
5. Keep synthetic/demo data synthetic. Never commit real client, employee, project, credential or pricing data.

## Required checks

Run:

```bash
npm ci
npx prisma generate
npm run lint
npm run typecheck
npm run test:domain
npm run build
npm run db:build-template
npm run test:web
```

Changes should not be merged with failing lint, type checks, domain tests, production build or UI smoke/accessibility checks.

## Architecture boundaries

- Put business rules in `lib/domain` where they can be tested independently of React and Prisma.
- Keep API routes responsible for request validation, authorization boundaries when present, orchestration and persistence—not duplicated domain rules.
- Treat custody (where an asset is) and reservations (where it is planned to be) as separate concepts.
- Keep job readiness explainable by component. Do not replace the component model with an opaque score.
- Keep field documentation informational unless there is a defensible operational reason for it to become a readiness gate.
- Do not add accounting, estimating, RFIs, submittals or document-management features merely to increase feature count.

## Data-model changes

Until committed migration history is introduced, schema changes must be verified against a fresh database in CI. The intended next maturity step is to move from `prisma db push` to committed Prisma migrations and `prisma migrate deploy`.

## Testing expectations

Every domain-rule change should include a focused regression case. High-risk mutations should also receive API/integration coverage where practical, particularly:

- worker assignment and certification gates;
- overlapping crew/equipment bookings;
- permit and inspection blocking;
- equipment defects and work-order creation;
- maintenance completion;
- readiness roll-up behavior.

## Commit quality

Use concise imperative commit messages that describe the change, for example:

```text
Prevent overlapping equipment reservations
Add permit failure integration coverage
Clarify demo authorization boundary
```

Do not add generated marketing copy, unnecessary badges, vanity metrics or unrelated framework churn.
