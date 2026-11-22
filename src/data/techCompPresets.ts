import techPresetData from "./techPresets.json" with { type: "json" };
import type { TaxLocation, CareerEvent } from "../lib/planner";
import { compensationScopeForLocation, findCompensationPreset, locationPresets } from "./presets";
import type { Categories } from "../lib/model";
import { immediateEmployerMatch, monthLabel, uid } from "../lib/planner";

export interface CompanyPreset {
  id: string;
  name: string;
  ticker: string;
  headquartersLocation: TaxLocation;
  defaultVestingTemplate: string;
  supportsProgression?: boolean;
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
  hasCompensation?: boolean;
  promotionMonthsFromPrevious?: number;
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
  usesRoundedInputs?: boolean;
}

export interface GrowthPreset {
  id: "conservative" | "moderate" | "bull";
  label: string;
  shortLabel: string;
  icon: string;
  returns: number;
  minimumReturn: number | null;
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
export const techCompensationScope = compensationScopeForLocation;

export function findTechCompPoint(
  companyId: string,
  levelId: string,
  locationId: TaxLocation,
): CompensationDataPoint | undefined {
  const company = techCompanies.find((item) => item.id === companyId);
  if (!company) return undefined;
  const level = techLevels[company.id]?.find((item) => item.id === levelId);
  if (!level || level.hasCompensation === false) return undefined;
  const scope = techCompensationScope(locationId);
  const preset = findCompensationPreset(company.name, level.stage, scope);
  if (!preset) return undefined;
  const override = techPresetData.compensationOverrides.find(
    (entry) => entry.companyId === companyId && entry.levelId === levelId && entry.scope === scope,
  );
  // Levels.fyi reports Amazon sign-on averaged over four years, not the
  // individual payments. Split that total to offset the 5%/15% vest gap,
  // before raises, as an explicitly illustrative estimate.
  const signOnTotal = preset.bonus * (preset.signOnYears ?? 0);
  const signOnY1 = signOnTotal > 0 ? Math.min(signOnTotal, (signOnTotal + preset.stock * 0.4) / 2) : undefined;
  const signOnY2 = signOnY1 === undefined ? undefined : signOnTotal - signOnY1;
  return {
    companyId,
    levelId,
    locationId,
    base: override?.base ?? preset.base,
    // Google's public table reports first-year stock and combined bonus/sign-on;
    // neither is treated as recurring compensation in this planner.
    annualRsu: override ? override.grantTotal / 4 : preset.stockKind === "annualized" ? preset.stock : 0,
    bonus: preset.bonusProjection,
    signOnY1: override?.year1SignOn ?? signOnY1,
    signOnY2: override?.year2SignOn ?? signOnY2,
    grantTotal: override?.grantTotal ?? (preset.stock * preset.stockGrantMultiplier),
    usesRoundedInputs: Boolean(override),
  };
}

export const quickOffer = techPresetData.quickOffer;

export const growthPresets: GrowthPreset[] = techPresetData.growthPresets as GrowthPreset[];

export function growthPresetForReturn(annualReturn: number): GrowthPreset {
  return growthPresets.reduce(
    (selected, preset) => preset.minimumReturn !== null && annualReturn >= preset.minimumReturn
      ? preset
      : selected,
    growthPresets[0],
  );
}

export function companyEmployerMatch({ matchPolicy }: CompanyPreset) {
  return immediateEmployerMatch(
    String(matchPolicy.rate),
    String(matchPolicy.payPercentCap ?? 100),
    String(matchPolicy.dollarCap ?? 0),
  );
}

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

function upcomingPromotions(
  company: CompanyPreset,
  currentLevelId: string,
  locationId: TaxLocation,
  horizonYears: number,
) {
  const levels = techLevels[company.id] ?? [];
  const currentIndex = levels.findIndex((level) => level.id === currentLevelId);
  const promotions: { level: TechLevelPreset; comp: CompensationDataPoint; elapsedMonths: number; deltaMonths: number }[] = [];
  if (currentIndex < 0 || company.supportsProgression === false) return promotions;

  let elapsedMonths = 0;
  for (let i = currentIndex + 1; i < levels.length; i++) {
    const level = levels[i];
    const deltaMonths = level.promotionMonthsFromPrevious ?? Math.max(
      1, Math.round((level.experienceYears - levels[i - 1].experienceYears) * 12),
    );
    elapsedMonths += deltaMonths;
    if (elapsedMonths >= horizonYears * 12) break;
    const comp = findTechCompPoint(company.id, level.id, locationId);
    if (!comp) break;
    promotions.push({ level, comp, elapsedMonths, deltaMonths });
  }
  return promotions;
}

const totalComp = ({ base, bonus, annualRsu }: CompensationDataPoint) => base + bonus + annualRsu;
const roundedYears = (months: number) => Math.round((months / 12) * 10) / 10;

/** Returns sourced progression steps from the selected level onward. */
export function getTechProgressionTimeline(
  companyId: string,
  currentLevelId: string,
  locationId: TaxLocation,
  startYear: number = 2026,
  horizonYears: number = 10,
): TechProgressionStep[] {
  const company = techCompanies.find(({ id }) => id === companyId);
  if (!company) return [];
  const current = techLevels[company.id]?.find(({ id }) => id === currentLevelId);
  const currentComp = findTechCompPoint(company.id, currentLevelId, locationId);
  if (!current || !currentComp) return [];

  let previousTotal = totalComp(currentComp);
  const steps = [
    { level: current, comp: currentComp, elapsedMonths: 0, deltaMonths: 0 },
    ...upcomingPromotions(company, currentLevelId, locationId, horizonYears),
  ];
  return steps.map(({ level, comp, elapsedMonths, deltaMonths }, index) => {
    const total = totalComp(comp);
    const compDelta = total - previousTotal;
    previousTotal = total;
    return {
      levelId: level.id,
      levelName: level.level,
      title: level.title,
      stage: level.stage,
      monthsFromStart: elapsedMonths,
      yearsFromStart: roundedYears(elapsedMonths),
      yearsFromPrev: roundedYears(deltaMonths),
      monthLabel: monthLabel(elapsedMonths, startYear),
      base: comp.base,
      bonus: comp.bonus,
      annualRsu: comp.annualRsu,
      totalComp: total,
      compDelta,
      isCurrent: index === 0,
    };
  });
}

/** Builds preset promotions up to the first manually entered career event. */
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
  const manualEvents = existingEvents.filter((event) => !event.presetProgression);
  const company = techCompanies.find(({ id }) => id === companyId);
  if (!company) return manualEvents;
  const promotions = upcomingPromotions(company, levelId, locationId, horizonYears);
  if (!promotions.length) return manualEvents;

  const generated: CareerEvent[] = [];
  for (const { level, comp, elapsedMonths } of promotions) {
    const month = monthLabel(elapsedMonths, startYear);
    if (manualEvents.some((event) => event.month <= month)) break;
    generated.push({
      id: uid(),
      kind: "promotion",
      month,
      issuerId: employerId,
      role: level.title + ' at ' + company.name,
      base: String(comp.base),
      bonus: String(comp.bonus),
      growth,
      awardValue: "0",
      promotionTargetTc: comp.annualRsu > 0 ? String(totalComp(comp)) : undefined,
      awardTemplate: company.defaultVestingTemplate,
      awardTreatment: "sell",
      refresherValue: "0",
      refresherAfter: "12",
      refresherEvery: "12",
      refresherTemplate: "annual",
      refresherTreatment: "sell",
      presetProgression: company.id,
    });
  }
  return [...manualEvents, ...generated].sort((a, b) => a.month.localeCompare(b.month));
}
