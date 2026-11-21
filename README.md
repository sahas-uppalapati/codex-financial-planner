# CareerWorth

A browser-only career and compensation planner built with React, TypeScript, Vite, Tailwind CSS, selected shadcn/ui components, and a custom SVG chart. Compare two scenarios with calculated taxes, actual RSU grant schedules, promotions, employer changes, benefits, and separate investment accounts. The planner has no backend or accounts. Optional PostHog analytics records a small set of anonymous actions only after the visitor opts in; planner values are not included.

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

The planner’s advantage over a few prompts with the same inputs is repeatable, private calculations and side-by-side comparisons. Future user trials should compare whether those benefits help people make the same decision more reliably than an LLM using identical inputs.

Select **This is a startup offer** at the top of a scenario's inputs to illustrate a startup option grant alongside the other planner scenario. Enter the option count, strike price, and vesting to calculate a per-share break-even even when ownership is unknown. An optional current 409A common-share value shows the full-grant paper spread; a preferred-share price is not used to value options. Optionally enter a future common-share price, or ownership, dilution, and an exit value available to common shareholders, to illustrate proceeds. The illustration compares pre-tax option proceeds and modeled gross compensation over the projection period, and estimates the common-share exit value needed to close a compensation gap. It assumes continued employment, even monthly vesting over four, five, or a custom number of months, with an optional cliff, and no other claims on the entered common-share value. It excludes taxes, fees, option expiry, future grants, employer match and other benefits, time value of money, and probabilities; it is not a forecast. Startup inputs are saved separately in local browser storage and included in backups and explicit share links; they remain excluded from CSV exports and planner balances. Set the startup scenario's public stock and RSU grants to zero if they represent the same option grant.

While startup mode is selected, Big Tech preset grants and preset-generated promotions are excluded from that scenario's projection and the preset controls are hidden. The original scenario data is preserved. Other grants remain included, and salary, bonus, match, and other assumptions can still reflect the previous preset; review them for the startup offer.

