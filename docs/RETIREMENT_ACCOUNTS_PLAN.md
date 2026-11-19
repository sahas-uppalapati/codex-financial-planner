# CareerWorth: retirement accounts, employer matching, and starting balances

Updated: October 27, 2026  
Project: `/home/sahas_u/projects/startups/codex-financial-planner`  
Status: Implementation plan; application changes are not included in this document.

## Summary and confirmed choices

Help users understand which retirement accounts they can use and see how contributions affect available cash, taxes, and projected assets. Keep explanations brief, link to authoritative sources, and reveal complex controls only when relevant.

- Model traditional/Roth 401(k), traditional/Roth IRA, simple backdoor Roth IRA, mega backdoor Roth, and HSA contributions. Explain other retirement plans without modeling new contributions to them.
- Suggest an editable savings priority order; users still choose contribution amounts.
- Use employer match formulas as the default. This replaces the earlier proposal to require an annual employer contribution amount. Keep a dollar override as an advanced alternative.
- Include owner-specific starting balances so people who have already started their careers can project from their actual assets.
- Include age-based contribution limits and catch-ups.
- Allow IRA contributions to use existing taxable savings. Never automatically draw from retirement accounts or liquidate held employer shares.
- Preserve the existing browser-only React/TypeScript calculator, local saving, two-scenario comparison, visual design, tax locations, and career/equity features. Re-read current code before implementation because another task has been changing the project.

## 1. Simple calculator experience

### Starting balances

Place a clearly labeled **Starting balances** section near the beginning of the calculator, outside the advanced assumptions accordion. Show taxable savings/investments and the starting-assets total immediately; provide an **Add account balance** control for retirement accounts.

Support traditional 401(k), Roth 401(k), traditional/rollover IRA, Roth IRA, HSA, and separate balance-only SEP/SIMPLE IRA entries. Record retirement accounts by owner, with optional spouse fields. Multiple accounts of the same owner/type can be combined; explain that users should include old employer accounts too.

Starting assets are shared across scenarios. Keep existing employer-share quantities and cost basis in their issuer editor, with a direct link from Starting balances; do not add a second input representing the same shares. Show starting holdings at time zero and include each balance once in results and CSV exports. Existing balances grow even if all new contributions are zero. Enter owned/vested balances; unvested employer contributions are not starting assets in this version.

### Your 401(k)

Use percentage of eligible pay as the default employee contribution input, with an annual-dollar alternative. Show the equivalent estimated dollars per month and year. Offer Traditional, Roth, or a split; split inputs must add to the employee's total contribution target.

For employer matching, use a plain-language formula builder:

> My employer matches **50%** of my contributions on the first **6%** of eligible pay.

Make the two percentages visibly distinct: the match rate is not the maximum percentage of pay paid by the employer. Show an example and the calculated maximum employer contribution immediately. At $100,000 of eligible annual pay, contributing 6% under this formula means $6,000 from the employee and $3,000 from the employer, before other limits.

Offer **Simple match**, **Tiered match**, **No match**, and **Unsure**. Unsure adds no assumed match and displays a link explaining where to find the plan's formula. Do not preselect a company's policy based on its name.

Provide editable example presets, explicitly labeled examples:

- 100% of contributions on the first 4% of eligible pay.
- 50% of contributions on the first 6% of eligible pay.
- 100% on the first 3%, then 50% on the next 2%.

Tier rows use consecutive, non-overlapping bands expressed as **first** and **next** percentages of pay. Permit additional tiers. Optional employer dollar caps apply to the whole formula, not independently to every tier.

Show **You contribute / Employer contributes / Available match not captured**. Provide **Contribute enough for the full match** and **Maximize annual contributions** buttons. Preview the calculated change before applying it; use actual annual limits and available pay. If the full theoretical match cannot be captured, explain why instead of promising it.

### Advanced employer settings

Keep these collapsed:

