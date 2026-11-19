import compensationData from "./compensation.json";
import locationBudgetData from "./locationBudgets.json";
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
// Manually curated from Levels.fyi's public "Average Compensation By Level" tables.
// Values retain the precision shown publicly (components are rounded); these are not offer quotes.
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
  accessed: "2026-11-17",
  reportedPeriod: "Levels.fyi public aggregate snapshot accessed 2026-11-17; source update date is shown on the linked page",
});
export const compensationPresets: CompensationPreset[] = compensationData.map(({ company, stage, level, base, stock, bonus, scope }) =>
  snapshot(company, stage, level, base, stock, bonus, scope as CompensationPreset["scope"]),
);
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
  const recurringStock = p.stockKind === "annualized" ? p.stock : 0;
  return {
    ...s,
    base: String(p.base),
    bonus: String(p.bonusProjection),
    stock: String(recurringStock),
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
  const p = compensationPresets.find(
    (p) =>
      p.id === s.appliedCompensation ||
      `${p.company.toLowerCase()}-${p.stage}` === s.appliedCompensation,
  );
  if (!p) return "Manual entry";
  return Number(s.base) === p.base &&
    Number(s.bonus) === p.bonusProjection &&
    Number(s.stock) === (p.stockKind === "annualized" ? p.stock : 0)
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
  familyExpenses: Categories;
  annualPublished: AnnualBudget;
  familyAnnualPublished: AnnualBudget;
  scope: string;
  sourceYear: string;
  accessed: string;
  source: string;
  kind: string;
}
// Seven manually curated county references fall within the source FAQ's <=10-location allowance.
// Monthly fields for both household types are derived from annual categories and rounded to cents.
const monthlyExpenses = (annual: AnnualBudget): Categories => ({
  housing: ((annual.housing + annual.internetMobile) / 12).toFixed(2),
  food: (annual.food / 12).toFixed(2),
  transportation: (annual.transportation / 12).toFixed(2),
  healthcare: (annual.medical / 12).toFixed(2),
  other: ((annual.civic + annual.other) / 12).toFixed(2),
});
const location = (
  id: string,
  label: string,
  county: string,
  fips: string,
  annual: AnnualBudget,
  familyAnnual: AnnualBudget,
  accessed = "2026-11-17",
): LocationPreset => ({
  id,
  label,
  expenses: monthlyExpenses(annual),
  familyExpenses: monthlyExpenses(familyAnnual),
  annualPublished: annual,
  familyAnnualPublished: familyAnnual,
  scope: county,
  sourceYear: "2026; updated February 15, 2026",
  accessed,
  source: `https://livingwage.mit.edu/counties/${fips}`,
  kind: "Derived minimum-needs budget",
});
export const locationPresets = locationBudgetData.map(({ id, label, county, fips, annual, familyAnnual }) =>
  location(id, label, county, fips, annual, familyAnnual),
);
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
