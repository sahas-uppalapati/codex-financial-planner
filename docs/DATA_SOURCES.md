# Preset provenance

## Investment calculator assumptions

The standalone investment calculators use user-entered amounts and returns with deterministic monthly compounding; they do not use market data or recommended return forecasts. Career mode reuses the planner’s sourced tax and compensation assumptions and actual monthly projection. Additional monthly money and starting investments are hypothetical after-tax funding, not compensation benchmarks. Targets, supported limits, timing, and the 40-year extrapolation are documented in the README’s Investment calculators section.

## Startup option illustration

Fictional Series A, B, and C examples use base salary medians reported by [Cadre](https://www.yourcadre.com/comp) for its 2020–2026 engineering placements (updated September 2026, accessed November 16, 2026; CC BY 4.0). The source combines seed–Series A and Series B–C respectively; it does not establish separate B and C medians. Option counts, strike price and vesting are invented for illustration, not sourced company offers or equity benchmarks.

The comparison uses user-supplied inputs, not company valuations or exit forecasts. The optional 409A paper spread is the positive difference between the entered common-share value and strike times the full grant, assuming all options vest; preferred-share prices are not used. It assumes even monthly vesting over a user-selected duration and cliff, continued employment until the projection-end exit, and, for company-level outcomes, a single user-entered total dilution percentage. Per-share outcomes use the entered future common-share price directly and do not apply a separate dilution assumption. Vested ownership equals initial ownership times the vested fraction and remaining ownership after dilution. Illustrative proceeds are the greater of zero and common-share exit value times vested ownership minus exercise cost. The common-share exit value is after senior claims; headline sale price, taxes, fees, option expiration, future grants, and time value of money are not modeled. Per-share break-even divides the compensation gap by vested options and adds the strike price. Break-even compares these pre-tax proceeds with the difference in projected gross employee compensation, including public stock; it does not compare employer match, benefits, net assets or investment returns.

Static references are bundled; no automated scraper, runtime fetch, or paid API is used. All values are USD. Company figures and expense budgets have different geographic scopes, which are shown in the UI.

## Compensation

Role: **software engineer**. Statistic: **reported average**, using each public Levels.fyi “Average Compensation By Level” table. Geography is selectable as United States, San Francisco Bay Area, Greater Seattle Area, or New York City Area; each preset links to its corresponding location page. Values are USD/year, copied at the precision shown by the public component table (usually $1,000, or $100 when the table shows a decimal); pages were checked **2026-11-17**. These are snapshots, not guaranteed offers or calendar-year averages. Submission windows are not stated; source update dates vary. Components can sum slightly differently from the site's rounded total. Public averages are self-reported aggregate data, not individual offers.

The curated snapshot is in [`../src/data/compensation.json`](../src/data/compensation.json); the UI displays the selected region and its source link. The bundled values include Google L3/L4/L5, Meta E3/E4/E5, Amazon L4/L5/L6, Microsoft 59/61 where available, and Apple ICT2/ICT3/ICT4, for the regions where the public table provided a comparable component split. No missing level/region value is inferred. The quick estimator uses these same snapshots; tax locations outside the three listed metro areas use the national snapshot rather than an estimated local pay adjustment. Examples: [Google Bay Area](https://www.levels.fyi/companies/google/salaries/software-engineer/locations/san-francisco-bay-area), [Meta Bay Area](https://www.levels.fyi/companies/meta/salaries/software-engineer/locations/san-francisco-bay-area), [Amazon Seattle](https://www.levels.fyi/companies/amazon/salaries/software-engineer/locations/greater-seattle-area), [Microsoft Bay Area](https://www.levels.fyi/companies/microsoft/salaries/software-engineer/locations/san-francisco-bay-area), and [Apple New York](https://www.levels.fyi/companies/apple/salaries/software-engineer/locations/new-york-city-area).

**Bonus and stock handling:** Amazon's published “Bonus” is sign-on amounts spread across four years and averaged; it is shown as reported but set to $0 recurring in projections. Google's table labels stock “First Year Stock” and bonus “Bonus + Sign On”; both are excluded from recurring projections because the split is unavailable. Applying Google's preset therefore changes base pay but adds no recurring stock or bonus. For Meta, Apple, and Microsoft, the published bonus average is projected as recurring, with the caveat that company aggregate bonus may include annualized sign-on. [Levels.fyi's explanation of annualized stock and bonus components](https://www.levels.fyi/community/thread/9jCv1L/calculating-total-comp-on-levels) describes this aggregation behavior.

**Equity handling:** For companies whose source reports annualized stock, applying a preset creates a representative initial grant sized as four times that annual average, with the company's configured vesting schedule (Meta quarterly, Apple semiannual, Amazon 5/15/45/35, Microsoft annual). Available modeled promotions receive the same estimate based on that target level's annualized stock. This is a wealth-model illustration, not the user's actual new-hire or promotion award. No refreshers are assumed. Grants use the selected company's stock-price assumptions. Google first-year stock is not converted to recurring compensation or a four-year grant. Vesting source and schedule details are documented in [TAX_SOURCES.md](TAX_SOURCES.md) and [`../src/data/vesting.ts`](../src/data/vesting.ts).

### Level experience context

The company preset panel also shows Levels.fyi's public [Average YoE vs Level at FAANG community analysis](https://www.levels.fyi/community/thread/M5XW4v/average-yoe-vs-level-at-faang), accessed 2026-10-27. It reports average years of experience at normalized Entry, Software Engineer, and Senior Engineer levels from 40,000 submissions: Meta 1.50 / 4.02 / 8.39; Google 3.11 / 5.52 / 9.36; Apple 2.03 / 4.17 / 9.45; Amazon 2.09 / 6.26 / 11.30. Applying a compatible preset schedules modeled promotion events after the gap between adjacent average experience figures and uses the next level's published recurring base and bonus in the projection. These are cross-sectional averages, not measured promotion durations or forecasts; the source explicitly notes that years of experience and level are not a fixed mapping. Existing manually entered career events are retained; generated promotions stop at or before the first manual career event so they cannot override the user's own plan. Comparable values were not published there for Microsoft. Salary and promotion awards at each stage are used only where the curated compensation snapshot above has a verified breakdown. Recurring refresher equity is not invented.

## Location budgets

Living wage data sourced from the **Living Wage Institute via [livingwage.mit.edu](https://livingwage.mit.edu)**. Source edition **2026**, updated **February 15, 2026**, checked **November 17, 2026**. The main location presets use **one adult, zero children**; the quick estimator also uses **two adults, one working, zero children**. Housing follows the source's rental-cost approach. These are **minimum-needs estimates**, not typical discretionary spending or city averages. County coverage is explicit, especially New York, which uses Manhattan only.

[Methodology](https://livingwage.mit.edu/pages/methodology). The [FAQ](https://livingwage.mit.edu/pages/faqs) permits direct use of ten or fewer locations with attribution. Only the following seven references were curated; no scraper or bulk spreadsheet export is included. Broader reuse would require reassessing the source's licensing conditions. All seven county pages were checked November 17, 2026.

Published annual input components, used once each:

| City label → source county                                                      | Housing |  Food | Transport | Medical | Civic | Internet & mobile | Other |
| ------------------------------------------------------------------------------- | ------: | ----: | --------: | ------: | ----: | ----------------: | ----: |
| [Columbus → Franklin OH](https://livingwage.mit.edu/counties/39049)             |  13,698 | 4,358 |     7,912 |   3,658 | 3,347 |             1,497 | 4,549 |
| [Seattle → King WA](https://livingwage.mit.edu/counties/53033)                  |  25,589 | 5,234 |     8,441 |   3,032 | 3,876 |             2,397 | 4,992 |
| [Los Angeles → Los Angeles CA](https://livingwage.mit.edu/counties/06037)       |  22,471 | 4,463 |     8,681 |   3,255 | 3,876 |             1,517 | 4,992 |
| [San Francisco → San Francisco CA](https://livingwage.mit.edu/counties/06075)   |  27,517 | 5,807 |     6,691 |   3,828 | 3,876 |             1,971 | 4,992 |
| [New York → New York NY (Manhattan)](https://livingwage.mit.edu/counties/36061) |  35,525 | 7,116 |     4,710 |   4,695 | 3,456 |             1,627 | 4,715 |
| [Austin → Travis TX](https://livingwage.mit.edu/counties/48453)                 |  18,213 | 4,159 |     8,465 |   3,075 | 2,583 |             1,479 | 4,067 |
| [Boston → Suffolk MA](https://livingwage.mit.edu/counties/25025)                |  29,455 | 5,141 |     5,991 |   4,257 | 3,456 |             2,359 | 4,715 |

**Derived**, not directly published, monthly inputs:

- Housing and utilities = (published housing + internet & mobile) / 12. Housing already accounts for basic utilities; they are not added a second time.
- Food = published food / 12.
- Transportation = published transportation / 12.
- Healthcare = published medical / 12.
- Other spending = (published civic + other) / 12.

Each derived monthly field is rounded to cents when the preset is created. Thereafter projection calculations retain full precision. Childcare is zero for this household. Source tax and income requirement rows are deliberately excluded; the calculator applies its independently selected tax model separately. The original default offers keep their illustrative $3,000/$4,500 monthly budgets until an explicit preset application.

The quick company estimator uses two household variants from these same county pages: one adult with no children, and two adults with one worker and no children. It uses the published annual rows for housing, food, medical, transportation, civic, internet/mobile, and other expenses for each profile; its five displayed monthly categories are derived the same way as the main location presets. Both annual component sets are stored in [`../src/data/locationBudgets.json`](../src/data/locationBudgets.json); monthly values are derived in [`../src/data/presets.ts`](../src/data/presets.ts). Published annual category totals for the two-adult variant are: Columbus $54,972; Seattle $71,166; Los Angeles $67,850; San Francisco $77,710; Manhattan $82,577; Austin $57,881; Boston $72,301. These are minimum-needs examples, not typical household budgets. No LA-specific tech compensation snapshot is supplied; the estimator uses the national compensation snapshot there.

Tax calculation and vesting provenance for the v2 monthly model is documented in [TAX_SOURCES.md](TAX_SOURCES.md).

## Editing preset data

The curated compensation snapshots live in [`../src/data/compensation.json`](../src/data/compensation.json), county budget inputs in [`../src/data/locationBudgets.json`](../src/data/locationBudgets.json), and quick-estimator company, level, and growth presets in [`../src/data/techPresets.json`](../src/data/techPresets.json). Keep source dates and notes current when changing sourced figures. Derived compensation treatment and monthly budget calculations remain in TypeScript.

The decision summary, what-if preview, and salary-gap estimate reuse the existing projections and sourced assumptions. Preview inputs do not alter the saved plan.