- Eligible pay: default base salary only, visibly disclosed; toggles add cash bonus or vested equity where the user's plan includes them. The same selected compensation basis drives percentage-based employee targets and matching; dollar targets remain independent.
- Optional annual dollar cap on employer matching.
- Calculation basis: monthly/paycheck approximation by default; confirmed annual true-up as an option. Unsure does not grant an assumed true-up. Explain that the model does not reproduce exact payroll dates.
- True-up eligibility after departure: default excluded unless the user confirms eligibility. Credit estimated eligible true-ups in December and disclose that actual payment dates may differ.
- Vesting: immediate by default, labeled an assumption; allow cliff or graded service-year schedules. Collect employment start month for service calculations, including service before the projection. Track unvested contributions separately, vest applicable earnings consistently, and forfeit unvested amounts at departure. Only vested amounts enter the owned-assets headline.
- An annual employer-dollar override replaces formula matching rather than adding to it. Separate nonelective employer contributions are optional and explicitly additive. Treat both as annualized targets prorated over active months.

Store plan settings by employment period; promotions retain the existing plan, employer changes require their own settings, and employee annual limits do not reset after changing jobs. Support independent spouse plan settings. Default employer contributions to traditional 401(k); Roth employer contributions are outside this version.

### Guidance and progressive disclosure

Keep the common path to starting balances, employee contribution, employer match, and a useful result. Users can add IRA/HSA inputs or open backdoor details when needed. Do not require completion of every account editor.

Provide an editable advisory priority order: capture employer match, consider an eligible HSA, compare IRA and workplace options, use remaining workplace capacity, consider mega backdoor funding, then taxable investing. Explain that this assumes the user has addressed immediate cash needs; do not present it as universally optimal. Reordering suggestions never silently changes amounts or transfers money. Explain Roth versus traditional in terms of current and future tax rates rather than choosing a universal winner.

## 2. Brief account guide with source links

Add **Which retirement accounts can I use?** below results and link to relevant entries from account inputs. Keep the guide accessible even when invalid inputs pause projections. Each entry has a short explanation, who can use it, tax treatment, a key caveat, an applicable limit or a limit-source link, and **Learn more**. Label entries **Modeled here** or **Learn about this account**.

| Account or strategy | Brief explanation and required distinction |
| --- | --- |
| Traditional 401(k) | Workplace contributions generally reduce current income tax; withdrawals are generally taxable. |
| Roth 401(k) | Contributions are taxed today; qualified withdrawals are tax-free. Shares the employee deferral limit with traditional 401(k). |
| Traditional IRA | Personal retirement account; deductibility depends on income and workplace-plan coverage. Nondeductible contributions require basis records. |
| Roth IRA | Personal retirement account with qualified tax-free withdrawals; direct contributions have income restrictions. |
| Backdoor Roth IRA | Nondeductible traditional IRA contribution followed by conversion; existing IRA balances can make part taxable. A strategy, not a separate account or extra IRA allowance. |
| Mega backdoor Roth | Additional after-tax workplace contributions moved to Roth when the plan permits it. Different from ordinary Roth 401(k) deferrals. |
| Rollover and spousal IRAs | Explain rollover funding and joint-filing compensation rules; neither creates an additional per-person IRA allowance. |
| 403(b), governmental 457(b), and TSP | Options for eligible nonprofit/public-sector/federal employees. Give separate entries; distinguish nongovernmental 457(b) risks and rules. |
| Solo 401(k), SEP IRA, and SIMPLE IRA | Options for eligible self-employed workers, business owners, and small-business employees; give separate entries. |
| Pensions and cash-balance plans | Employer plans with benefits determined by plan formulas. |
| HSA | Health savings account that can complement retirement saving; eligibility and medical-expense rules apply. |
| Taxable brokerage | Flexible investing outside retirement accounts; no retirement-account contribution cap or equivalent tax advantages. |

Use direct official links rather than search-result links. Store source title, URL, applicable year, and verification date with content. Prefer qualitative explanations for guide-only plans instead of adding many annual figures that need maintenance. Cover catch-ups, withdrawal restrictions, and qualified-distribution conditions briefly, linking to details.

