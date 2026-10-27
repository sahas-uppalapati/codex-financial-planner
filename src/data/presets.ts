import type { Categories, Scenario } from "../lib/model";
export const companies = [
  "Google",
  "Meta",
  "Amazon",
  "Microsoft",
  "Apple",
] as const;
export const stages = [
  { id: "entry", label: "Entry-level" },
  { id: "mid", label: "Mid-level" },
  { id: "senior", label: "Senior" },
];
export interface CompensationPreset {
  id: string;
  company: string;
  stage: string;
  level: string;
  role: "Software engineer";
  scope: "United States";
  base: number;
  stock: number;
  bonus: number;
  statistic: "Reported average";
  source: string;
  accessed: string;
  reportedPeriod: string;
}
// A small, manually curated reference snapshot, not a scraper or live data feed.
// The public Google snapshot labels stock as first-year and combines bonus with sign-on;
// it is intentionally not represented as recurring compensation. Unverified levels are omitted.
const snapshot = (
  company: string,
  stage: string,
  level: string,
  base: number,
  stock: number,
  bonus: number,
): CompensationPreset => ({
  id: `${company.toLowerCase()}-${stage}`,
  company,
  stage,
  level,
  role: "Software engineer",
  scope: "United States",
  base,
  stock,
  bonus,
  statistic: "Reported average",
  source: `https://www.levels.fyi/companies/${company.toLowerCase()}/salaries/software-engineer`,
  accessed: "2026-10-27",
  reportedPeriod: `Public aggregate snapshot; source updated ${company === "Apple" ? "2026-10-25" : "2026-10-26"}; submission window not stated`,
});
export const compensationPresets: CompensationPreset[] = [
  snapshot("Meta", "entry", "E3", 146000, 32000, 9200),
  snapshot("Meta", "mid", "E4", 185000, 103000, 17700),
  snapshot("Meta", "senior", "E5", 226000, 208000, 25000),
  snapshot("Microsoft", "entry", "59 · SDE", 129000, 23300, 17700),
  snapshot("Microsoft", "mid", "61 · SDE II", 158000, 28900, 17700),
  snapshot(
    "Apple",
    "entry",
    "ICT2 · Junior software engineer",
    142000,
    25300,
    4000,
  ),
  snapshot("Apple", "mid", "ICT3 · Software engineer", 172000, 66000, 12700),
  snapshot(
    "Apple",
    "senior",
    "ICT4 · Senior software engineer",
    216000,
    134000,
    22900,
  ),
  snapshot("Amazon", "senior", "L6 · SDE III", 217000, 166000, 0),
];
export const levelMappings: Record<string, string[]> = {
  Google: ["L3 · SWE II", "L4 · SWE III", "L5 · Senior SWE"],
  Meta: ["E3", "E4", "E5"],
  Amazon: ["L4 · SDE I", "L5 · SDE II", "L6 · SDE III"],
  Microsoft: ["59–60 · SDE", "61–62 · SDE II", "63–64 · Senior SDE"],
  Apple: ["ICT2", "ICT3", "ICT4"],
};
export function findCompensation(s: Scenario) {
  return compensationPresets.find(
    (p) =>
      p.company === s.company &&
      p.stage === s.stage &&
      p.scope === s.compensationLocation,
  );
}
export function applyCompensation(
  s: Scenario,
  p: CompensationPreset,
): Scenario {
  return {
    ...s,
    base: String(p.base),
    bonus: String(p.bonus),
    stock: String(p.stock),
    appliedCompensation: p.id,
  };
}
export function compensationStatus(s: Scenario): string {
  const p = compensationPresets.find((p) => p.id === s.appliedCompensation);
  if (!p) return "Manual entry";
  return Number(s.base) === p.base &&
    Number(s.bonus) === p.bonus &&
    Number(s.stock) === p.stock
    ? `${p.company} · ${p.level}`
    : "Customized";
}
export interface AnnualBudget {
  housing: number;
  food: number;
  transportation: number;
  medical: number;
  civic: number;
  internetMobile: number;
  other: number;
}
export interface LocationPreset {
  id: string;
  label: string;
  expenses: Categories;
  annualPublished: AnnualBudget;
  scope: string;
  sourceYear: string;
  accessed: string;
  source: string;
  kind: string;
}
// Six manually curated county references fall within the source FAQ's <=10-location allowance.
// Monthly fields are derived from annual published categories, rounded to cents at preset creation.
const location = (
  id: string,
  label: string,
  county: string,
  fips: string,
  annual: AnnualBudget,
): LocationPreset => ({
  id,
  label,
  expenses: {
    housing: ((annual.housing + annual.internetMobile) / 12).toFixed(2),
    food: (annual.food / 12).toFixed(2),
    transportation: (annual.transportation / 12).toFixed(2),
    healthcare: (annual.medical / 12).toFixed(2),
    other: ((annual.civic + annual.other) / 12).toFixed(2),
  },
  annualPublished: annual,
  scope: county,
  sourceYear: "2026; updated February 15, 2026",
  accessed: "2026-10-27",
  source: `https://livingwage.mit.edu/counties/${fips}`,
  kind: "Derived minimum-needs budget",
});
export const locationPresets = [
  location("columbus", "Columbus, OH", "Franklin County, Ohio", "39049", {
    housing: 13698,
    food: 4358,
    transportation: 7912,
    medical: 3658,
    civic: 3347,
    internetMobile: 1497,
    other: 4549,
  }),
  location("seattle", "Seattle, WA", "King County, Washington", "53033", {
    housing: 25589,
    food: 5234,
    transportation: 8441,
    medical: 3032,
    civic: 3876,
    internetMobile: 2397,
    other: 4992,
  }),
  location(
    "san-francisco",
    "San Francisco, CA",
    "San Francisco County, California",
    "06075",
    {
      housing: 27517,
      food: 5807,
      transportation: 6691,
      medical: 3828,
      civic: 3876,
      internetMobile: 1971,
      other: 4992,
    },
  ),
  location(
    "new-york",
    "New York, NY",
    "New York County (Manhattan), New York",
    "36061",
    {
      housing: 35525,
      food: 7116,
      transportation: 4710,
      medical: 4695,
      civic: 3456,
      internetMobile: 1627,
      other: 4715,
    },
  ),
  location("austin", "Austin, TX", "Travis County, Texas", "48453", {
    housing: 18213,
    food: 4159,
    transportation: 8465,
    medical: 3075,
    civic: 2583,
    internetMobile: 1479,
    other: 4067,
  }),
  location("boston", "Boston, MA", "Suffolk County, Massachusetts", "25025", {
    housing: 29455,
    food: 5141,
    transportation: 5991,
    medical: 4257,
    civic: 3456,
    internetMobile: 2359,
    other: 4715,
  }),
];
export function applyLocation(s: Scenario, p: LocationPreset): Scenario {
  return { ...s, expenses: { ...p.expenses }, appliedLocation: p.id };
}
export function locationStatus(s: Scenario): string {
  const p = locationPresets.find((p) => p.id === s.appliedLocation);
  if (!p) return "Illustrative example";
  return Object.keys(p.expenses).every(
    (k) =>
      Number(s.expenses[k as keyof Categories]) ===
      Number(p.expenses[k as keyof Categories]),
  )
    ? `${p.label} · Minimum needs`
    : "Customized";
}