The startup inputs include fictional Series A, B, and C examples. Salary inputs use [Cadre's 2020–2026 placement medians](https://www.yourcadre.com/comp); all option counts and prices are invented and are not stage benchmarks. Applying an example assumes no bonus, raises, relocation, or employer match, and four-year monthly vesting with a one-year cliff. It leaves location, living expenses, and existing grants and career events intact. These are illustrations, not actual offers.

New visitors can enter an offer or explore an example. Existing saved plans open directly. Optional **Company presets** use static public software-engineer averages for Google, Meta, Amazon, Apple, and Microsoft; the preset links to its source and the snapshot date is documented under **About these estimates**. Google first-year stock and combined bonus/sign-on figures are excluded from recurring projections. The quick estimator uses 2026 county-specific MIT minimum-needs cost data. Changing a preset preserves customized values, and a full replacement requires a preview and confirmation. Balances are before future sale or withdrawal taxes. Monthly figures are annual averages; bonuses and stock may arrive unevenly.

At 1200px and above the workspace uses a navigation rail, an inputs panel, and a results pane. From 960–1199px the navigation moves above the two panes. Below 960px the panes stack and the workspace navigation stays within reach. Use **Inputs** or **View results** to move between them. **Calculators** opens at its mode picker. Wide tables scroll inside their own panels.

Starting balances and assumptions are in the inputs panel and apply to both offers. To review every year, open **Annual Schedule** and switch between **Summary** and **Full detail**. The **Results year** control applies to Overview, Cash Flow, and Taxes. Resetting the plan or copying Scenario A over Scenario B requires confirmation.

A decision summary compares selected-year cash after costs separately from sold-stock proceeds and compares ending balances. **Explore what-ifs** runs an isolated preview, and the salary-gap calculator estimates the starting base salary needed to match the other offer’s selected-year cash surplus. Later career-event salaries stay unchanged; these estimates are not automatically applied.

The four result destinations share the inspected calendar year:

- **Overview:** a monthly money picture showing take-home pay, cash from shares sold, living costs, other savings, and money left over; a portfolio projection chart separating the starting balance and contributions, cash shortfalls, and investment growth; ending accounts, comparison insights, and separate hypothetical startup outcomes.
- **Cash Flow:** monthly-equivalent compensation, annual income-to-cash breakdown, monthly cash flows and vesting, and the existing equity vesting summary.
- **Taxes:** estimated annual liability and its components, including equity-attributed taxes.
- **Annual Schedule:** the full year-by-year projection, with summary and detailed column choices.

Annual and monthly CSV actions are grouped in one results toolbar. **Light / Dark / System** appearance defaults to System, follows system changes, and is stored under `careerworth:theme` separately from financial inputs. If storage is unavailable, calculations and theme selection continue in memory. Backups, shared links, model explanations, retirement guidance, reset, and analytics consent remain available. Backups are validated before a themed restore confirmation; canceling leaves the current plan intact.

The visual direction follows [Capitalio](https://ui.watermelon.sh/dashboard/capitalio-dashboard): self-hosted Inter, neutral surfaces, fine borders, compact controls, blue actions, and restrained green/blue chart accents. Only the used shadcn primitives (Button, Card, Input, Dialog, Select) are included; their MIT notice is in `src/components/ui/LICENSE.shadcn.md` and the deployed `/licenses/` directory, alongside the Radix Select, Inter, and Lucide licenses. The complete Capitalio registry block and its assets are not installed. Theme tokens cover the advanced editors, startup illustration, comparisons, tables, dialogs, and invalid-input states. Print uses light surfaces, and the annual table omits its intermediate detail columns to fit the page.

Current taxable investments remain prominent. Expand **Starting balances & assumptions** to add retirement and HSA account balances, with an account type and owner; starting balances are shared between scenarios. Optional spouse 401(k)/HSA balances are included in household assets even in a single-filing scenario. Existing retirement/HSA balances grow even if new contributions are zero. Existing saved balances are kept with the primary owner when spouse fields are added. Employer shares remain in the equity issuer editor and are counted once.

Bonus, sign-on bonuses, and salary growth are grouped under **Offer**. Advanced sections stay collapsed until needed; their headings flag invalid inputs even while closed:

- **Living costs:** expense categories and optional location budgets, applied independently from tax location.
- **Taxes:** calculated annual liability or a manual total effective rate; single or married filing jointly; spouse wages/growth; signed annual federal/state/local tax adjustments; employee-premium and exemption switches.
- **Retirement & benefits:** retirement contribution strategies, quick savings targets, traditional and Roth 401(k) allocations, quick employer-match presets, action buttons to capture full matches, configurable simple or tiered employer match formulas, customizable vesting schedules (immediate, cliff, graded, and custom percentage schedules), qualifying cafeteria-plan health premiums, and payroll HSA contributions. Match settings default to Unsure, which assumes zero. Formulas apply to base salary and do not model payroll dates or true-ups. Strategy shortcuts use backdoor routes only when the matching confirmations and conversion route are already entered in the planner.
- **Career changes:** promotions and employer changes by calendar month or months after projection start, expected role/level, base, bonus and growth, optional new equity award and future refresher policy.
- **Equity:** individual/historical grants in dollars plus grant-date price, or explicit shares; common/custom vesting schedules; recurring refresher rules; selling at vest or retaining shares after estimated tax coverage; employer price/appreciation assumptions and starting vested holdings.
- **Starting balances & assumptions:** projection start year, investment return, expense inflation, tax-threshold inflation, and starting retirement/HSA balances.

The income-to-cash view shows annual cash compensation, estimated cash taxes, payroll benefits, living costs, contributions and remaining cash for the selected results year. When comparing scenarios, cumulative differences in compensation, equity, taxes, living costs and investment gains provide context; these interacting figures do not add up to the ending balance difference. Select a results year to inspect its monthly-equivalent cash picture, annual tax breakdown and monthly vesting detail. The main chart and account breakdown show the end of the whole projection. Annual and monthly CSV exports include both comparison scenarios and retain full numeric precision. CSV text is quoted and formula-like user text is neutralized.

## Investment calculators

Open **Calculators** and select one of the five tabs: ending balance, monthly saving needed, time to target, starting balance needed, and required return. Tabs wrap on narrow screens and support Left/Right arrow keys, Home, and End. **Standalone** uses a starting investment, fixed month-end contributions, and an effective annual return converted to monthly growth; it excludes taxes, fees, and inflation adjustments. Inputs are nominal USD. **Explore calculators** beside the Overview projection opens **Use my career plan**, which runs the existing career model rather than importing an average savings figure. Comparison mode solves the same question separately for both scenarios.

Career targets use the same investment balance as Overview: taxable investments, retirement/HSA assets, and vested employer shares, before future sale or withdrawal taxes. This is not a spendable-cash target or complete net worth. Startup option illustrations are excluded. Saving mode solves for extra hypothetical after-tax money each month, beyond the existing plan; it does not assert that the career funds this money. These deposits enter taxable cash once at month-end and can fund eligible IRA contributions under the existing rules. Starting mode solves for extra starting taxable investments, preserving the other account balances. Required-return mode changes only the diversified-investment return, keeping employer-stock assumptions separate. Hypothetical calculations never overwrite the saved plan.

Deadlines use whole years from 1–40. Time-to-target checks the starting balance and each month-end through 40 years and reports the first crossing, even if balances later fall. Longer searches continue employment, saving, and bundled tax assumptions without assuming a retirement date; no future promotions or grants are invented. Earlier deadlines preserve later career events. Starting taxable investments are limited to $10 million in total, monthly additional money to $1 million, and targets to $1 trillion. Standalone inputs and return searches support −99.9% through 30% effective annual returns. Return answers are hypothetical assumptions, not forecasts. Bounded career searches report a verified solution or no solution found within supported limits; they do not promise uniqueness or rule out every unsampled crossing.

Calculator drafts and results remain in memory while navigating and reset on refresh. They are excluded from backups, share links, and CSV exports. Standalone remains usable when career inputs are invalid. Career searches run in a local browser worker, with no network requests or server storage.

## Monthly model

Projection years are full calendar years beginning January 1. Career changes take effect at the start of the selected month. Base salary grows on each role's anniversary; explicit new-role pay replaces that month's automatic raise. Bonus targets accrue proportionally for each active month and are paid in December. Joint-filing spouse wages are spread evenly across months and included in household results.

For each year, taxes are computed twice: on cash compensation alone, and on cash plus all vested RSUs. Their difference is the tax attributable to equity. Reconciled annual cash taxes are allocated across months by cash compensation, and incremental equity taxes across vests by vested value. These reserves are planning allocations, **not employer withholding predictions**.

The monthly investment rate is `(1 + annualReturn / 100)^(1/12) - 1`. Nonnegative opening taxable investments and nonnegative retirement/HSA assets earn the assumed return; contributions enter at month-end. A negative taxable balance is an unfunded cash shortfall and earns no return. Held shares and retirement accounts are not automatically sold to cover cash spending.

Benefits reduce cash once. Retirement and HSA contributions enter their respective asset accounts; health premiums are spending, not assets. Healthcare budget categories **include** payroll premiums, so premiums already deducted from cash income are removed once from budgeted healthcare expenses. Post-payroll healthcare expenses cannot go below zero. If premiums exceed the medical budget, a notice explains that all premiums still reduce take-home.

Annual benefit targets are spread over months and capped at available cash compensation and per-person/household legal limits. Job changes do not reset Social Security or contribution limits. Actual contributions may fall short of targets when cash wages are insufficient; results show actual funded amounts. Employer match estimates are added to the traditional 401(k) balance and are tracked alongside completed years of service under the active vesting schedule. Employer match progresses across career changes (with support for role-specific match formulas). Departing before match vesting is complete forfeits unvested match while employee deferrals remain 100% owned. Certain age-based contribution catch-ups are estimated when age and plan eligibility are confirmed, using prior-year cash and vested stock wages from the sponsoring employer after payroll health and HSA deductions; reimbursements and withdrawals are excluded.

IRA and modeled backdoor targets are spread evenly over the year and funded each month from taxable cash after expenses and conservative tax reserves, with the primary owner funded before the spouse. Unfunded monthly targets are not carried forward. Taxes are recalculated using funded deductible contributions; estimated tax savings remain in taxable cash. Equity funding reserves the full baseline liability in addition to cash tax reserves, so contributions may be understated when equity vests. IRA eligibility uses modeled taxable wages including vested stock. A joint return shares that compensation limit across both owners’ IRA contributions. Other income and adjustments are excluded.

## Grant and career semantics

Vesting offset **1** means the end of the grant month, and offset **12** means the end of its 12th month. Schedules can contain 1–120 distinct month offsets and must total 100%. Templates are previewed before applying; choosing a selector alone does not overwrite a custom schedule.

Reported templates include even monthly/quarterly/semiannual/annual four-year vesting, a one-year cliff followed by monthly or quarterly vesting, historical Amazon 5/15/40/40, a reported 5/15/45/35 annual variant, and Google front-loaded variants. These are dated examples, not universal company policies. Review actual grant terms; alternatives can exist at the same company.

Dollar grants become fixed shares at an entered grant-date price or the employer's modeled price when awarded. Future dollar awards use that future modeled grant price. Employer appreciation is independent from diversified-investment returns and defaults to 0%; $100 is a modeling reference, not a live quote. Historical dollar grants require an entered actual grant-date price. Pre-projection vests are not added again: enter already-owned shares separately, with their cost basis.

All vested stock enters taxable wages even if held. Sell treatment invests proceeds after attributed equity taxes. Hold treatment sells enough shares to cover the estimated liability and tracks the remaining shares; appreciation and unrealized gains are counted once. Any tax exceeding a vest is settled through cash reserves. Unvested equity is never an owned asset.

Promotions retain old grants. Changing employers creates a new employment period and forfeits old unvested grants **before that month's end-of-month vests**, unless the grant is explicitly retained. Old vested holdings remain owned. Existing refresher awards continue on promotion; future role-policy awards stop at the next career event. Standalone refresher rules have explicit start/end months and a switch to stop at the first role change in that employment. Generated awards support individual departure exceptions.

## Tax coverage

Calculated mode models full-year W-2 employees who both live and work in one supported location throughout the projection: Columbus OH, Seattle WA, San Francisco or Los Angeles CA, New York City NY, Austin TX, or Boston MA. It supports single and married-joint filing, no dependents and standard deductions without senior-specific tax provisions. Age-based contribution catch-ups are estimated separately. Joint scenarios include both workers' wages, taxes, benefits and savings; the default one-adult expense budget should be edited for the household.

Tax rules are bundled as version `US-W2-2026.1`, with official URLs and access dates in `src/data/taxRules.ts` and the Taxes editor. The model includes federal progressive income tax, per-person Social Security, Medicare and household Additional Medicare, applicable state/city income taxes, high-income surtaxes/recapture, basic personal/household credits, and disclosed employee leave/disability premiums. Traditional 401(k) and qualified payroll health/HSA contributions have distinct taxable bases. California's HSA nonconformity is included. See [docs/TAX_SOURCES.md](docs/TAX_SOURCES.md) for detailed rules and source caveats.

Future calculations project **2026 law** using the editable default 2.5% inflation assumption only for indexed parameters. Fixed thresholds, including Additional Medicare, NY brackets and the CA $1 million surtax threshold, remain fixed. This does not predict or incorporate subsequent legislation. California's exemption-credit phaseout starting values are derived from the announced 2026 indexing pending publication of the complete booklet. NY/NYC use continuous rate schedules rather than $50 tax-table intervals, so return-table rounding can differ.

Signed tax adjustments modify final liability, not taxable income. Component liability is floored at zero; refundable credits are not paid out. The model excludes itemized deductions, family/earned-income credits, self-employment, foreign income, part-year/multistate allocations, investment income/dividends and realized capital gains. Returns represent assumed unrealized appreciation. Held shares are not sold later in the model; totals are **before future liquidation or withdrawal taxes** and are not a complete tax return or net worth.

## Saving, migration and input limits

Use **Backup** to download a private JSON backup, including both startup input sets, or **Restore** to validate and restore one after confirmation. Version 1 backups restore with startup mode disabled. CSV files contain results and cannot restore inputs. **Share** previews what is included before copying a link with both offers and startup details. Anyone with the link can read those inputs. Incoming full and partial links require confirmation before replacing the saved plan; recognized financial parameters are removed from the address after parsing. See [docs/MCP.md](docs/MCP.md) for the optional local agent interface.

Valid v3 inputs are saved locally under `careerworth:v3`; v2 saves are migrated. Existing v1 inputs migrate with their manual tax rates and repeating stock amounts intact. No grant is fabricated. A clearly labeled conversion previews a four-year award assumption before replacing legacy annual stock. The original `careerworth:v1` save is preserved. Monthly timing changes balances compared with the former annual model.

Invalid drafts suspend results and exports, preserving the last valid save. If saved data cannot be restored, the planner shows an example and keeps the existing save until you reset, restore a backup, or load a shared plan. Storage failures leave calculations available. Plan data stays in local browser storage, which is unencrypted and is not synchronized by CareerWorth. Reset restores the default plan.

Numerical guardrails: 1–40 years starting 2026–2036; $0–$10 million salary/bonus/contribution/grant inputs; $0–$1 million total monthly spending; base growth −100% to 20%; investment return strictly above −100% to 30%; expense inflation 0–20%; tax-threshold inflation 0–10%; share appreciation −99.9% to 100%. Initial prices are $0.01–$1 million per share; explicit historical grant prices can be as low as $0.000001. Fractional shares are supported. Names are 1–100 characters. Up to 30 career events, 100 custom grants, 30 recurring rules and 1,000 generated/custom grants are supported per scenario. Every computed amount is checked for finite values.

## Code map

- `src/lib/planner.ts`: v2 inputs, dates, defaults and validation. `model.ts` retains v1 calculation/migration regression fixtures.
- `src/lib/tax.ts` and `src/data/taxRules.ts`: pure tax calculation and sourced rules.
- `src/lib/equity.ts` and `src/data/vesting.ts`: grant expansion, schedules, employment periods and forfeitures.
- `src/lib/projection.ts`: monthly compensation, reconciled tax reserves and asset accounting.
- `src/lib/plannerStorage.ts` / `plannerCsv.ts`: versioned persistence/migration and detailed exports.
- `src/components/`: labeled editors, source disclosures, SVG chart and result tables. `ResultsNavigation.tsx` owns the destination definitions; `ThemeProvider.tsx` owns appearance.
- `src/components/ui/`: the used shadcn primitives and their MIT notice.
- `src/styles.css` and `src/styles/`: Tailwind theme tokens, app shell, shared editors, results, startup, and print styles.
- `docs/DATA_SOURCES.md`: existing compensation and six-county budget provenance.

Preset inputs are editable in `src/data/compensation.json`, `src/data/locationBudgets.json`, and `src/data/techPresets.json`. See [data sources](docs/DATA_SOURCES.md) for provenance and update the source notes when changing sourced values.