## 3. Contributions, eligibility, and calculation rules

### Account and strategy modeling

Add owner-specific annual targets for traditional/Roth 401(k), traditional/Roth IRA, backdoor Roth IRA, and mega backdoor Roth; retain HSA targets. Percentage-based 401(k) targets change with eligible compensation; annual-dollar targets remain fixed unless edited. New contributions occur monthly at month-end, consistent with the current engine.

The simple IRA backdoor supports immediate conversion of new nondeductible contributions before earnings accrue. Require that owner's aggregate traditional/rollover/SEP/SIMPLE IRA balance to be zero, including accounts outside the calculator, and no concurrent retained traditional IRA contributions. Existing balances or other transactions require a clear unsupported-case explanation; never assume a tax-free conversion. Check each owner separately. Display Form 8606 reporting guidance.

Mega backdoor requires confirmed after-tax contribution support and an allowed conversion route. Support immediate in-plan Roth 401(k) conversion or immediate Roth IRA rollover, selected by the user. Delayed conversion earnings, preexisting after-tax balances, and arbitrary existing-balance conversions are outside this version. Assume mega backdoor contributions do not receive employer matching; disclose this simplifying assumption.

Conversions are transfers and never count as new wealth a second time. Mega backdoor rollovers do not consume the personal IRA contribution limit; IRA backdoor contributions do. Ordinary Roth 401(k) deferrals share the employee limit with pretax deferrals.

### Ages and limits

Collect each person's age at the end of the first projection year and advance annually. Use an illustrative default of 35; require confirmation before enabling age-dependent contributions. Apply age-50 catch-ups, the age-60–63 workplace rules when supported by the plan, and applicable Roth catch-up requirements.

Request initial prior-year FICA wages from the sponsoring employer when needed. Derive later prior-year wages by employer from modeled compensation and qualifying payroll exclusions; do not use the Social Security wage cap as the prior-year wage amount. Do not use unrelated employers' wages to trigger the requirement. New employment does not invent prior-year wages. If required Roth catch-up is unavailable, limit contributions and explain the unmet target.

Apply combined employee-deferral limits across employers per person; apply total annual additions and compensation limits by employer/plan, including employer contributions and after-tax contributions. Treat catch-ups separately where the rules require. Calculate match from actual qualifying deferrals, including traditional and Roth, and reduce mega backdoor room for the employer contributions. Preserve room for any eligible annual true-up; do not let after-tax contributions crowd out a promised match. Enforce lower plan-specific caps where entered.

Apply the shared traditional/Roth IRA contribution limit, taxable-compensation requirements, spousal IRA rules, direct Roth phaseouts, and traditional IRA deduction phaseouts. Ask about workplace-plan coverage rather than inferring it solely from employee contributions. Use the modeled W-2 income and applicable payroll deductions for eligibility, with a clear limitation that other income and adjustments are not modeled.

Apply eligible HSA age-55 catch-ups by owner, with the shared household base limit. Collect an optional Medicare enrollment month and stop contributions when eligibility ends. Retain the full-year coverage assumption otherwise and disclose that part-year coverage calculations are outside this version.

Keep a verified 2026 rules snapshot and source metadata. Future indexed amounts use the calculator's existing editable inflation assumption and are labeled projections, not enacted future limits. Fixed statutory amounts stay fixed.

### Cash flow and taxes

Payroll contributions remain limited by available wages. IRA contributions may use positive cash flow and existing taxable investments. Fund required living expenses and payroll deductions before optional IRA transfers; never borrow implicitly to fund an IRA. If funds are insufficient, fund the primary owner first, then spouse, proportionally across each owner's requested IRA routes. Show requested, funded, and unfunded contributions.

Reconcile annual taxes using actual funded IRA amounts, not requested deductions. Deductible IRA contributions affect income taxes without reducing payroll taxes; Roth and nondeductible contributions receive no deduction. Preserve federal/state/local differences, including state IRA treatment and existing HSA nonconformity. Do not reuse payroll 401(k) deductions as an IRA-deduction shortcut.

