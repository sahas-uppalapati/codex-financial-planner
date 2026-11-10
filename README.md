# CareerWorth

A browser-only career and compensation planner built with React, TypeScript, Vite, plain CSS, and a custom SVG chart. Compare two scenarios with calculated taxes, actual RSU grant schedules, promotions, employer changes, benefits, and separate investment accounts. The planner has no backend or accounts. Optional PostHog analytics records a small set of anonymous actions only after the visitor opts in; planner values are not included.

## Run and verify

Use Node.js 22.12+ or Node 24 LTS and npm from this project folder:

```bash
npm ci
npm run dev -- --port 5180
npm test
npm run build
npm run preview
```

Open [http://localhost:5180](http://localhost:5180). On WSL use the Linux Node/npm installation (`nvm use 24`), not Windows npm. The development server binds to `0.0.0.0` for WSL localhost forwarding. Dependencies are pinned and a lockfile is included.

## Optional analytics

Create a PostHog project, then set `VITE_POSTHOG_KEY` and (optionally) `VITE_POSTHOG_HOST` in `.env.local` or deployment settings. `VITE_POSTHOG_HOST` defaults to `https://us.i.posthog.com`; use your project's region host if it differs. These are public browser settings, not secrets. Restart Vite after changing them.

Analytics are off until a visitor opts in using the control in the footer. Only action names and fixed labels are sent. Autocapture, exception capture, pageviews, session replay, surveys, feature flags, IP processing, and person profiles are disabled; event persistence stays in memory. URL query strings and fragments are stripped before events are sent because shared estimate links can contain planner values. Do not add planner values, names, URLs, or other user-entered data to analytics events.

The deployed site includes privacy, use and copyright, and accessibility notices under `public/`. Keep them aligned with actual storage, analytics, hosting, and product behavior. The accessibility notice sets WCAG 2.2 AA as a target and does not claim verified conformance.
## CI and deployment

GitHub Actions runs `npm ci`, the unit and browser test suites, and the production build for every pull request and every push to `master`. It installs Chromium for the Playwright desktop and mobile browser projects. To make CI a merge gate, require the **CI / verify** check in the repository's branch protection or ruleset settings.

Connect this GitHub repository to Vercel and set `master` as the production branch. Vercel then builds pull requests as Preview deployments and deploys pushes to `master` to Production. The Vercel Git integration handles deployment; no Vercel token or project secrets are needed in GitHub Actions.

Browser tests:

```bash
npx playwright install --with-deps chromium
npm run test:e2e
```

The suite runs Chromium at desktop and mobile sizes and covers taxes, editing, comparisons, independent budget/tax locations, grant previews, custom vesting, sell/hold treatment, promotions, employer changes, benefits, shared HSA limits, migration, saved customization, storage failures, real CSV downloads, and responsive overflow. Screenshots and failure traces are under `test-results/` (ignored).

In this development session, browser binaries and missing Linux libraries were installed only under `/tmp`:

```bash
LD_LIBRARY_PATH=/tmp/careerworth-browser-libs/extracted/usr/lib/x86_64-linux-gnu \
PLAYWRIGHT_BROWSERS_PATH=/tmp/careerworth-browsers npm run test:e2e
```

## Using the planner

The planner opens in **Quick estimate** mode. Enter annual salary, monthly living costs, current taxable investments, and projection years to get an immediate monthly cash estimate and balance projection. Open **Customize assumptions** to edit salary growth (3% by default), annual investment return (5%), annual expense inflation (2.5%), tax location (Columbus, OH), filing status (single), and annual cash bonus. Choose a location-based tax estimate or enter your own total effective tax rate. You can also include simplified annual stock compensation, spouse wages for joint filers, starting 401(k)/HSA balances, and annual 401(k)/HSA contributions. These controls use the same calculation model as the detailed planner; annual stock compensation is treated as sold in December, and only the primary worker's benefits are modeled in this quick mode. The optional $100/month illustration assumes the extra savings are invested at the same return, before future taxes, and is not a guarantee. Tax calculations use 2026 law and do not predict future legislation.

Choose **Add more detail** to use the full planner. It retains the quick estimate inputs and reveals comparison scenarios, company presets, compensation, taxes, budgets, benefits, career progression, equity grants and account assumptions. Detailed result tables and tax/vesting breakdowns are also collapsed by default in Quick estimate mode and can be opened with **Explore detailed results**.

Starting taxable investments, primary-owner traditional 401(k), and HSA balances are entered in the visible **Starting balances** section and shared between scenarios. Optional spouse 401(k)/HSA balances are included in household assets even in a single-filing scenario. Existing retirement/HSA balances grow even if new contributions are zero. Existing saved balances are kept with the primary owner when spouse fields are added. Employer shares remain in the equity issuer editor and are counted once.

Advanced sections stay collapsed until needed:

- **Taxes:** calculated annual liability or a manual total effective rate; single or married filing jointly; spouse wages/growth; signed annual federal/state/local tax adjustments; employee-premium and exemption switches.
- **Pretax benefits:** traditional and Roth 401(k), quick formula presets, action buttons to capture full matches, configurable simple or tiered employer match formulas, customizable vesting schedules (immediate, cliff, graded, and custom percentage schedules), qualifying cafeteria-plan health premiums, and payroll HSA contributions. Match settings default to Unsure, which assumes zero; formulas apply to base salary and do not model payroll dates or true-ups.
- **Career progression:** promotions and employer changes by calendar month or months after projection start, expected role/level, base, bonus and growth, optional new equity award and future refresher policy.
- **Equity grants:** individual/historical grants in dollars plus grant-date price, or explicit shares; common/custom vesting schedules; recurring refresher rules; selling at vest or retaining shares after estimated tax coverage; employer price/appreciation assumptions and starting vested holdings.
- **Assumptions:** projection start year, investment return, expense inflation, tax-threshold inflation, and starting retirement/HSA balances.

Select a results year to inspect its monthly-equivalent cash picture, annual tax breakdown and monthly vesting detail. The main chart and account breakdown show the end of the whole projection. Annual and monthly CSV exports include both comparison scenarios and retain full numeric precision. CSV text is quoted and formula-like user text is neutralized.

## Monthly model

Projection years are full calendar years beginning January 1. Career changes take effect at the start of the selected month. Base salary grows on each role's anniversary; explicit new-role pay replaces that month's automatic raise. Bonus targets accrue proportionally for each active month and are paid in December. Joint-filing spouse wages are spread evenly across months and included in household results.

For each year, taxes are computed twice: on cash compensation alone, and on cash plus all vested RSUs. Their difference is the tax attributable to equity. Reconciled annual cash taxes are allocated across months by cash compensation, and incremental equity taxes across vests by vested value. These reserves are planning allocations, **not employer withholding predictions**.

The monthly investment rate is `(1 + annualReturn / 100)^(1/12) - 1`. Nonnegative opening taxable investments and nonnegative retirement/HSA assets earn the assumed return; contributions enter at month-end. A negative taxable balance is an unfunded cash shortfall and earns no return. Held shares and retirement accounts are not automatically sold to cover cash spending.

Benefits reduce cash once. Retirement and HSA contributions enter their respective asset accounts; health premiums are spending, not assets. Healthcare budget categories **include** payroll premiums, so premiums already deducted from cash income are removed once from budgeted healthcare expenses. Post-payroll healthcare expenses cannot go below zero. If premiums exceed the medical budget, a notice explains that all premiums still reduce take-home.

Annual benefit targets are spread over months and capped at available cash compensation and per-person/household legal limits. Job changes do not reset Social Security or contribution limits. Actual contributions may fall short of targets when cash wages are insufficient; results show actual funded amounts. Employer match estimates are added to the traditional 401(k) balance and are tracked alongside completed years of service under the active vesting schedule. Employer match progresses across career changes (with support for role-specific match formulas). Departing before match vesting is complete forfeits unvested match while employee deferrals remain 100% owned. Certain age-based contribution catch-ups are estimated when age and plan eligibility are confirmed; reimbursements and withdrawals are excluded.

IRA and modeled backdoor targets are spread evenly over the year and funded each month from taxable cash after expenses and conservative tax reserves, with the primary owner funded before the spouse. Unfunded monthly targets are not carried forward. Taxes are recalculated using funded deductible contributions; estimated tax savings remain in taxable cash. Equity funding reserves the full baseline liability in addition to cash tax reserves, so contributions may be understated when equity vests. Eligibility excludes other income and adjustments.

## Grant and career semantics

Vesting offset **1** means the end of the grant month, and offset **12** means the end of its 12th month. Schedules can contain 1–120 distinct month offsets and must total 100%. Templates are previewed before applying; choosing a selector alone does not overwrite a custom schedule.

Reported templates include even monthly/quarterly/semiannual/annual four-year vesting, a one-year cliff followed by monthly or quarterly vesting, historical Amazon 5/15/40/40, a reported 5/15/45/35 annual variant, and Google front-loaded variants. These are dated examples, not universal company policies. Review actual grant terms; alternatives can exist at the same company.

Dollar grants become fixed shares at an entered grant-date price or the employer's modeled price when awarded. Future dollar awards use that future modeled grant price. Employer appreciation is independent from diversified-investment returns and defaults to 0%; $100 is a modeling reference, not a live quote. Historical dollar grants require an entered actual grant-date price. Pre-projection vests are not added again: enter already-owned shares separately, with their cost basis.

All vested stock enters taxable wages even if held. Sell treatment invests proceeds after attributed equity taxes. Hold treatment sells enough shares to cover the estimated liability and tracks the remaining shares; appreciation and unrealized gains are counted once. Any tax exceeding a vest is settled through cash reserves. Unvested equity is never an owned asset.

Promotions retain old grants. Changing employers creates a new employment period and forfeits old unvested grants **before that month's end-of-month vests**, unless the grant is explicitly retained. Old vested holdings remain owned. Existing refresher awards continue on promotion; future role-policy awards stop at the next career event. Standalone refresher rules have explicit start/end months and a switch to stop at the first role change in that employment. Generated awards support individual departure exceptions.

## Tax coverage

Calculated mode models full-year W-2 employees who both live and work in one supported location throughout the projection: Columbus OH, Seattle WA, San Francisco CA, New York City NY, Austin TX, or Boston MA. It supports single and married-joint filing, no dependents and standard deductions without senior-specific tax provisions. Age-based contribution catch-ups are estimated separately. Joint scenarios include both workers' wages, taxes, benefits and savings; the default one-adult expense budget should be edited for the household.

Tax rules are bundled as version `US-W2-2026.1`, with official URLs and access dates in `src/data/taxRules.ts` and the Taxes editor. The model includes federal progressive income tax, per-person Social Security, Medicare and household Additional Medicare, applicable state/city income taxes, high-income surtaxes/recapture, basic personal/household credits, and disclosed employee leave/disability premiums. Traditional 401(k) and qualified payroll health/HSA contributions have distinct taxable bases. California's HSA nonconformity is included. See [TAX_SOURCES.md](TAX_SOURCES.md) for detailed rules and source caveats.

Future calculations project **2026 law** using the editable default 2.5% inflation assumption only for indexed parameters. Fixed thresholds, including Additional Medicare, NY brackets and the CA $1 million surtax threshold, remain fixed. This does not predict or incorporate subsequent legislation. California's exemption-credit phaseout starting values are derived from the announced 2026 indexing pending publication of the complete booklet. NY/NYC use continuous rate schedules rather than $50 tax-table intervals, so return-table rounding can differ.

Signed tax adjustments modify final liability, not taxable income. Component liability is floored at zero; refundable credits are not paid out. The model excludes itemized deductions, family/earned-income credits, self-employment, foreign income, part-year/multistate allocations, investment income/dividends and realized capital gains. Returns represent assumed unrealized appreciation. Held shares are not sold later in the model; totals are **before future liquidation or withdrawal taxes** and are not a complete tax return or net worth.

## Saving, migration and input limits

Use **Back up your plan** to download a private, versioned JSON backup or validate and restore one in another browser. A restore replaces the current plan only after confirmation. CSV files contain results and cannot restore inputs. The address bar contains the current valid plan and view, including both scenarios and detailed settings; copy it or use **Copy plan link** to share. Opening a full plan link loads and saves it in that browser. Anyone with the URL can read the inputs, and URLs can appear in browser history, server logs, and referrer information. Invalid drafts remove the plan from the address until corrected. Older partial estimate links still require confirmation and use defaults for omitted values. See [MCP.md](MCP.md) for the optional local agent interface.

Valid v2 inputs are saved locally under `careerworth:v2`. Existing v1 inputs migrate with their manual tax rates and repeating stock amounts intact. No grant is fabricated. A clearly labeled conversion previews a four-year award assumption before replacing legacy annual stock. The original `careerworth:v1` save is preserved. Monthly timing changes balances compared with the former annual model.

Invalid drafts suspend results and exports, preserving the last valid save. Malformed data falls back to defaults; storage failures do not disable calculations. Data stays on this browser, is not synchronized, and localStorage is not encrypted. Reset restores v2 defaults.

Numerical guardrails: 1–40 years starting 2026–2036; $0–$10 million salary/bonus/contribution/grant inputs; $0–$1 million total monthly spending; base growth −100% to 20%; investment return strictly above −100% to 30%; expense inflation 0–20%; tax-threshold inflation 0–10%; share appreciation −99.9% to 100%. Initial prices are $0.01–$1 million per share; explicit historical grant prices can be as low as $0.000001. Fractional shares are supported. Names are 1–100 characters. Up to 30 career events, 100 custom grants, 30 recurring rules and 1,000 generated/custom grants are supported per scenario. Every computed amount is checked for finite values.

## Code map

- `src/lib/planner.ts`: v2 inputs, dates, defaults and validation. `model.ts` retains v1 calculation/migration regression fixtures.
- `src/lib/tax.ts` and `src/data/taxRules.ts`: pure tax calculation and sourced rules.
- `src/lib/equity.ts` and `src/data/vesting.ts`: grant expansion, schedules, employment periods and forfeitures.
- `src/lib/projection.ts`: monthly compensation, reconciled tax reserves and asset accounting.
- `src/lib/plannerStorage.ts` / `plannerCsv.ts`: versioned persistence/migration and detailed exports.
- `src/components/`: labeled editors, source disclosures, SVG chart and result tables.
- `DATA_SOURCES.md`: existing compensation and six-county budget provenance.
