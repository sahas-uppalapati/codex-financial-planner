# Retirement accounts implementation handoff

This branch contains a substantial implementation slice of `RETIREMENT_ACCOUNTS_PLAN.md`. The plan is **not fully implemented**. Keep PR #2 in draft and use the remaining work below as the continuation checklist.

## Implemented in this branch

- Added owner-specific starting balances for traditional/Roth 401(k), traditional/Roth IRA, HSA, SEP IRA, and SIMPLE IRA. Existing saved balances migrate to typed entries, and the original v1/v2 saves remain intact.
- Added the 2026 retirement-limit snapshot and source metadata, age-confirmed workplace and IRA catch-up rules, direct Roth IRA phaseouts, and workplace-plan coverage inputs for traditional IRA deduction estimates.
- Added traditional/Roth 401(k) target mode (percent or annual dollars), a contribution split, payroll cash caps, annual employee limits, simple/tiered employer match formulas, and account-level projections.
- Added traditional IRA, direct Roth IRA, backdoor Roth, and mega backdoor targets with confirmation controls. The projection estimates eligibility and funding, limits funding to modeled cash/savings, applies funded traditional IRA deductions to taxes, tracks conversion flows, and exports the flows and account balances.
- Added HSA age-55 catch-up and an optional Medicare enrollment month that stops modeled HSA contributions after the selected month for age-eligible users.
- Added an account guide, account-level results, and CSV columns for starting balances and modeled contribution flows.

## Known gaps before this can be called complete

- Employer plan settings are still scenario-level and initial-employer-only. Add independent settings by employment period and for the spouse, eligible-pay basis controls, employer dollar overrides and nonelective contributions, true-up behavior, and departure eligibility.
- Employer match vesting schedules, service start dates, unvested balances/earnings, forfeitures, and vested-only asset totals are not implemented.
- Add match presets, tier editing polish, captured-match diagnostics, and preview/apply controls for “contribute enough for full match” and “maximize annual contributions.”
- Add explicit plan confirmation for Roth 401(k) availability and enforce required Roth catch-up behavior when the sponsoring employer’s prior-year FICA wages cross the applicable threshold. The current Roth catch-up estimate uses the profile’s initial wages and modeled wages only while the initial employer remains active; it is not a complete employer-by-employer payroll model.
- Refine IRA contribution funding so monthly cash availability, taxes, deductions, and route-level requested/funded/unfunded amounts reconcile exactly. Eligibility is an estimate from modeled wages and payroll deductions; other income and tax adjustments are not represented.
- Mega backdoor room is an estimate from the current employer’s modeled compensation, employee deferrals, and match. Add complete plan-level annual-additions treatment across employers and confirmed route constraints.
- Add the full guide distinctions and official links for 403(b), governmental/non-governmental 457(b), TSP, Solo 401(k), SEP/SIMPLE, pensions, spousal and rollover IRAs, plus source-year metadata in the guide itself.
- Finish HSA shared family-limit/catch-up edge cases and tests, including Medicare timing and owner-specific allocation.
- Complete the plan’s calculation test matrix, Playwright desktop/mobile checks down to 320px, keyboard/accessibility review, migration reload checks, and task-based usability sessions.

## Validation at handoff

- `npm test`: 147 tests passed.
- `npm run build`: passed.
- No Playwright run or usability session has been completed for this branch.

## Recent commits

- `756f35e` Model retirement accounts and verified contribution limits
- `2cdbb34` Fund IRA and Roth conversion targets in projections
- `ed2b227` Enforce shared traditional and Roth IRA limits

Earlier commits on this branch add the account guide, match estimates, spouse balances, and the 2026 rules snapshot.
