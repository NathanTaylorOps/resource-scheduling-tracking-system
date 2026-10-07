## What changed

<!-- Summarize the change in operational terms, not only implementation terms. -->

## Why it matters

<!-- What failure mode, user problem, reliability issue or maintainability concern does this address? -->

## Verification

- [ ] Lint passes
- [ ] Typecheck passes
- [ ] Domain tests pass
- [ ] Production build passes
- [ ] Demo template builds
- [ ] UI smoke/accessibility checks pass, when UI behavior changed

## Risk review

- [ ] No real client, employee, project, credential or pricing data was added
- [ ] Readiness logic remains explainable by component
- [ ] Plan-vs-fact distinctions (for example reservations vs custody) remain intact
- [ ] Schema changes include an appropriate migration strategy
- [ ] New mutation behavior considers duplicate/retried requests and concurrent writes

## Screenshots

<!-- Add before/after screenshots for visible UI changes. Remove this section when not applicable. -->
