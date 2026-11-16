Build a complete, working website called **CareerWorth**: a simple career-to-wealth calculator for someone comparing job offers and places to live.

Finish the implementation, run it, and verify it. Do not stop at a plan or mockup. Make reasonable implementation decisions without asking follow-up questions.

## Product goal

Help a young professional answer:

“How much can I save with this salary and lifestyle, and how might my wealth change over time?”

Users should get useful results immediately and optionally compare two scenarios. Prioritize a professional appearance, simple controls, clear calculations, and a polished experience.

## Required stack

- React, TypeScript, and Vite.
- Plain CSS with CSS variables.
- A lightweight, custom SVG projection chart.
- Vitest for calculation tests.
- npm for package management.
- All calculations run in the browser.
- No backend, database, authentication, paid APIs, or API keys.
- Use compatible stable dependencies and include a lockfile.

## Visual direction

Create a restrained financial calculator, with the care and clarity of a good banking product.

- Light theme, warm off-white background, white surfaces, dark charcoal text, and a muted green accent.
- Clean system typography, generous spacing, subtle borders, and minimal shadows.
- Clear hierarchy and excellent alignment.
- Compact header: product name and a short description.
- Open directly to the calculator with populated example inputs and visible results.
- Desktop: input panel on the left, results and chart on the right.
- Mobile: inputs followed by results, with no horizontal overflow.
- Use currency formatting and tabular numerals.
- Avoid a marketing landing page, oversized hero, decorative illustrations, gradients, excessive cards, sidebar navigation, and unnecessary animations.
- Keep advanced settings collapsed initially.

The interface should feel simple even though the calculations are useful.

## Inputs

Show these primary inputs:

1. Scenario name.
2. Annual gross salary.
3. Annual salary growth percentage.
4. Estimated effective total income/payroll tax rate.
5. Monthly living expenses.
6. Starting savings/investments.
7. Projection length: 1–40 years.

Put these in an expandable “Assumptions” section:

- Annual investment return.
- Annual expense inflation.

Explain tax rate briefly: “Estimated combined federal, state, local, and payroll taxes as a percentage of gross income.”

For this version, users enter their own effective tax rate and expenses. Do not invent state tax tables or imply that the app computes actual tax liability. The scenario name can identify the city and offer.

## Default example

Scenario A: “Columbus offer”
- Salary: $100,000
- Annual salary growth: 3%
- Effective tax rate: 25%
- Monthly expenses: $3,000
- Starting investments: $20,000
- Projection: 10 years
- Annual return: 5%
- Expense inflation: 2.5%

Provide an “Add comparison” button that reveals Scenario B, initially populated with:

Scenario B: “Seattle offer”
- Salary: $140,000
- Annual salary growth: 3%
- Effective tax rate: 28%
- Monthly expenses: $4,500

Starting investments, projection length, investment return, and expense inflation should be shared assumptions for both scenarios.

Label these examples as illustrative assumptions, not verified city averages or actual tax estimates.

Allow removing the comparison and resetting all inputs.

## Results

Update results immediately as valid inputs change.

Show:

- Monthly take-home income in year one.
- Monthly savings or shortfall in year one.
- Savings rate: annual surplus divided by annual take-home income.
- Projected ending investment balance.
- A clear line chart of year-end investment balances, including the starting balance at year zero.
- When comparing: both lines, a clear legend, and the difference in ending balances.
- An expandable year-by-year table showing year, gross income, estimated taxes, expenses, surplus/shortfall, and ending balance.
- CSV export of the projection, including both scenarios when comparison is active.

Use “Projected investment balance” rather than “net worth,” because the model does not include housing or other assets and liabilities.

## Calculation specification

Use a deterministic annual model:

For year t, starting at 1:

grossIncome[t] = initialSalary × (1 + salaryGrowth)^(t − 1)
taxes[t] = grossIncome[t] × effectiveTaxRate
takeHome[t] = grossIncome[t] − taxes[t]
expenses[t] = monthlyExpenses × 12 × (1 + expenseInflation)^(t − 1)
surplus[t] = takeHome[t] − expenses[t]

For nonnegative opening balances:

endingBalance[t] = openingBalance[t] × (1 + investmentReturn) + surplus[t]

Assume annual surplus is invested at year-end. A shortfall reduces the balance at year-end.

If the opening balance is negative, do not apply investment returns to it. Carry it forward and add that year’s surplus. Clearly describe a negative balance as an unfunded shortfall, not a modeled loan. Debt interest is outside this calculator.

Keep full precision internally and round only for display.

Explain this timing and these simplifications in a short “How this works” disclosure. Future values are nominal dollars. Returns are assumptions, not guarantees. Salary growth is user-defined, not a career prediction.

Do not include employer retirement accounts, contribution limits, investment tax treatment, equity compensation, debt interest, or Monte Carlo simulations in this version.

## Useful interpretation

Include one concise, deterministic insight based on the current inputs, such as:

- “Your current assumptions leave approximately $X per month to invest.”
- “Expenses exceed estimated take-home income by $X per month.”
- “Scenario B ends with approximately $X more after Y years.”

Avoid generic AI advice and securities recommendations.

## Behavior and accessibility

