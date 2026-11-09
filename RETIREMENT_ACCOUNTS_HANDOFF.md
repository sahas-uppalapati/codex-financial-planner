# Retirement accounts implementation handoff

PR #2 was merged, and PR #6 subsequently added employer-match features. `RETIREMENT_ACCOUNTS_PLAN.md` is **not fully implemented**; use the remaining work below as a continuation checklist.

## Implemented in this branch

- Added owner-specific starting balances for traditional/Roth 401(k), traditional/Roth IRA, HSA, SEP IRA, and SIMPLE IRA. Existing saved balances migrate to typed entries, and the original v1/v2 saves remain intact.
- Added the 2026 retirement-limit snapshot and source metadata, age-confirmed workplace and IRA catch-up rules, direct Roth IRA phaseouts, and workplace-plan coverage inputs for traditional IRA deduction estimates.
- Added traditional/Roth 401(k) target mode (percent or annual dollars), a contribution split, payroll cash caps, annual employee limits, simple/tiered employer match formulas, and account-level projections.
- Added traditional IRA, direct Roth IRA, backdoor Roth, and mega backdoor targets with confirmation controls. The projection estimates eligibility and funding, limits funding to modeled cash/savings, applies funded traditional IRA deductions to taxes, tracks conversion flows, and exports the flows and account balances.
- Added HSA age-55 catch-up and an optional Medicare enrollment month that stops modeled HSA contributions after the selected month for age-eligible users.
- Added an account guide, account-level results, and CSV columns for starting balances and modeled contribution flows.
- Added match presets, contribution-target buttons, match diagnostics, vesting schedules, unvested and forfeited match tracking, and role-specific match formulas in PR #6.
- Added independent spouse matching for a single employer, owner-specific estimated mega-backdoor capacity, monthly contribution funding, and Medicare timing and HSA catch-up fixes.

## Known gaps before this can be called complete

- Employer match formulas can change with a role; spouse matching assumes one employer from projection start. Other plan settings need independent employment-period support, eligible-pay basis controls, employer dollar overrides and nonelective contributions, true-up behavior, and departure eligibility.
- Vesting tracks match and its modeled earnings, excludes unvested match from owned balances, and forfeits unvested amounts on departure. Pre-projection service dates are not modeled.
- Polish tier editing and add preview/apply controls for “contribute enough for full match” and “maximize annual contributions.” Existing buttons apply targets immediately.
- Add explicit plan confirmation for Roth 401(k) availability and enforce required Roth catch-up behavior when the sponsoring employer’s prior-year FICA wages cross the applicable threshold. The current Roth catch-up estimate uses the profile’s initial wages and modeled wages only while the initial employer remains active; it is not a complete employer-by-employer payroll model.
- IRA funding is limited to monthly cash after expenses and conservative baseline tax reserves; actual funded deductions drive final taxes. Unfunded monthly targets are not carried forward and tax savings are not reallocated. Add route-level requested/funded/unfunded reporting and consider a reconciled funding approach that avoids over-reserving tax on equity vests. Eligibility is an estimate from modeled wages and payroll deductions; other income and tax adjustments are not represented.
- Mega backdoor room is an estimate from the current employer’s modeled compensation, employee deferrals, and match. Add complete plan-level annual-additions treatment across employers and confirmed route constraints.
- Add the full guide distinctions and official links for 403(b), governmental/non-governmental 457(b), TSP, Solo 401(k), SEP/SIMPLE, pensions, spousal and rollover IRAs, plus source-year metadata in the guide itself.
- Finish HSA shared family-limit/catch-up edge cases and tests, including Medicare timing and owner-specific allocation.
- Complete the plan’s calculation test matrix, Playwright desktop/mobile checks down to 320px, keyboard/accessibility review, migration reload checks, and task-based usability sessions.

## Historical validation at original handoff

- `npm test`: 147 tests passed.
- `npm run build`: passed.
- No Playwright run or usability session was recorded for the original retirement slice. Later changes require fresh verification.

## Recent commits

- `756f35e` Model retirement accounts and verified contribution limits
- `2cdbb34` Fund IRA and Roth conversion targets in projections
- `ed2b227` Enforce shared traditional and Roth IRA limits

Earlier commits on this branch add the account guide, match estimates, spouse balances, and the 2026 rules snapshot.
