# Preset provenance

All references were accessed **2026-10-27**. Static references are bundled; no automated scraper, runtime fetch, or paid API is used. All values are USD. Company figures and expense budgets have different geographic scopes, which are shown in the UI.

## Compensation

Role: **software engineer**. Statistic: **reported average**, using each public Levels.fyi “Average Compensation By Level” table. Geography is selectable as United States, San Francisco Bay Area, Greater Seattle Area, or New York City Area; each preset links to its corresponding location page. Values are USD/year, rounded public component averages, accessed **2026-10-27**. These are snapshots, not guaranteed offers or calendar-year averages. Submission windows are not stated; source update dates vary. Components can sum slightly differently from the site's rounded total.

The curated snapshot is in [`src/data/presets.ts`](src/data/presets.ts); the UI displays the selected region and its source link. The bundled values include Google L3/L4/L5, Meta E3/E4/E5, Amazon L4/L5/L6, Microsoft 59/61 where available, and Apple ICT2/ICT3/ICT4, for the regions where the public table provided a comparable component split. No missing level/region value is inferred. [Example current Meta Bay Area page](https://www.levels.fyi/companies/meta/salaries/software-engineer/locations/san-francisco-bay-area) shows regional level tables; [Microsoft Bay Area page](https://www.levels.fyi/companies/microsoft/salaries/software-engineer/locations/san-francisco-bay-area) shows 59/60/61/62 detail.

**Bonus handling:** Amazon's published “Bonus” is sign-on amounts spread across four years and averaged; it is shown as reported but set to $0 recurring in projections. Google's table labels stock “First Year Stock” and bonus “Bonus + Sign On”; both are excluded from recurring projections because the split is unavailable. For Meta, Apple, and Microsoft, the published bonus average is projected as recurring, with the caveat that company aggregate bonus may include annualized sign-on. [Levels.fyi's explanation of annualized stock and bonus components](https://www.levels.fyi/community/thread/9jCv1L/calculating-total-comp-on-levels) describes this aggregation behavior.

**Equity handling:** For companies whose source reports annualized stock, applying a preset creates a representative initial grant sized as four times that annual average, with the company's configured vesting schedule (Meta quarterly, Apple semiannual, Amazon 5/15/45/35, Microsoft annual). Available modeled promotions receive the same estimate based on that target level's annualized stock. This turns the annualized source statistic into a grant for the wealth model; it is explicitly an estimate and does not establish the user's actual new-hire or promotion award. No refreshers are assumed. Grants use the selected company's stock-price assumptions. Google first-year stock is not converted to a four-year grant. Vesting source and schedule details are documented in [TAX_SOURCES.md](TAX_SOURCES.md) and [`src/data/vesting.ts`](src/data/vesting.ts).

### Level experience context

The company preset panel also shows Levels.fyi's public [Average YoE vs Level at FAANG community analysis](https://www.levels.fyi/community/thread/M5XW4v/average-yoe-vs-level-at-faang), accessed 2026-10-27. It reports average years of experience at normalized Entry, Software Engineer, and Senior Engineer levels from 40,000 submissions: Meta 1.50 / 4.02 / 8.39; Google 3.11 / 5.52 / 9.36; Apple 2.03 / 4.17 / 9.45; Amazon 2.09 / 6.26 / 11.30. Applying a compatible preset schedules modeled promotion events after the gap between adjacent average experience figures and uses the next level's published recurring base and bonus in the projection. These are cross-sectional averages, not measured promotion durations or forecasts; the source explicitly notes that years of experience and level are not a fixed mapping. Existing manually entered career events are retained; generated promotions stop at or before the first manual career event so they cannot override the user's own plan. Comparable values were not published there for Microsoft. Salary at each stage is used only where the curated compensation snapshot above has a verified breakdown. Reported annual stock averages are not converted into future equity grants.

## Location budgets

Living wage data sourced from the **Living Wage Institute via [livingwage.mit.edu](https://livingwage.mit.edu)**. Source edition **2026**, updated **February 15, 2026**. Household: **one adult, zero children**. Housing follows the source's rental-cost approach. These are **minimum-needs estimates**, not typical discretionary spending or city averages. County coverage is explicit, especially New York, which uses Manhattan only.

[Methodology](https://livingwage.mit.edu/pages/methodology). The [FAQ](https://livingwage.mit.edu/pages/faqs) permits direct use of ten or fewer locations with attribution. Only the following six references were curated; no scraper or bulk spreadsheet export is included. Broader reuse would require reassessing the source's licensing conditions.

Published annual input components, used once each:

| City label → source county                                                      | Housing |  Food | Transport | Medical | Civic | Internet & mobile | Other |
| ------------------------------------------------------------------------------- | ------: | ----: | --------: | ------: | ----: | ----------------: | ----: |
| [Columbus → Franklin OH](https://livingwage.mit.edu/counties/39049)             |  13,698 | 4,358 |     7,912 |   3,658 | 3,347 |             1,497 | 4,549 |
| [Seattle → King WA](https://livingwage.mit.edu/counties/53033)                  |  25,589 | 5,234 |     8,441 |   3,032 | 3,876 |             2,397 | 4,992 |
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

Tax calculation and vesting provenance for the v2 monthly model is documented in [TAX_SOURCES.md](TAX_SOURCES.md).
