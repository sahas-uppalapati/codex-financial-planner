import type { TaxLocation, CareerEvent, EmployerMatch } from "../lib/planner";
import { monthLabel, uid } from "../lib/planner";

export interface CompanyPreset {
  id: string;
  name: string;
  ticker: string;
  defaultVestingTemplate: string;
  matchPolicy: {
    type: "unverified" | "percent_of_contribution" | "percent_of_pay";
    rate: number;
    payPercentCap?: number;
    dollarCap?: number;
    capBasis?: "half-basic-deferral-limit";
    vestingType?: "immediate" | "cliff-3";
    description: string;
    sourceStatus: "verified" | "existence-only" | "unverified";
    sourceTitle: string;
    sourceUrl: string;
    sourceYear?: number;
    verifiedOn: string;
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
  single: {
    rent: number;
    livingExpenses: number;
  };
  family: {
    rent: number;
    livingExpenses: number;
  };
}

export const techCompanies: CompanyPreset[] = [
  {
    id: "google",
    name: "Google",
    ticker: "GOOGL",
    defaultVestingTemplate: "google-quarterly",
    matchPolicy: {
      type: "unverified",
      rate: 0,
      description: "No current official match formula was verified; this estimate includes $0 match.",
      sourceStatus: "unverified",
      sourceTitle: "Google Careers benefits overview",
      sourceUrl: "https://careers.google.com/how-we-care-for-googlers/?hl=en-US",
      verifiedOn: "2026-11-09",
    },
  },
  {
    id: "meta",
    name: "Meta",
    ticker: "META",
    defaultVestingTemplate: "quarterly",
    matchPolicy: {
      type: "unverified",
      rate: 0,
      description: "No current official match formula was verified; this estimate includes $0 match.",
      sourceStatus: "unverified",
      sourceTitle: "Meta Careers benefits overview",
      sourceUrl: "https://www.metacareers.com/benefits",
      verifiedOn: "2026-11-09",
    },
  },
  {
    id: "amazon",
    name: "Amazon",
    ticker: "AMZN",
    defaultVestingTemplate: "amazon", // 5/15/45/35
    matchPolicy: {
      type: "percent_of_pay",
      rate: 50,
      payPercentCap: 4, // 50% on first 4% of pay = 2% total match
      vestingType: "cliff-3",
      description: "Published 2024 U.S. terms: 50% match on contributions up to 4% of eligible pay (2% of pay maximum); match vests after three years of vesting service. Confirm current plan terms.",
      sourceStatus: "verified",
      sourceTitle: "Amazon Benefits Overview for U.S. Employees",
      sourceUrl: "https://www.amazon.jobs/it/landing_pages/benefitsoverview-us",
      sourceYear: 2024,
      verifiedOn: "2026-11-09",
    },
  },
  {
    id: "apple",
    name: "Apple",
    ticker: "AAPL",
    defaultVestingTemplate: "semiannual",
    matchPolicy: {
      type: "unverified",
      rate: 0,
      description: "Apple confirms that its U.S. 401(k) includes matching, but does not publish the formula on this page; this estimate includes $0 match.",
      sourceStatus: "existence-only",
      sourceTitle: "Apple Employee Benefits",
      sourceUrl: "https://www.apple.com/careers/us/life-at-apple/benefits.html",
      verifiedOn: "2026-11-09",
    },
  },
  {
    id: "microsoft",
    name: "Microsoft",
    ticker: "MSFT",
    defaultVestingTemplate: "annual",
    matchPolicy: {
      type: "percent_of_contribution",
      rate: 50,
      capBasis: "half-basic-deferral-limit",
      vestingType: "immediate",
      description: "50% match on pretax/Roth contributions up to the annual basic employee deferral limit; matching contributions vest immediately.",
      sourceStatus: "verified",
      sourceTitle: "Microsoft 401(k) Savings Plan and contribution options",
      sourceUrl: "https://usbenefits.microsoft.com/us/en/401k-plan.html",
      sourceYear: 2026,
      verifiedOn: "2026-11-09",
    },
  },
];

export function employerMatchForCompany(company: CompanyPreset): EmployerMatch {
  const policy = company.matchPolicy;
  if (policy.type === "unverified") {
    return {
      type: "none",
      rate: "0",
      payPercent: "0",
      cap: "0",
      capBasis: "fixed",
      tiers: [],
      vestingType: "immediate",
      vestingSchedule: ["100"],
    };
  }
  return {
    type: "simple",
    rate: String(policy.rate),
    payPercent: String(policy.type === "percent_of_pay" ? policy.payPercentCap ?? 0 : 100),
    cap: String(policy.dollarCap ?? 0),
    capBasis: policy.capBasis ?? "fixed",
    tiers: [],
    vestingType: policy.vestingType ?? "immediate",
    vestingSchedule: policy.vestingType === "cliff-3" ? ["0", "0", "100"] : ["100"],
  };
}

export const techLevels: Record<string, TechLevelPreset[]> = {
  google: [
    { id: "l3", level: "L3", title: "L3 · Software Engineer II", stage: "entry", experienceYears: 2 },
    { id: "l4", level: "L4", title: "L4 · Software Engineer III", stage: "mid", experienceYears: 4 },
    { id: "l5", level: "L5", title: "L5 · Senior Software Engineer", stage: "senior", experienceYears: 7 },
    { id: "l6", level: "L6", title: "L6 · Staff Software Engineer", stage: "staff", experienceYears: 10 },
  ],
  meta: [
    { id: "e3", level: "E3", title: "E3 · Software Engineer", stage: "entry", experienceYears: 1.5 },
    { id: "e4", level: "E4", title: "E4 · Software Engineer", stage: "mid", experienceYears: 4 },
    { id: "e5", level: "E5", title: "E5 · Senior Software Engineer", stage: "senior", experienceYears: 8 },
    { id: "e6", level: "E6", title: "E6 · Staff Software Engineer", stage: "staff", experienceYears: 11 },
  ],
  amazon: [
    { id: "l4", level: "L4", title: "L4 · SDE I", stage: "entry", experienceYears: 2 },
    { id: "l5", level: "L5", title: "L5 · SDE II", stage: "mid", experienceYears: 5 },
    { id: "l6", level: "L6", title: "L6 · SDE III / Senior", stage: "senior", experienceYears: 9 },
    { id: "l7", level: "L7", title: "L7 · Principal SDE", stage: "staff", experienceYears: 13 },
  ],
  apple: [
    { id: "ict2", level: "ICT2", title: "ICT2 · Junior Engineer", stage: "entry", experienceYears: 2 },
    { id: "ict3", level: "ICT3", title: "ICT3 · Software Engineer", stage: "mid", experienceYears: 4.5 },
    { id: "ict4", level: "ICT4", title: "ICT4 · Senior Engineer", stage: "senior", experienceYears: 9 },
    { id: "ict5", level: "ICT5", title: "ICT5 · Staff / Lead", stage: "staff", experienceYears: 12 },
  ],
  microsoft: [
    { id: "sde", level: "59–60", title: "59–60 · SDE", stage: "entry", experienceYears: 2 },
    { id: "sde2", level: "61–62", title: "61–62 · SDE II", stage: "mid", experienceYears: 5 },
    { id: "senior", level: "63–64", title: "63–64 · Senior SDE", stage: "senior", experienceYears: 9 },
    { id: "principal", level: "65–66", title: "65–66 · Principal SDE", stage: "staff", experienceYears: 12 },
  ],
};

// Sourced median market comp points across major hubs
export const techCompensationTable: CompensationDataPoint[] = [
  // Google - SF Bay Area
  { companyId: "google", levelId: "l3", locationId: "san-francisco", base: 166000, annualRsu: 44000, bonus: 20000 },
  { companyId: "google", levelId: "l4", locationId: "san-francisco", base: 204000, annualRsu: 125000, bonus: 30000 },
  { companyId: "google", levelId: "l5", locationId: "san-francisco", base: 241000, annualRsu: 176000, bonus: 36000 },
  { companyId: "google", levelId: "l6", locationId: "san-francisco", base: 280000, annualRsu: 275000, bonus: 55000 },
  // Google - Seattle
  { companyId: "google", levelId: "l3", locationId: "seattle", base: 155000, annualRsu: 37000, bonus: 15000 },
  { companyId: "google", levelId: "l4", locationId: "seattle", base: 181000, annualRsu: 102000, bonus: 32000 },
  { companyId: "google", levelId: "l5", locationId: "seattle", base: 219000, annualRsu: 193000, bonus: 36000 },
  { companyId: "google", levelId: "l6", locationId: "seattle", base: 260000, annualRsu: 265000, bonus: 50000 },
  // Google - New York
  { companyId: "google", levelId: "l3", locationId: "new-york", base: 153000, annualRsu: 45000, bonus: 15000 },
  { companyId: "google", levelId: "l4", locationId: "new-york", base: 200000, annualRsu: 110000, bonus: 28000 },
  { companyId: "google", levelId: "l5", locationId: "new-york", base: 232000, annualRsu: 146000, bonus: 36000 },
  { companyId: "google", levelId: "l6", locationId: "new-york", base: 275000, annualRsu: 260000, bonus: 52000 },

  // Meta - SF Bay Area
  { companyId: "meta", levelId: "e3", locationId: "san-francisco", base: 147000, annualRsu: 36000, bonus: 12000 },
  { companyId: "meta", levelId: "e4", locationId: "san-francisco", base: 185000, annualRsu: 102000, bonus: 20000 },
  { companyId: "meta", levelId: "e5", locationId: "san-francisco", base: 231000, annualRsu: 225000, bonus: 35000 },
  { companyId: "meta", levelId: "e6", locationId: "san-francisco", base: 275000, annualRsu: 380000, bonus: 55000 },
  // Meta - Seattle
  { companyId: "meta", levelId: "e3", locationId: "seattle", base: 132000, annualRsu: 31000, bonus: 13000 },
  { companyId: "meta", levelId: "e4", locationId: "seattle", base: 183000, annualRsu: 86000, bonus: 17000 },
  { companyId: "meta", levelId: "e5", locationId: "seattle", base: 217000, annualRsu: 197000, bonus: 29000 },
  { companyId: "meta", levelId: "e6", locationId: "seattle", base: 260000, annualRsu: 350000, bonus: 50000 },
  // Meta - New York
  { companyId: "meta", levelId: "e3", locationId: "new-york", base: 148000, annualRsu: 28000, bonus: 12000 },
  { companyId: "meta", levelId: "e4", locationId: "new-york", base: 197000, annualRsu: 98000, bonus: 18000 },
  { companyId: "meta", levelId: "e5", locationId: "new-york", base: 222000, annualRsu: 159000, bonus: 25000 },
  { companyId: "meta", levelId: "e6", locationId: "new-york", base: 265000, annualRsu: 330000, bonus: 48000 },

  // Amazon - SF Bay Area
  { companyId: "amazon", levelId: "l4", locationId: "san-francisco", base: 136000, annualRsu: 29000, bonus: 0, signOnY1: 58000, signOnY2: 36000, grantTotal: 116000 },
  { companyId: "amazon", levelId: "l5", locationId: "san-francisco", base: 178000, annualRsu: 92000, bonus: 0, signOnY1: 50000, signOnY2: 30000 },
  { companyId: "amazon", levelId: "l6", locationId: "san-francisco", base: 218000, annualRsu: 166000, bonus: 0, signOnY1: 60000, signOnY2: 40000 },
  { companyId: "amazon", levelId: "l7", locationId: "san-francisco", base: 260000, annualRsu: 280000, bonus: 0, signOnY1: 70000, signOnY2: 50000 },
  // Amazon - Seattle
  { companyId: "amazon", levelId: "l4", locationId: "seattle", base: 129000, annualRsu: 27000, bonus: 0, signOnY1: 54000, signOnY2: 33000, grantTotal: 109000 },
  { companyId: "amazon", levelId: "l5", locationId: "seattle", base: 173000, annualRsu: 92000, bonus: 0, signOnY1: 50000, signOnY2: 30000 },
  { companyId: "amazon", levelId: "l6", locationId: "seattle", base: 211000, annualRsu: 168000, bonus: 0, signOnY1: 60000, signOnY2: 40000 },
  { companyId: "amazon", levelId: "l7", locationId: "seattle", base: 255000, annualRsu: 275000, bonus: 0, signOnY1: 70000, signOnY2: 50000 },

  // Apple - SF Bay Area
  { companyId: "apple", levelId: "ict2", locationId: "san-francisco", base: 149000, annualRsu: 27000, bonus: 8000 },
  { companyId: "apple", levelId: "ict3", locationId: "san-francisco", base: 177000, annualRsu: 69000, bonus: 12000 },
  { companyId: "apple", levelId: "ict4", locationId: "san-francisco", base: 221000, annualRsu: 135000, bonus: 24000 },
  { companyId: "apple", levelId: "ict5", locationId: "san-francisco", base: 265000, annualRsu: 240000, bonus: 35000 },

  // Microsoft - Seattle
  { companyId: "microsoft", levelId: "sde", locationId: "seattle", base: 125000, annualRsu: 23000, bonus: 7000 },
  { companyId: "microsoft", levelId: "sde2", locationId: "seattle", base: 154000, annualRsu: 27000, bonus: 10000 },
  { companyId: "microsoft", levelId: "senior", locationId: "seattle", base: 195000, annualRsu: 65000, bonus: 20000 },
  { companyId: "microsoft", levelId: "principal", locationId: "seattle", base: 240000, annualRsu: 130000, bonus: 35000 },
];

export const growthPresets: GrowthPreset[] = [
  {
    id: "conservative",
    label: "Conservative Baseline",
    shortLabel: "Conservative",
    icon: "",
    returns: 5,
    stockAppreciation: 0,
    inflation: 2.5,
    description: "5% portfolio return, 0% equity growth (flat stock)",
  },
  {
    id: "moderate",
    label: "Moderate (S&P 500 Index)",
    shortLabel: "S&P Index",
    icon: "",
    returns: 7,
    stockAppreciation: 5,
    inflation: 2.5,
    description: "7% portfolio return, 5% annual equity growth",
  },
  {
    id: "bull",
    label: "Tech Bull Market",
    shortLabel: "Tech Bull",
    icon: "",
    returns: 10,
    stockAppreciation: 10,
    inflation: 2.5,
    description: "10% portfolio return, 10% annual equity growth",
  },
];

export const housingPresets: Record<TaxLocation, HousingCostPreset> = {
  "san-francisco": {
    locationId: "san-francisco",
    label: "SF Bay Area",
    single: { rent: 2800, livingExpenses: 1700 }, // Total $4,500/mo
    family: { rent: 4800, livingExpenses: 3200 }, // Total $8,000/mo
  },
  seattle: {
    locationId: "seattle",
    label: "Seattle, WA",
    single: { rent: 2200, livingExpenses: 1600 }, // Total $3,800/mo
    family: { rent: 4000, livingExpenses: 3000 }, // Total $7,000/mo
  },
  "new-york": {
    locationId: "new-york",
    label: "New York City, NY",
    single: { rent: 3400, livingExpenses: 1600 }, // Total $5,000/mo
    family: { rent: 5600, livingExpenses: 3400 }, // Total $9,000/mo
  },
  austin: {
    locationId: "austin",
    label: "Austin, TX",
    single: { rent: 1800, livingExpenses: 1400 }, // Total $3,200/mo
    family: { rent: 3500, livingExpenses: 2500 }, // Total $6,000/mo
  },
  boston: {
    locationId: "boston",
    label: "Boston, MA",
    single: { rent: 2500, livingExpenses: 1700 }, // Total $4,200/mo
    family: { rent: 4500, livingExpenses: 3000 }, // Total $7,500/mo
  },
  columbus: {
    locationId: "columbus",
    label: "Columbus, OH (Midwest / National)",
    single: { rent: 1400, livingExpenses: 1400 }, // Total $2,800/mo
    family: { rent: 2600, livingExpenses: 2400 }, // Total $5,000/mo
  },
};

export function findTechCompPoint(
  companyId: string,
  levelId: string,
  locationId: TaxLocation,
): CompensationDataPoint {
  // Try exact match
  const exact = techCompensationTable.find(
    (p) => p.companyId === companyId && p.levelId === levelId && p.locationId === locationId,
  );
  if (exact) return exact;

  // Fallback to SF Bay Area baseline if available, with cost-of-labor adjustment
  const sfBaseline = techCompensationTable.find(
    (p) => p.companyId === companyId && p.levelId === levelId && p.locationId === "san-francisco",
  );
  if (sfBaseline) {
    const geoMultiplier = locationId === "seattle" ? 0.95 : locationId === "new-york" ? 1.0 : 0.88;
    return {
      companyId,
      levelId,
      locationId,
      base: Math.round(sfBaseline.base * geoMultiplier),
      annualRsu: Math.round(sfBaseline.annualRsu * geoMultiplier),
      bonus: Math.round(sfBaseline.bonus * geoMultiplier),
      signOnY1: sfBaseline.signOnY1 ? Math.round(sfBaseline.signOnY1 * geoMultiplier) : undefined,
      signOnY2: sfBaseline.signOnY2 ? Math.round(sfBaseline.signOnY2 * geoMultiplier) : undefined,
      grantTotal: sfBaseline.grantTotal ? Math.round(sfBaseline.grantTotal * geoMultiplier) : undefined,
    };
  }

  // Generic fallback if not in table
  return {
    companyId,
    levelId,
    locationId,
    base: 180000,
    annualRsu: 100000,
    bonus: 20000,
  };
}

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