The existing annual equity-tax attribution must include any IRA eligibility/deduction changes caused by vesting. Annual tax allocation, contribution funding, and eligibility calculations must agree on the same actual funded contributions rather than granting inconsistent deductions.

In manual-tax mode, retain the effective-rate approach and clearly label IRA tax effects and modeled-income eligibility as estimates. Do not claim an exact marginal-tax comparison from a manual effective rate.

For unfunded living costs, preserve the calculator's explicit shortfall behavior; IRA contributions stop before they would increase that shortfall. Do not automatically sell employer stock or withdraw retirement/HSA assets. Applying the common return assumption to starting balances and new contributions must never duplicate transfers or employer contributions.

## 4. Results, interfaces, persistence, and scope

- Show account balances separately, plus traditional versus Roth totals, employee contributions, employer contributions, vested/unvested employer amounts, IRA deductions, conversions, unused capacity, and funding shortfalls. All owned-assets totals are before future withdrawal/sale taxes.
- Extend annual/monthly tables and CSV exports with account-level flows and balances, including a time-zero starting row. Distinguish contribution targets from actual funded amounts.
- Add typed owner retirement profiles, starting balances, contribution targets, employment-plan settings, tiered match formulas, vesting settings, and sourced rule metadata. Keep account/conversion calculations in pure modules separate from the UI.
- Extend tax inputs for deductible IRA amounts and projection outputs for balances, contribution funding, employer matching, vesting, and transfers. Calculate a single consistent result consumed by summary cards, tables, chart, and exports.
- Migrate to a new saved-state version. Preserve existing taxable, traditional 401(k), HSA, employer-share balances, and contribution targets; initialize new accounts/targets to zero. Keep existing annual-dollar 401(k) contributions in dollar mode. Preserve original saves. New settings must not silently add a match or invent an employer history.
- Existing shared retirement/HSA balances have no owner metadata: retain the total and initially assign them to the primary owner with a migration note allowing reassignment. Ownership changes do not create new assets. Starting spouse assets remain part of the same household starting-assets total even if a scenario changes filing status; spouse contribution/tax controls apply only to joint scenarios.
- Default new employer match settings to Unsure, counting zero match. Roth/after-tax/conversion features must be confirmed before enabling dependent contributions. Keep starting balances independent of present employer eligibility.
- Do not add a backend, live scraping, account linking, analytics, or a deployment as part of this change. Keep browser-local persistence.
- Guide-only contributions include 403(b), 457(b), TSP, Solo 401(k), SEP, SIMPLE, and pensions. General Roth conversions, retirement withdrawals, RMDs, Social Security income, and withdrawal-tax optimization remain outside this accumulation model. Age inputs govern contribution limits; senior-specific income-tax deductions are not added here and that limitation must be visible.

## 5. Verification and acceptance criteria

### Calculation tests

- A 50%-up-to-6% match produces $3,000 for $100,000 eligible pay and $6,000 employee contributions; test below/above the match threshold too.
- A 100%-first-3%, 50%-next-2% formula produces $4,000 at a 5% employee contribution on $100,000 eligible pay. Cover tier boundaries, optional dollar caps, and zero match.
- Cover compensation caps, included/excluded bonuses and equity, traditional/Roth splits, cash-pay constraints, annual employee limits across job changes, separate employer annual-additions caps, and employer contributions reducing mega backdoor capacity.
- Contrast monthly matching with confirmed true-up, including early max-out and departure eligibility. Cover vesting service before projection start, vesting transitions, associated earnings, forfeiture, and owned-assets totals.
- Cover IRA shared limits, income-phaseout boundaries, spousal compensation, workplace coverage, nondeductible basis reporting, and existing IRA balances blocking unsupported backdoor cases.
- Cover age transitions at 50, 55, 60, and 64; prior-year employer wages and Roth catch-ups; HSA Medicare cutoff.
- Test starting-balance growth with zero new contributions, exact conservation for transfers at zero return, no double-counted employer contributions, taxable-funding depletion, and deductions based on funded contributions.
- Cover spouse ownership, both scenarios, manual/calculated tax modes, and state/local treatment. Use independently calculated fixtures for tax-sensitive cases.

