import type { Categories, Scenario } from "../lib/model";
import type { CareerEvent, ScenarioV2 } from "../lib/planner";
import { monthLabel, uid } from "../lib/planner";
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
export const compensationRegions = [
  "United States",
  "San Francisco Bay Area",
  "Greater Seattle Area",
  "New York City Area",
] as const;
export interface CompensationPreset {
  id: string;
  company: string;
  stage: string;
  level: string;
  role: "Software engineer";
  scope: (typeof compensationRegions)[number];
  base: number;
  stock: number;
  bonus: number;
  bonusProjection: number;
  bonusNote: string;
  stockKind: "annualized" | "first-year";
  stockGrantMultiplier: number;
  vestingTemplate: string;
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
  scope: CompensationPreset["scope"] = "United States",
): CompensationPreset => ({
  id: `${company.toLowerCase()}-${stage}-${scope.toLowerCase().replaceAll(" ", "-")}`,
  company,
  stage,
  level,
  role: "Software engineer",
  scope,
  base,
  stock,
  bonus,
  bonusProjection: company === "Amazon" || company === "Google" ? 0 : bonus,
  bonusNote:
    company === "Amazon"
      ? "The published bonus average is sign-on bonus spread across four years; excluded from recurring projected cash."
      : company === "Google"
        ? "The published bonus combines annual bonus and sign-on; not modeled as recurring without a verified split."
        : "Published annual bonus average; may include an annualized sign-on component.",
  stockKind: company === "Google" ? "first-year" : "annualized",
  stockGrantMultiplier: company === "Google" ? 0 : 4,
  vestingTemplate:
    company === "Meta"
      ? "quarterly"
      : company === "Apple"
        ? "semiannual"
        : company === "Amazon"
          ? "amazon-annual"
          : company === "Google"
            ? "google"
            : "annual",
  statistic: "Reported average",
  source: `https://www.levels.fyi/companies/${company.toLowerCase()}/salaries/software-engineer${scope === "United States" ? "/locations/united-states" : `/locations/${scope === "San Francisco Bay Area" ? "san-francisco-bay-area" : scope === "Greater Seattle Area" ? "greater-seattle-area" : "new-york-city-area"}`}`,
  accessed: "2026-10-27",
  reportedPeriod: `Public aggregate snapshot; source updated ${company === "Apple" ? "2026-10-25" : "2026-10-26"}; submission window not stated`,
});
export const compensationPresets: CompensationPreset[] = [
  // United States: current public Average Compensation By Level snapshots.
  snapshot("Meta", "entry", "E3", 146000, 32000, 9200),
  snapshot("Meta", "mid", "E4", 185000, 103000, 17700),
  snapshot("Meta", "senior", "E5", 226000, 208000, 25000),
  snapshot("Microsoft", "entry", "59 · SDE", 129000, 23300, 17700),
  snapshot("Microsoft", "mid", "61 · SDE II", 158000, 28900, 17700),
  snapshot("Amazon", "entry", "L4 · SDE I", 137000, 31100, 13800),
  snapshot("Amazon", "mid", "L5 · SDE II", 178000, 92200, 3500),
  snapshot("Amazon", "senior", "L6 · SDE III", 218000, 166000, 1600),
  snapshot("Apple", "entry", "ICT2 · Junior software engineer", 142000, 25300, 4000),
  snapshot("Apple", "mid", "ICT3 · Software engineer", 172000, 66000, 12700),
  snapshot("Apple", "senior", "ICT4 · Senior software engineer", 216000, 134000, 22900),
  snapshot("Google", "entry", "L3 · SWE II", 156000, 43800, 14300),
  snapshot("Google", "mid", "L4 · SWE III", 194000, 96700, 23600),
  snapshot("Google", "senior", "L5 · Senior SWE", 232000, 175000, 29800),
  // San Francisco Bay Area.
  snapshot("Meta", "entry", "E3", 147000, 36400, 11700, "San Francisco Bay Area"),
  snapshot("Meta", "mid", "E4", 185000, 102000, 20300, "San Francisco Bay Area"),
  snapshot("Meta", "senior", "E5", 231000, 225000, 25900, "San Francisco Bay Area"),
  snapshot("Google", "entry", "L3 · SWE II", 166000, 44300, 20100, "San Francisco Bay Area"),
  snapshot("Google", "mid", "L4 · SWE III", 204000, 125000, 30900, "San Francisco Bay Area"),
  snapshot("Google", "senior", "L5 · Senior SWE", 241000, 176000, 25000, "San Francisco Bay Area"),
  snapshot("Apple", "entry", "ICT2 · Junior software engineer", 149000, 27400, 7700, "San Francisco Bay Area"),
  snapshot("Apple", "mid", "ICT3 · Software engineer", 177000, 69100, 12000, "San Francisco Bay Area"),
  snapshot("Apple", "senior", "ICT4 · Senior software engineer", 221000, 135000, 24100, "San Francisco Bay Area"),
  snapshot("Amazon", "entry", "L4 · SDE I", 141000, 32500, 9600, "San Francisco Bay Area"),
  snapshot("Microsoft", "entry", "59 · SDE", 135000, 25600, 15300, "San Francisco Bay Area"),
  snapshot("Microsoft", "mid", "61 · SDE II", 169000, 29700, 14100, "San Francisco Bay Area"),
  // Greater Seattle Area.
  snapshot("Meta", "entry", "E3", 132000, 31400, 12900, "Greater Seattle Area"),
  snapshot("Meta", "mid", "E4", 183000, 85700, 16700, "Greater Seattle Area"),
  snapshot("Meta", "senior", "E5", 217000, 197000, 29100, "Greater Seattle Area"),
  snapshot("Google", "entry", "L3 · SWE II", 155000, 36900, 14400, "Greater Seattle Area"),
  snapshot("Google", "mid", "L4 · SWE III", 181000, 102000, 32800, "Greater Seattle Area"),
  snapshot("Google", "senior", "L5 · Senior SWE", 219000, 193000, 36800, "Greater Seattle Area"),
  snapshot("Amazon", "entry", "L4 · SDE I", 134000, 31700, 16400, "Greater Seattle Area"),
  snapshot("Amazon", "mid", "L5 · SDE II", 173000, 92200, 3600, "Greater Seattle Area"),
  snapshot("Amazon", "senior", "L6 · SDE III", 211000, 168000, 2800, "Greater Seattle Area"),
  snapshot("Apple", "entry", "ICT2 · Junior software engineer", 125000, 28200, 9200, "Greater Seattle Area"),
  snapshot("Apple", "mid", "ICT3 · Software engineer", 172000, 59200, 18500, "Greater Seattle Area"),
  snapshot("Apple", "senior", "ICT4 · Senior software engineer", 219000, 142000, 20000, "Greater Seattle Area"),
  snapshot("Microsoft", "entry", "59 · SDE", 125000, 23000, 6900, "Greater Seattle Area"),
  snapshot("Microsoft", "mid", "61 · SDE II", 154000, 27200, 8400, "Greater Seattle Area"),
  // New York City Area.
  snapshot("Meta", "entry", "E3", 148000, 27500, 4500, "New York City Area"),
  snapshot("Meta", "mid", "E4", 197000, 98200, 17500, "New York City Area"),
  snapshot("Meta", "senior", "E5", 222000, 159000, 19800, "New York City Area"),
  snapshot("Google", "entry", "L3 · SWE II", 153000, 45300, 7500, "New York City Area"),
  snapshot("Google", "mid", "L4 · SWE III", 200000, 72700, 5600, "New York City Area"),
  snapshot("Google", "senior", "L5 · Senior SWE", 232000, 146000, 36000, "New York City Area"),
  snapshot("Amazon", "entry", "L4 · SDE I", 152000, 30700, 9800, "New York City Area"),
  snapshot("Amazon", "mid", "L5 · SDE II", 186000, 106000, 0, "New York City Area"),
  snapshot("Amazon", "senior", "L6 · SDE III", 223000, 176000, 8600, "New York City Area"),
  snapshot("Apple", "entry", "ICT2 · Junior software engineer", 133000, 19100, 2400, "New York City Area"),
  snapshot("Apple", "mid", "ICT3 · Software engineer", 167000, 45900, 9300, "New York City Area"),
  snapshot("Apple", "senior", "ICT4 · Senior software engineer", 221000, 139000, 15200, "New York City Area"),
  snapshot("Microsoft", "entry", "59 · SDE", 135000, 23700, 8400, "New York City Area"),
  snapshot("Microsoft", "mid", "61 · SDE II", 166000, 28800, 9500, "New York City Area"),
];
export const levelMappings: Record<string, string[]> = {
  Google: ["L3 · SWE II", "L4 · SWE III", "L5 · Senior SWE"],
  Meta: ["E3", "E4", "E5"],
  Amazon: ["L4 · SDE I", "L5 · SDE II", "L6 · SDE III"],
  Microsoft: ["59–60 · SDE", "61–62 · SDE II", "63–64 · Senior SDE"],
  Apple: ["ICT2", "ICT3", "ICT4"],
};
// Levels.fyi community analysis of 40,000 submissions; mean years of experience
// by its normalized levels. These are cross-sectional averages, not promotion dates.
export const levelExperience: Record<string, number[]> = {
  Meta: [1.5, 4.02, 8.39],
  Google: [3.11, 5.52, 9.36],
  Apple: [2.03, 4.17, 9.45],
  Amazon: [2.09, 6.26, 11.3],
};
export const levelExperienceSource =
  "https://www.levels.fyi/community/thread/M5XW4v/average-yoe-vs-level-at-faang";
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
    bonus: String(p.bonusProjection),
    stock: String(p.stock),
    appliedCompensation: p.id,
  };
}
export function compensationProgressionEvents(
  s: ScenarioV2,
  preset: CompensationPreset,
  startYear: number,
  horizonYears: number,
): CareerEvent[] {
  const stagesFromCurrent = stages.slice(
    stages.findIndex((stage) => stage.id === preset.stage) + 1,
  );
  const experience = levelExperience[preset.company];
  if (!experience) return [];
  let elapsedMonths = 0,
    previousIndex = stages.findIndex((stage) => stage.id === preset.stage);
  const events: CareerEvent[] = [];
  for (const stage of stagesFromCurrent) {
    const index = stages.findIndex((item) => item.id === stage.id),
      nextPreset = compensationPresets.find(
        (item) => item.company === preset.company && item.stage === stage.id && item.scope === preset.scope,
      );
    if (!nextPreset || experience[index] === undefined) break;
    elapsedMonths += Math.max(
      1,
      Math.round((experience[index] - experience[previousIndex]) * 12),
    );
    if (elapsedMonths >= horizonYears * 12) break;
    events.push({
      id: uid(),
      kind: "promotion",
      month: monthLabel(elapsedMonths, startYear),
      issuerId: s.employerId,
      role: `${preset.company} ${nextPreset.level} · Software engineer`,
      base: String(nextPreset.base),
      bonus: String(nextPreset.bonusProjection),
      growth: s.growth,
      awardValue: String(nextPreset.stock * nextPreset.stockGrantMultiplier),
      awardTemplate: nextPreset.vestingTemplate,
      awardTreatment: "sell",
      refresherValue: "0",
      refresherAfter: "12",
      refresherEvery: "12",
      refresherTemplate: "annual",
      refresherTreatment: "sell",
      presetProgression: preset.company,
    });
    previousIndex = index;
  }
  return events;
}
export function hasCompensationProgression(preset: CompensationPreset): boolean {
  const stageIndex = stages.findIndex((stage) => stage.id === preset.stage);
  return Boolean(
    levelExperience[preset.company] &&
      stages.slice(stageIndex + 1).some((stage) =>
        compensationPresets.some(
          (item) => item.company === preset.company && item.stage === stage.id && item.scope === preset.scope,
        ),
      ),
  );
}
export function compensationStatus(s: Scenario): string {
  const p = compensationPresets.find((p) => p.id === s.appliedCompensation);
  if (!p) return "Manual entry";
  return Number(s.base) === p.base &&
    Number(s.bonus) === p.bonusProjection &&
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
