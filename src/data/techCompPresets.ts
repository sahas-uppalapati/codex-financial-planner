import techPresetData from "./techPresets.json" with { type: "json" };
import type { TaxLocation, CareerEvent } from "../lib/planner";
import { compensationPresets, locationPresets } from "./presets";
import type { Categories } from "../lib/model";
import { monthLabel, uid } from "../lib/planner";

export interface CompanyPreset {
  id: string;
  name: string;
  ticker: string;
  defaultVestingTemplate: string;
  matchPolicy: {
    type: "percent_of_contribution" | "percent_of_pay";
    rate: number;
    payPercentCap?: number;
    dollarCap?: number;
    description: string;
  };
}

export interface TechLevelPreset {
  id: string;
  level: string;
  title: string;
  stage: "entry" | "mid" | "senior" | "staff";
  experienceYears: number;
}

export interface CompensationDataPoint {
  companyId: string;
  levelId: string;
  locationId: TaxLocation;
  base: number;
  annualRsu: number;
  bonus: number;
  signOnY1?: number;
  signOnY2?: number;
  grantTotal?: number;
}

export interface GrowthPreset {
  id: "conservative" | "moderate" | "bull";
  label: string;
  shortLabel: string;
  icon: string;
  returns: number;
  stockAppreciation: number;
  inflation: number;
  description: string;
}

export interface HousingCostPreset {
  locationId: TaxLocation;
  label: string;
  single: Categories;
  family: Categories;
}

export const techCompanies: CompanyPreset[] = techPresetData.techCompanies as CompanyPreset[];

export const techLevels: Record<string, TechLevelPreset[]> = techPresetData.techLevels as Record<string, TechLevelPreset[]>;

// Compensation is derived from the curated, public Levels.fyi snapshots in compensation.json.
// Unsupported levels return no value; unsupported cities use a sourced U.S. baseline.
const companyNames: Record<string, string> = {
  google: "Google", meta: "Meta", amazon: "Amazon", apple: "Apple", microsoft: "Microsoft",
};
const compensationStages: Record<string, Record<string, "entry" | "mid" | "senior">> = {
  google: { l3: "entry", l4: "mid", l5: "senior" },
  meta: { e3: "entry", e4: "mid", e5: "senior" },
  amazon: { l4: "entry", l5: "mid", l6: "senior" },
  apple: { ict2: "entry", ict3: "mid", ict4: "senior" },
  microsoft: { sde: "entry", sde2: "mid" },
};
const cityScope: Partial<Record<TaxLocation, string>> = {
  "san-francisco": "San Francisco Bay Area",
  seattle: "Greater Seattle Area",
  "new-york": "New York City Area",
};

export function findTechCompPoint(
  companyId: string,
  levelId: string,
  locationId: TaxLocation,
): CompensationDataPoint | undefined {
  const company = companyNames[companyId];
  const stage = compensationStages[companyId]?.[levelId];
  if (!company || !stage) return undefined;
  const scope = cityScope[locationId] ?? "United States";
  const preset = compensationPresets.find(
    (item) => item.company === company && item.stage === stage && item.scope === scope,
  );
  if (!preset) return undefined;
  return {
    companyId,
    levelId,
    locationId,
    base: preset.base,
    // Google's public table reports first-year stock and combined bonus/sign-on;
    // neither is treated as recurring compensation in this planner.
    annualRsu: preset.stockKind === "annualized" ? preset.stock : 0,
    bonus: preset.bonusProjection,
    grantTotal: preset.stockKind === "annualized" ? preset.stock * 4 : 0,
  };
}

export const growthPresets: GrowthPreset[] = techPresetData.growthPresets as GrowthPreset[];

// Reuse the sourced cost-of-living budgets for one adult or two adults with
// one worker and no children. No hand-estimated rent or geographic multiplier.
export const housingPresets = Object.fromEntries(
  locationPresets.map((preset) => [
    preset.id,
    {
      locationId: preset.id as TaxLocation,
      label: preset.label,
      single: preset.expenses,
      family: preset.familyExpenses,
    },
  ]),
) as Record<TaxLocation, HousingCostPreset>;

export interface TechProgressionStep {
  levelId: string;
  levelName: string;
  title: string;
  stage: "entry" | "mid" | "senior" | "staff";
  monthsFromStart: number;
  yearsFromStart: number;
  yearsFromPrev: number;
  monthLabel: string;
  base: number;
  bonus: number;
  annualRsu: number;
  totalComp: number;
  compDelta: number;
  isCurrent: boolean;
}

/**
 * Returns the timeline of promotion steps from the current level onward
 * based on industry average years-of-experience progression.
 */
