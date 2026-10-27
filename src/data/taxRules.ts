// Tax year 2026. Snapshot accessed 2026-10-27. Unknown future law is not predicted.
// Only explicitly indexed parameters are inflated by the user-selected projection assumption.
export const TAX_VERSION = "US-W2-2026.1";
export const taxSources = [
  {
    label: "Federal brackets and deductions · IRS",
    url: "https://www.irs.gov/irb/2025-45_IRB",
    note: "2026 published; bracket thresholds and standard deductions indexed",
  },
  {
    label: "Social Security · SSA",
    url: "https://www.ssa.gov/cola/factsheets/2026.html",
    note: "2026 wage base indexed; Medicare thresholds fixed",
  },
  {
    label: "401(k) · IRS",
    url: "https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500",
    note: "2026 under-50 employee limit",
  },
  {
    label: "HSA and payroll benefits · IRS",
    url: "https://www.irs.gov/publications/p15b",
    note: "Qualified cafeteria-plan health and HSA contributions",
  },
  {
    label: "Ohio enacted rates",
    url: "https://codes.ohio.gov/ohio-revised-code/section-5747.02",
    note: "2026: $332 entry amount; exemption and joint-credit rules included",
  },
  {
    label: "Ohio exemptions",
    url: "https://dam.assets.ohio.gov/image/upload/tax.ohio.gov/forms/ohio_individual/individual/2025/it1040-booklet.pdf",
    note: "Published indexed amounts carried into 2026; statutory indexing frozen",
  },
  {
    label: "Columbus qualifying wages",
    url: "https://www.columbus.gov/Government/City-Auditor/Income-Tax-Division/General-Income-Tax-Information",
    note: "2.5%; traditional 401(k) included",
  },
  {
    label: "California 2026 indexing · FTB",
    url: "https://www.ftb.ca.gov/about-ftb/newsroom/tax-news/",
    note: "Published brackets/deductions/credit amounts; credit phaseout starts derived from published 3.4% indexing, pending full-year booklet",
  },
  {
    label: "California benefit wage bases · EDD",
    url: "https://edd.ca.gov/siteassets/files/pdf_pub_ctr/de231eb.pdf",
    note: "HSA nonconformity; 401(k) and cafeteria-plan treatment",
  },
  {
    label: "California SDI · EDD",
    url: "https://edd.ca.gov/en/Disability/Contribution_Rates_and_Benefit_Amounts",
    note: "2026 1.3%, uncapped",
  },
  {
    label: "New York 2026 enacted rates and recapture",
    url: "https://www.nysenate.gov/legislation/laws/TAX/601",
    note: "2026 statutory schedules and recapture; thresholds not indexed",
  },
  {
    label: "New York/NYC deductions and credits",
    url: "https://www.tax.ny.gov/pdf/current_forms/it/it201i.pdf",
    note: "Continuous schedules rather than $50 tax-table intervals; household and school credits included, refundable amounts not paid out",
  },
  {
    label: "New York PFL · WCB",
    url: "https://www.wcb.ny.gov/content/main/PressRe/paid-family-leave-2026.jsp",
    note: "2026 0.432%, annual employee cap $411.91; optional disability toggle separate",
  },
  {
    label: "Massachusetts rates and surtax · DOR",
    url: "https://www.mass.gov/info-details/tax-rates",
    note: "5% plus 4% above indexed $1,107,750; exemptions and FICA deduction fixed",
  },
  {
    label: "Massachusetts low-income rules",
    url: "https://www.mass.gov/info-details/no-tax-status-and-limited-income-credit",
    note: "No Tax Status and Limited Income Credit included",
  },
  {
    label: "Massachusetts PFML",
    url: "https://www.mass.gov/info-details/paid-family-and-medical-leave-employer-contribution-rates-and-calculator",
    note: "2026 employee share .46%; annual cap per person",
  },
  {
    label: "Washington PFML",
    url: "https://paidleave.wa.gov/estimate-your-paid-leave-payments/",
    note: "2026 employee share 1.13% × 71.43%; annual cap per person",
  },
  {
    label: "Washington stock wages",
    url: "https://app.leg.wa.gov/wac/default.aspx?cite=192-510-025",
    note: "Stock transfers included in wage base",
  },
  {
    label: "WA Cares",
    url: "https://wacaresfund.wa.gov/how-it-works",
    note: "0.58%, uncapped; exemption toggle available",
  },
];
export const federal = {
  rates: [0.1, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37],
  single: [12400, 50400, 105700, 201775, 256225, 640600, Infinity],
  joint: [24800, 100800, 211400, 403550, 512450, 768700, Infinity],
  deduction: { single: 16100, joint: 32200 },
  socialSecurityCap: 184500,
};
export const california = {
  single: [11456, 27157, 42861, 59498, 75197, 384109, 460927, 768213, Infinity],
  joint: [
    22912,
    54314,
    85722,
    118996,
    150394,
    768218,
    921854,
    1536426,
    Infinity,
  ],
  rates: [0.01, 0.02, 0.04, 0.06, 0.08, 0.093, 0.103, 0.113, 0.123],
  deduction: { single: 5900, joint: 11800 },
  personalCredit: { single: 158, joint: 316 },
  // Derived (not independently published): 2025 phaseout starts × announced 2026 CPI 1.034.
  creditPhaseout: { single: 260778, joint: 521561 },
};
export const newYork = {
  single: [
    8500,
    11700,
    13900,
    80650,
    215400,
    1077550,
    5000000,
    25000000,
    Infinity,
  ],
  joint: [
    17150,
    23600,
    27900,
    161550,
    323200,
    2155350,
    5000000,
    25000000,
    Infinity,
  ],
  rates: [0.039, 0.044, 0.0515, 0.054, 0.059, 0.0685, 0.0965, 0.103, 0.109],
  singleBases: [0, 332, 473, 586, 4191, 12141, 71198, 449714, 2509714],
  jointBases: [0, 669, 953, 1174, 8391, 17928, 143430, 417939, 2477939],
  deduction: { single: 8000, joint: 16050 },
};
