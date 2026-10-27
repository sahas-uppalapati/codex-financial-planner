# Preset provenance

All references were accessed **2026-10-27**. Static references are bundled; no automated scraper, runtime fetch, or paid API is used. All values are USD. Company figures and expense budgets have different geographic scopes, which are shown in the UI.

## Compensation

Role: **software engineer**. Statistic: **reported average**, using the public “Average Compensation By Level” table, not the overall company's median. Geographic scope: **United States**. Submission window is not stated in the source; these are snapshots, not calendar-year averages. Public source update: **2026-10-26**, except Apple **2026-10-25**. Base, stock, and bonus components are independently published rounded figures, so summed components can differ from the displayed headline total. CareerWorth sums components, never back-solves an omitted component.

| Source                                                                             | Stage and exact level | Base/year | Annualized stock | Reported annual bonus |
| ---------------------------------------------------------------------------------- | --------------------- | --------: | ---------------: | --------------------: |
| [Meta](https://www.levels.fyi/companies/meta/salaries/software-engineer)           | Entry · E3            |   146,000 |           32,000 |                 9,200 |
| Same source                                                                        | Mid · E4              |   185,000 |          103,000 |                17,700 |
| Same source                                                                        | Senior · E5           |   226,000 |          208,000 |                25,000 |
| [Apple](https://www.levels.fyi/companies/apple/salaries/software-engineer)         | Entry · ICT2          |   142,000 |           25,300 |                 4,000 |
| Same source                                                                        | Mid · ICT3            |   172,000 |           66,000 |                12,700 |
| Same source                                                                        | Senior · ICT4         |   216,000 |          134,000 |                22,900 |
| [Microsoft](https://www.levels.fyi/companies/microsoft/salaries/software-engineer) | Entry · 59 (SDE)      |   129,000 |           23,300 |                17,700 |
| Same source                                                                        | Mid · 61 (SDE II)     |   158,000 |           28,900 |                17,700 |
| [Amazon](https://www.levels.fyi/companies/amazon/salaries/software-engineer)       | Senior · L6 (SDE III) |   217,000 |          166,000 |                     0 |

Reported annual bonus is treated as recurring in this simplified model; users must review their offer's actual recurring bonus. Stock annualization does not model vesting dates, price movement or refreshers.

Mappings researched against company pages: Google L3/L4/L5; Meta E3/E4/E5; Amazon L4/L5/L6; Microsoft 59–60/61–62/63–64; Apple ICT2/ICT3/ICT4 correspond to entry/mid/senior. Microsoft presets select a specific level, not the combined band.

**Omissions:** The inspected [Google](https://www.levels.fyi/companies/google/salaries/software-engineer) snapshot labels compensation “First Year Stock” and “Bonus + Sign On,” so it cannot supply the required recurring breakdown. Amazon entry/mid recurring bonus could not be established separately from new-hire incentives; Microsoft's senior detailed component breakdown could not be verified. These choices remain available as selectors, with manual inputs and a clear unavailable-preset explanation; no invented figures are inserted. No city-specific compensation is claimed.

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