- Every input has a persistent visible label and its unit.
- Support keyboard use, visible focus states, and accessible contrast.
- Inputs should be comfortable to edit without jumping cursors or aggressive formatting.
- Empty or invalid fields show an inline message; results must never display NaN, Infinity, or misleading stale numbers.
- Support zero salary, zero expenses, zero growth, zero return, and negative investment returns greater than −100%.
- Reject negative salary, expenses, and starting investments.
- Restrict effective tax rate to 0–100%.
- Set sensible documented limits on other percentages and monetary inputs to prevent overflow.
- Handle long scenario names gracefully.
- Chart supports negative balances and provides an accessible text summary.
- Save valid inputs to localStorage and restore them on reload.
- Handle unavailable storage and malformed saved data gracefully.
- Include a short privacy note explaining that inputs stay in this browser.

## Verification

Keep calculation logic separate from UI components and test meaningful cases:

1. Default Scenario A year one:
   - Gross income: $100,000
   - Taxes: $25,000
   - Take-home: $75,000
   - Expenses: $36,000
   - Surplus: $39,000
   - Monthly savings: $3,250
   - Ending investment balance: $60,000

2. Zero return and zero growth produce the expected linear accumulation.
3. Salary growth and expense inflation first apply in year two.
4. Shortfalls reduce investments and may produce a negative balance.
5. Negative opening balances do not earn investment returns.
6. Identical scenarios produce identical projections.
7. Invalid inputs cannot produce non-finite results.

Run the tests and production build. If browser tools are available, inspect the actual site at desktop and mobile widths, edit inputs, enable comparison, reload saved values, and test CSV export. Fix issues you find.

## Completion criteria

Deliver a finished calculator with all required interactions working, polished responsive styling, passing calculation tests, and a successful production build.

Include a short README with setup/run/build/test instructions, calculation assumptions, and limitations.

In your final response, briefly state what you built, what you verified, any remaining limitations, and how to open the running site. Do not claim verification you did not perform.

Choose sensible details independently and complete the website.

## Additional requirement: company and location presets

Add optional presets that make the calculator useful without requiring users to research every input. Preserve the simple calculator interface.

### Company compensation presets

Above the salary inputs, add:
- Company selector.
- Career level selector: entry-level, mid-level, senior.
- Location selector where location-specific compensation data is available.
- “Apply preset” button.

Start with Google, Meta, Amazon, Microsoft, and Apple.

Use publicly accessible Levels.fyi data as reference material. Research the actual company-specific level mappings; do not assume levels mean the same thing across companies.

For each supported preset, store:
- Company.
- Company-specific level and readable career stage.
- Role: software engineer.
- Geographic scope.
- Annual base salary.
- Annualized stock compensation.
- Annual recurring bonus.
- Source URL.
- Date accessed and reported data period, if available.

Use a small, curated static dataset bundled with the app. Do not build a scraper or require runtime access to Levels.fyi. Respect access restrictions. If a figure cannot be verified, omit that preset rather than inventing data. A smaller verified dataset is acceptable.

Label figures as reported compensation estimates, not guaranteed offers. Distinguish averages, medians, and individual offer examples; prefer comparable aggregate figures. Do not silently mix nationwide compensation with city-specific compensation.

### Compensation modeling

Replace the single gross salary input with:
- Annual base salary.
- Annual recurring cash bonus, default $0.
- Annualized stock compensation, default $0.

Show total annual compensation beneath these fields.

Add a simple stock treatment selector:
- “Exclude stock from projection” — default.
- “Assume stock is sold as it vests and invested.”

For this simplified model:
- Base salary and recurring bonus determine monthly-equivalent cash take-home.
- Apply the existing effective tax rate to both.
- Explain that monthly-equivalent income smooths annual bonuses and does not represent a paycheck schedule.
- When included, annualized stock compensation is taxed using the same assumed effective rate and added to investments at year-end.
- Show after-tax stock contributions separately from cash savings.
- Apply salary growth only to base salary. Hold bonus and annualized stock compensation constant.
- Exclude sign-on bonuses and stock-price appreciation.
- Explain that annualized stock presets simplify actual vesting schedules.

Update the calculation disclosure, year-by-year table, CSV export, and tests accordingly. Preserve the original default example and its expected results by keeping its bonus and stock at zero.

### Location presets

Offer:
- Columbus, OH
- Seattle, WA
- San Francisco, CA
- New York, NY
- Austin, TX
- Boston, MA

Default household: one adult, no children, renting.

Location presets should populate editable monthly expense categories:
- Housing and utilities.
- Food.
- Transportation.
- Healthcare.
- Other spending.

Sum these into the monthly living-expense input used by the model. Keep category editing inside a collapsed “Expense breakdown” section.

Research credible sources for the presets. Record source URLs, geographic coverage, source year, and access date. Clearly distinguish published figures from derived estimates. Avoid double-counting costs across categories.

Do not call minimum-needs budgets “average spending.” If using a minimum-needs source, label it accordingly. Use only data permitted for the intended use. If reliable reusable data is unavailable, provide explicitly labeled illustrative budgets rather than presenting invented figures as sourced estimates.

Changing location must not silently change compensation or the tax rate. Show a brief reminder to review the effective tax rate for the selected location. This version still uses a user-entered effective tax rate and does not claim to calculate actual state or local taxes.

### Preset behavior and presentation

- Keep presets optional; manual entry remains available.
- Applying a preset fills the relevant fields, which remain editable.
- Mark edited presets as “Customized.”
- Changing a selector alone must not overwrite entered values.
- Provide compact source links and an “About these estimates” disclosure.
- Store datasets separately from calculation logic and UI components.
- Save selected presets and customized values in localStorage.
- Both scenarios can use different company and location presets.
- Do not imply affiliation with Levels.fyi or the listed companies.

Test that presets populate correctly, manual edits survive reload, changing locations does not overwrite compensation or taxes, and stock is included or excluded correctly.