### Browser and usability checks

- A user can enter existing balances, select a common match formula, and understand employee/employer annual amounts without opening advanced settings.
- A user can distinguish “50% match on the first 6%” from a 6% employer contribution, configure a tiered formula, and identify uncaptured matching.
- A user can preview/apply full-match and annual-limit buttons without an unexplained change to other inputs.
- A user can locate concise IRA/backdoor explanations and open the exact official source. Invalid calculator inputs do not hide the guide.
- Verify migration/reload, original-save preservation, comparison, invalid input handling, unfunded targets, CSV consistency, keyboard operation, accessible labels, and responsive layouts from 320px upward.
- Use brief task-based usability sessions to assess clarity; do not claim “easiest calculator” without comparative evidence. Browser automation validates flows but does not substitute for observed usability.
- Run relevant Vitest tests, Playwright desktop/mobile checks, and the production build. Report unrelated existing failures separately and avoid overwriting concurrent project changes.

## Source references

Research checked October 27, 2026. Official tax-year values take precedence over older examples in explanatory pages. Recheck the applicable rules during implementation.

- [IRS: retirement-plan types](https://www.irs.gov/retirement-plans/plan-sponsor/types-of-retirement-plans)
- [IRS: 2026 retirement and IRA limits, Notice 2025-67](https://www.irs.gov/pub/irs-drop/n-25-67.pdf)
- [IRS: IRA contributions, Publication 590-A](https://www.irs.gov/publications/p590a)
- [IRS: Form 8606 instructions and IRA conversion/basis reporting](https://www.irs.gov/instructions/i8606)
- [IRS: after-tax workplace contribution rollovers](https://www.irs.gov/retirement-plans/rollovers-of-after-tax-contributions-in-retirement-plans)
- [IRS: catch-up contributions](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-catch-up-contributions)
- [IRS: Roth catch-up regulations and employer-wage rules](https://www.irs.gov/irb/2025-40_IRB)
- [IRS: designated Roth accounts](https://www.irs.gov/retirement-plans/retirement-plans-faqs-on-designated-roth-accounts)
- [IRS: matching formulas and compensation caps](https://www.irs.gov/retirement-plans/401k-plans-deferrals-and-matching-when-compensation-exceeds-the-annual-limit)
- [IRS: operating a 401(k) plan and tiered-match examples](https://www.irs.gov/retirement-plans/operating-a-401k-plan)
- [IRS: employer-contribution vesting](https://www.irs.gov/retirement-plans/issue-snapshot-vesting-schedules-for-matching-contributions)
- [IRS: HSA eligibility and catch-ups, Publication 969](https://www.irs.gov/publications/p969)
- [Investor.gov: IRAs](https://www.investor.gov/introduction-investing/investing-basics/investment-accounts/tax-advantaged-accounts/retirement-savings/individual-retirement-accounts-iras)
- [Investor.gov: 403(b) and 457(b) plans](https://www.investor.gov/introduction-investing/investing-basics/investment-accounts/tax-advantaged-accounts/retirement-savings/403b-and-457b-plans)
- [Fidelity: plain-language match examples and true-ups](https://www.fidelity.com/learning-center/smart-money/average-401k-match)
- [Calculator.net: existing contribution, balance, and match input patterns](https://www.calculator.net/401k-calculator.html)
- [NerdWallet: retirement calculator reference](https://www.nerdwallet.com/retirement/calculators/401k-calculator)

For guide entries beyond these overview pages, link to the specific plan's official page reached from the IRS directory; TSP content should use official TSP documentation. Competitor references inform interface research, not tax-rule implementation.
