import compensationData from "./compensation.json" with { type: "json" };
import locationBudgetData from "./locationBudgets.json" with { type: "json" };
import techPresetData from "./techPresets.json" with { type: "json" };
import { sourceDate } from "../lib/format";
import { categoryKeys, type Categories, type Scenario } from "../lib/model";

export const companies = techPresetData.techCompanies.map(({ name }) => name);
export const stages = compensationData.stages;
export const compensationRegions = compensationData.regions.map(({ scope }) => scope);
export const compensationSource = compensationData.source;
export const budgetSource = locationBudgetData.source;

type TreatmentOverride = Partial<typeof compensationData.defaultTreatment> & {
  vestingTemplate?: string;
  signOnYears?: number;
};
const companyTreatments: Partial<Record<string, TreatmentOverride>> = compensationData.overrides;

export interface CompensationPreset {
  id: string;
  company: string;
  stage: string;
  level: string;
  role: string;
  scope: string;
  base: number;
  stock: number;
  bonus: number;
  bonusProjection: number;
  bonusNote: string;
  stockKind: "annualized" | "first-year";
  stockGrantMultiplier: number;
  signOnYears?: number;
  vestingTemplate: string;
  statistic: string;
  source: string;
  accessed: string;
  reportedPeriod: string;
}

// Component values retain the precision shown in the public Levels.fyi tables.
export const compensationPresets: CompensationPreset[] = compensationData.snapshots.map((snapshot) => {
  const company = techPresetData.techCompanies.find(({ name }) => name === snapshot.company);
  const region = compensationData.regions.find(({ scope }) => scope === snapshot.scope);
  if (!company || !region) {
    throw new Error("Compensation snapshot references an unknown company or region");
  }
  const treatment = { ...compensationData.defaultTreatment, ...companyTreatments[company.id] };
  const { url, accessed, role, statistic } = compensationSource;
  return {
    ...snapshot,
    id: [company.id, snapshot.stage, region.slug].join("-"),
    role,
    statistic,
    bonusProjection: treatment.includeRecurringBonus ? snapshot.bonus : 0,
    bonusNote: treatment.bonusNote,
    stockKind: treatment.includeRecurringStock ? "annualized" : "first-year",
    stockGrantMultiplier: treatment.stockGrantMultiplier,
    signOnYears: treatment.signOnYears,
    vestingTemplate: treatment.vestingTemplate ?? company.defaultVestingTemplate,
    source: url + '/companies/' + company.id + '/salaries/software-engineer/locations/' + region.slug,
    accessed,
    reportedPeriod: compensationSource.name + ' public aggregate snapshot accessed ' + accessed + '; source update date is shown on the linked page',
  };
});

export function findCompensationPreset(company: string, stage: string, scope: string) {
  return compensationPresets.find(
    (preset) => preset.company === company && preset.stage === stage && preset.scope === scope,
  );
}

export function findCompensation(s: Scenario) {
  return findCompensationPreset(s.company, s.stage, s.compensationLocation);
}

export function findAppliedCompensation(id: string | null) {
  return compensationPresets.find(
    (preset) => preset.id === id || preset.company.toLowerCase() + '-' + preset.stage === id,
  );
}

export function compensationScopeForLocation(locationId: string): string {
  return compensationData.regions.find((region) => region.locationId === locationId)?.scope
    ?? compensationData.defaultScope;
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
export function compensationStatus(s: Scenario): string {
  const p = findAppliedCompensation(s.appliedCompensation);
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
export const locationPresets: LocationPreset[] = locationBudgetData.locations.map((location) => ({
  id: location.id,
  label: location.label,
  expenses: monthlyExpenses(location.annual),
  familyExpenses: monthlyExpenses(location.familyAnnual),
  annualPublished: location.annual,
  familyAnnualPublished: location.familyAnnual,
  scope: location.county,
  sourceYear: String(budgetSource.edition) + "; updated " + sourceDate(budgetSource.updated),
  accessed: budgetSource.accessed,
  source: budgetSource.url + '/counties/' + location.fips,
  kind: budgetSource.kind,
}));
export function applyLocation(s: Scenario, p: LocationPreset): Scenario {
  return { ...s, expenses: { ...p.expenses }, appliedLocation: p.id };
}
export function locationStatus(s: Scenario): string {
  const p = locationPresets.find((p) => p.id === s.appliedLocation);
  if (!p) return "Illustrative example";
  return categoryKeys.every(
    (key) => Number(s.expenses[key]) === Number(p.expenses[key]),
  )
    ? `${p.label} · Minimum needs`
    : "Customized";
}