export function getTechProgressionTimeline(
  companyId: string,
  currentLevelId: string,
  locationId: TaxLocation,
  startYear: number = 2026,
  horizonYears: number = 10,
): TechProgressionStep[] {
  const levels = techLevels[companyId] || techLevels.google;
  const currentIndex = levels.findIndex((l) => l.id === currentLevelId);
  if (currentIndex < 0) return [];

  const currentLevel = levels[currentIndex];
  const currentComp = findTechCompPoint(companyId, currentLevel.id, locationId);
  if (!currentComp) return [];
  const currentTc = currentComp.base + currentComp.bonus + currentComp.annualRsu;

  const steps: TechProgressionStep[] = [
    {
      levelId: currentLevel.id,
      levelName: currentLevel.level,
      title: currentLevel.title,
      stage: currentLevel.stage,
      monthsFromStart: 0,
      yearsFromStart: 0,
      yearsFromPrev: 0,
      monthLabel: monthLabel(0, startYear),
      base: currentComp.base,
      bonus: currentComp.bonus,
      annualRsu: currentComp.annualRsu,
      totalComp: currentTc,
      compDelta: 0,
      isCurrent: true,
    },
  ];

  let elapsedMonths = 0;
  let prevExp = currentLevel.experienceYears;
  let prevTc = currentTc;

  for (let i = currentIndex + 1; i < levels.length; i++) {
    const nextLevel = levels[i];
    const deltaMonths = Math.max(1, Math.round((nextLevel.experienceYears - prevExp) * 12));
    elapsedMonths += deltaMonths;
    if (elapsedMonths >= horizonYears * 12) break;

    const nextComp = findTechCompPoint(companyId, nextLevel.id, locationId);
    if (!nextComp) break;
    const nextTc = nextComp.base + nextComp.bonus + nextComp.annualRsu;
    const yearsFromStart = Math.round((elapsedMonths / 12) * 10) / 10;
    const yearsFromPrev = Math.round((deltaMonths / 12) * 10) / 10;

    steps.push({
      levelId: nextLevel.id,
      levelName: nextLevel.level,
      title: nextLevel.title,
      stage: nextLevel.stage,
      monthsFromStart: elapsedMonths,
      yearsFromStart,
      yearsFromPrev,
      monthLabel: monthLabel(elapsedMonths, startYear),
      base: nextComp.base,
      bonus: nextComp.bonus,
      annualRsu: nextComp.annualRsu,
      totalComp: nextTc,
      compDelta: nextTc - prevTc,
      isCurrent: false,
    });

    prevExp = nextLevel.experienceYears;
    prevTc = nextTc;
  }

  return steps;
}

/**
 * Builds CareerEvent promotions for 1-click tech presets based on standard promotion intervals.
 * Automatically respects manual events and truncates at any manual collision.
 */
export function buildTechProgressionEvents(
  companyId: string,
  levelId: string,
  locationId: TaxLocation,
  employerId: string,
  startYear: number = 2026,
  horizonYears: number = 10,
  existingEvents: CareerEvent[] = [],
  growth: string = "0",
): CareerEvent[] {
  const company = techCompanies.find((c) => c.id === companyId) || techCompanies[0];
  const levels = techLevels[companyId] || techLevels.google;
  const currentIndex = levels.findIndex((l) => l.id === levelId);
  if (currentIndex < 0 || currentIndex >= levels.length - 1) {
    // Terminal level or unknown: keep only manual events
    return existingEvents.filter((e) => !e.presetProgression);
  }

  const currentLevel = levels[currentIndex];
  let elapsedMonths = 0;
  let prevExp = currentLevel.experienceYears;
  const proposed: CareerEvent[] = [];

  for (let i = currentIndex + 1; i < levels.length; i++) {
    const nextLevel = levels[i];
    const deltaMonths = Math.max(1, Math.round((nextLevel.experienceYears - prevExp) * 12));
    elapsedMonths += deltaMonths;
    if (elapsedMonths >= horizonYears * 12) break;

    const nextComp = findTechCompPoint(companyId, nextLevel.id, locationId);
    if (!nextComp) break;
    const awardValue = nextComp.annualRsu * 4;

    proposed.push({
      id: uid(),
      kind: "promotion",
      month: monthLabel(elapsedMonths, startYear),
      issuerId: employerId,
      role: `${nextLevel.title} at ${company.name}`,
      base: String(nextComp.base),
      bonus: String(nextComp.bonus),
      growth,
      awardValue: String(awardValue),
      awardTemplate: company.defaultVestingTemplate,
      awardTreatment: "sell",
      refresherValue: "0",
      refresherAfter: "12",
      refresherEvery: "12",
      refresherTemplate: "annual",
      refresherTreatment: "sell",
      presetProgression: company.id,
    });

    prevExp = nextLevel.experienceYears;
  }

  const manualEvents = existingEvents.filter((e) => !e.presetProgression);
  const collision = proposed.findIndex((event) =>
    manualEvents.some((manual) => manual.month <= event.month),
  );
  const generated = proposed.slice(0, collision < 0 ? proposed.length : collision);
  return [...manualEvents, ...generated].sort((a, b) => a.month.localeCompare(b.month));
}
