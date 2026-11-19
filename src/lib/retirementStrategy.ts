import type {
  AssumptionsV2,
  Benefits,
  RetirementTargets,
  ScenarioV2,
} from "./planner";
import {
  annualAge,
  annualRetirementLimits,
  calculateEmployerMatch,
  definedContributionRoom,
  employeeDeferralLimit,
  iraEligibility,
  requiredEmployeeRateForFullMatch,
} from "./retirement";
import { calculateTaxes } from "./tax";
import type { WorkerTaxInput } from "./tax";
import { monthlyExpenses } from "./model";

export type TaxStrategyPreference = "traditional" | "roth" | "auto" | "balanced";

export interface RetirementStrategyConfig {
  targetSavings: number;
  taxPreference: TaxStrategyPreference;
  enableBackdoor: boolean;
  enableMegaBackdoor: boolean;
}

export interface WaterfallTier {
  id: "match" | "hsa" | "ira" | "unmatched-401k" | "mega-backdoor" | "taxable";
  name: string;
  accountType: string;
  description: string;
  taxAdvantage: string;
  maxCap: number;
  allocated: number;
  effectiveMatchCaptured?: number;
  details: string;
  status: "filled" | "partial" | "skipped" | "ineligible";
}

export interface StrategyComparison {
  current: {
    total401k: number;
    percent401k: number;
    traditional401k: number;
    roth401k: number;
    matchCaptured: number;
    maxPotentialMatch: number;
    hsa: number;
    ira: number;
    megaBackdoor: number;
    taxable: number;
    totalRetirementSaved: number;
    estimatedCashTaxSavings: number;
  };
  strategy: {
    total401k: number;
    percent401k: number;
    traditional401k: number;
    roth401k: number;
    traditionalSharePercent: number;
    rothSharePercent: number;
    matchCaptured: number;
    maxPotentialMatch: number;
    hsa: number;
    ira: number;
    iraType: "traditional" | "roth" | "backdoor" | "none";
    megaBackdoor: number;
    taxable: number;
    totalRetirementSaved: number;
    estimatedCashTaxSavings: number;
  };
  deltas: {
    matchDifference: number;
    taxAdvantagedDifference: number;
    taxSavingsDifference: number;
    totalSavingsDifference: number;
  };
}

export interface StrategyPresetOption {
  id: "match-only" | "match-hsa" | "match-hsa-ira" | "max-401k" | "max-all" | "surplus";
  label: string;
  amount: number;
  description: string;
}

export interface RetirementStrategyResult {
  tiers: WaterfallTier[];
  totalAllocated: number;
  targetSavings: number;
  unallocated: number;
  recommendedTaxPreference: "traditional" | "roth";
  marginalTaxRate: number;
  comparison: StrategyComparison;
}

/**
 * Estimates the combined marginal tax rate (Federal + State) on base salary.
 */
export function calculateMarginalTaxRate(
  scenario: ScenarioV2,
  assumptions: AssumptionsV2,
): number {
  const base = Math.max(0, Number(scenario.base) || 0);
  if (base <= 0) return 0;
  const year = Number(assumptions.startYear) || 2026;
  const inflation = Number(assumptions.taxInflation) || 0;
  const delta = Math.min(1000, base);

  const t1 = calculateTaxes(
    [{ cash: base, stock: 0, retirement: 0, health: 0, hsa: 0 }],
    scenario.taxProfile,
    year,
    inflation,
  );
  const t2 = calculateTaxes(
    [{ cash: Math.max(0, base - delta), stock: 0, retirement: 0, health: 0, hsa: 0 }],
    scenario.taxProfile,
    year,
    inflation,
  );

  const diff = t1.total - t2.total;
  return Math.max(0, Math.min(0.65, diff / delta));
}

/**
 * Estimates uncommitted net cash surplus (gross cash minus baseline taxes and living costs).
 */
export function estimateNetCashSurplus(
  scenario: ScenarioV2,
  assumptions: AssumptionsV2,
): number {
  const base = Math.max(0, Number(scenario.base) || 0);
  const bonus = Math.max(0, Number(scenario.bonus) || 0);
  const signOn = Math.max(0, Number(scenario.signOnY1) || 0);
  const cashGross = base + bonus + signOn;
  if (cashGross <= 0) return 0;

  const year = Number(assumptions.startYear) || 2026;
  const inflation = Number(assumptions.taxInflation) || 0;

  const baselineTax = calculateTaxes(
    [{ cash: cashGross, stock: 0, retirement: 0, health: 0, hsa: 0 }],
    scenario.taxProfile,
    year,
    inflation,
  );

  const annualExpenses = (monthlyExpenses(scenario) || 0) * 12;
  const surplus = cashGross - baselineTax.total - annualExpenses;
  return Math.max(0, Math.round(surplus));
}

/**
 * Computes preset target savings amounts for common financial milestones.
 */
export function getStrategyPresets(
  scenario: ScenarioV2,
  assumptions: AssumptionsV2,
): StrategyPresetOption[] {
  const baseSalary = Math.max(0, Number(scenario.base) || 0);
  const year = Number(assumptions.startYear) || 2026;
  const inflation = Number(assumptions.taxInflation) || 0;
  const limits = annualRetirementLimits(year, inflation);
  const age = annualAge(scenario.retirementProfiles.primary, 0);
  const allowsCatchUp = scenario.retirementProfiles.primary.allowsCatchUp === true;

  const max401k = employeeDeferralLimit(limits, age, allowsCatchUp);
  const matchRate = requiredEmployeeRateForFullMatch(scenario.employerMatch);
  const matchDollars = Math.min(max401k, Math.round((baseSalary * matchRate) / 100));

  const hsaEligible = scenario.taxProfile.hsaCoverage !== "none";
  const hsaLimit = hsaEligible
    ? (scenario.taxProfile.hsaCoverage === "family" ? limits.hsaFamily : limits.hsaSelf) +
      (age !== null && age >= 55 ? limits.hsaCatchUp : 0)
    : 0;

  const iraLimit = limits.iraContribution + (age !== null && age >= 50 ? limits.iraCatchUp : 0);

  const potentialMatch = calculateEmployerMatch(scenario.employerMatch, baseSalary, matchDollars);
  const megaBackdoorRoom = definedContributionRoom(limits, baseSalary, max401k, potentialMatch);

  const surplus = estimateNetCashSurplus(scenario, assumptions);

  const presets: StrategyPresetOption[] = [
    {
      id: "match-only",
      label: "Full Employer Match",
      amount: matchDollars,
      description: `Capture 100% of available employer match (${matchRate}% of salary)`,
    },
  ];

  if (hsaEligible) {
    presets.push({
      id: "match-hsa",
      label: "Match + HSA",
      amount: matchDollars + Math.round(hsaLimit),
      description: "Capture full match plus triple-tax-advantaged HSA",
    });
  }

  presets.push(
    {
      id: "match-hsa-ira",
      label: hsaEligible ? "Match + HSA + IRA" : "Match + IRA",
      amount: matchDollars + Math.round(hsaLimit) + Math.round(iraLimit),
      description: hsaEligible
        ? "Full match, HSA, and IRA capacity"
        : "Full match and IRA capacity",
    },
    {
      id: "max-401k",
      label: hsaEligible ? "Max 401(k) + HSA + IRA" : "Max 401(k) + IRA",
      amount: Math.round(max401k + hsaLimit + iraLimit),
      description: hsaEligible
        ? `Max employee 401(k) limit ($${max401k.toLocaleString()}) plus HSA and IRA`
        : `Max employee 401(k) limit ($${max401k.toLocaleString()}) plus IRA`,
    },
    {
      id: "max-all",
      label: "Max All Accounts",
      amount: Math.round(max401k + hsaLimit + iraLimit + megaBackdoorRoom),
      description: hsaEligible
        ? "Max 401(k), HSA, IRA, and Mega Backdoor capacity"
        : "Max 401(k), IRA, and Mega Backdoor capacity",
    },
    {
      id: "surplus",
      label: "All Surplus Cash",
      amount: surplus,
      description: `Allocate entire estimated take-home surplus ($${surplus.toLocaleString()}/yr)`,
    },
  );

  return presets;
}

/**
 * Calculates the tax-efficient retirement allocation waterfall and generates a comparison
 * against current scenario settings.
 */
export function calculateRetirementStrategy(
  scenario: ScenarioV2,
  assumptions: AssumptionsV2,
  config: RetirementStrategyConfig,
): RetirementStrategyResult {
  const baseSalary = Math.max(0, Number(scenario.base) || 0);
  const year = Number(assumptions.startYear) || 2026;
  const inflation = Number(assumptions.taxInflation) || 0;
  const limits = annualRetirementLimits(year, inflation);
  const age = annualAge(scenario.retirementProfiles.primary, 0);
  const allowsCatchUp = scenario.retirementProfiles.primary.allowsCatchUp === true;

  const marginalTaxRate = calculateMarginalTaxRate(scenario, assumptions);
  const recommendedTaxPreference: "traditional" | "roth" =
    marginalTaxRate >= 0.22 ? "traditional" : "roth";

  const effectiveTaxPreference =
    config.taxPreference === "auto" ? recommendedTaxPreference : config.taxPreference;

  let remaining = Math.max(0, config.targetSavings);
  const max401k = employeeDeferralLimit(limits, age, allowsCatchUp);

  // -------------------------------------------------------------
  // Tier 1: 401(k) Match
  // -------------------------------------------------------------
  const matchRate = requiredEmployeeRateForFullMatch(scenario.employerMatch);
  const matchRequiredDollars = Math.min(max401k, (baseSalary * matchRate) / 100);
  const tier1Allocated = Math.min(remaining, matchRequiredDollars);
  remaining -= tier1Allocated;

  const tier1MatchCaptured = calculateEmployerMatch(
    scenario.employerMatch,
    baseSalary,
    tier1Allocated,
  );
  const maxPotentialMatch = calculateEmployerMatch(
    scenario.employerMatch,
    baseSalary,
    matchRequiredDollars,
  );

  const tier1Status: WaterfallTier["status"] =
    matchRequiredDollars <= 0
      ? "skipped"
      : tier1Allocated >= matchRequiredDollars
        ? "filled"
        : tier1Allocated > 0
          ? "partial"
          : "skipped";

  const tier1: WaterfallTier = {
    id: "match",
    name: "Step 1: Employer 401(k) Match",
    accountType: "Workplace 401(k)",
    description: `Contribute ${matchRate}% of pay to earn the full employer match.`,
    taxAdvantage: "Guaranteed Instant Return",
    maxCap: Math.round(matchRequiredDollars),
    allocated: Math.round(tier1Allocated),
    effectiveMatchCaptured: Math.round(tier1MatchCaptured),
    details:
      matchRequiredDollars > 0
        ? `Captures $${Math.round(tier1MatchCaptured).toLocaleString()} in employer match.`
        : "No active employer match formula configured.",
    status: tier1Status,
  };

  // -------------------------------------------------------------
  // Tier 2: Health Savings Account (HSA)
  // -------------------------------------------------------------
  const hsaEligible = scenario.taxProfile.hsaCoverage !== "none";
  const hsaLimit = hsaEligible
    ? (scenario.taxProfile.hsaCoverage === "family" ? limits.hsaFamily : limits.hsaSelf) +
      (age !== null && age >= 55 ? limits.hsaCatchUp : 0)
    : 0;

  const tier2Allocated = hsaEligible ? Math.min(remaining, hsaLimit) : 0;
  remaining -= tier2Allocated;

  const tier2Status: WaterfallTier["status"] = !hsaEligible
    ? "ineligible"
    : tier2Allocated >= hsaLimit
      ? "filled"
      : tier2Allocated > 0
        ? "partial"
        : "skipped";

  const tier2: WaterfallTier = {
    id: "hsa",
    name: "Step 2: Health Savings Account (HSA)",
    accountType: "HSA",
    description: "Triple tax-advantaged: tax-deductible in, tax-free growth, tax-free medical out.",
    taxAdvantage: "Triple Tax-Free",
    maxCap: Math.round(hsaLimit),
    allocated: Math.round(tier2Allocated),
    details: hsaEligible
      ? `Triple tax exemption under ${scenario.taxProfile.hsaCoverage} coverage limit.`
      : "Ineligible: requires enrollment in an eligible High Deductible Health Plan (HDHP).",
    status: tier2Status,
  };

  // -------------------------------------------------------------
  // Tier 3: IRA (Direct Roth, Deductible Traditional, or Backdoor Roth)
  // -------------------------------------------------------------
  const iraBaseLimit =
    limits.iraContribution + (age !== null && age >= 50 ? limits.iraCatchUp : 0);

  const iraEligibilityResult = iraEligibility({
    filing: scenario.taxProfile.filing,
    modifiedAgi: baseSalary,
    ownTaxableCompensation: baseSalary,
    spouseTaxableCompensation: Number(scenario.taxProfile.spouseWages) || 0,
    age,
    limits,
    ownWorkplaceCoverage: scenario.retirementProfiles.primary.workplacePlanCoverage,
    spouseWorkplaceCoverage: scenario.retirementProfiles.spouse.workplacePlanCoverage,
  });

  let recommendedIraType: "traditional" | "roth" | "backdoor" | "none" = "none";
  let iraCap = iraBaseLimit;

  if (effectiveTaxPreference === "roth" || effectiveTaxPreference === "balanced") {
    if (iraEligibilityResult.rothContributionLimit >= iraBaseLimit) {
      recommendedIraType = "roth";
    } else if (config.enableBackdoor) {
      recommendedIraType = "backdoor";
    } else if (iraEligibilityResult.deductibleTraditionalLimit > 0) {
      recommendedIraType = "traditional";
      iraCap = iraEligibilityResult.deductibleTraditionalLimit;
    } else {
      recommendedIraType = "none";
      iraCap = 0;
    }
  } else {
    // Traditional preference
    if (iraEligibilityResult.deductibleTraditionalLimit >= iraBaseLimit) {
      recommendedIraType = "traditional";
    } else if (iraEligibilityResult.rothContributionLimit >= iraBaseLimit) {
      recommendedIraType = "roth";
    } else if (config.enableBackdoor) {
      recommendedIraType = "backdoor";
    } else {
      recommendedIraType = "none";
      iraCap = 0;
    }
  }

  const tier3Allocated = iraCap > 0 ? Math.min(remaining, iraCap) : 0;
  remaining -= tier3Allocated;

  const tier3Status: WaterfallTier["status"] =
    iraCap <= 0
      ? "ineligible"
      : tier3Allocated >= iraCap
        ? "filled"
        : tier3Allocated > 0
          ? "partial"
          : "skipped";

  const iraTypeName =
    recommendedIraType === "roth"
      ? "Direct Roth IRA"
      : recommendedIraType === "backdoor"
        ? "Backdoor Roth IRA"
        : recommendedIraType === "traditional"
          ? "Deductible Traditional IRA"
          : "IRA";

  const iraDetails =
    recommendedIraType === "roth"
      ? "Within direct Roth IRA income phaseout limits."
      : recommendedIraType === "backdoor"
        ? "Income exceeds direct Roth phaseout. Non-deductible contribution converted to Roth."
        : recommendedIraType === "traditional"
          ? "Traditional IRA deduction available at current income level."
          : "Phased out of deductible traditional and direct Roth IRA.";

  const tier3: WaterfallTier = {
    id: "ira",
    name: `Step 3: ${iraTypeName}`,
    accountType: iraTypeName,
    description: "Personal retirement account with tax-free growth or pre-tax deduction.",
    taxAdvantage:
      recommendedIraType === "traditional" ? "Tax Deduction Now" : "Tax-Free Growth",
    maxCap: Math.round(iraCap),
    allocated: Math.round(tier3Allocated),
    details: iraDetails,
    status: tier3Status,
  };

  // -------------------------------------------------------------
  // Tier 4: Unmatched 401(k) Employee Limit
  // -------------------------------------------------------------
  const unmatched401kRoom = Math.max(0, max401k - tier1Allocated);
  const tier4Allocated = Math.min(remaining, unmatched401kRoom);
  remaining -= tier4Allocated;

  const totalStrategy401k = tier1Allocated + tier4Allocated;
  const total401kPercent = baseSalary > 0 ? (totalStrategy401k / baseSalary) * 100 : 0;

  let traditionalShare = 100;
  let rothShare = 0;
  if (effectiveTaxPreference === "roth") {
    traditionalShare = 0;
    rothShare = 100;
  } else if (effectiveTaxPreference === "balanced") {
    traditionalShare = 50;
    rothShare = 50;
  }

  const strategyTraditional401k = (totalStrategy401k * traditionalShare) / 100;
  const strategyRoth401k = (totalStrategy401k * rothShare) / 100;

  const tier4Status: WaterfallTier["status"] =
    unmatched401kRoom <= 0
      ? "skipped"
      : tier4Allocated >= unmatched401kRoom
        ? "filled"
        : tier4Allocated > 0
          ? "partial"
          : "skipped";

  const tier4: WaterfallTier = {
    id: "unmatched-401k",
    name: "Step 4: Max Remaining 401(k)",
    accountType: "Workplace 401(k)",
    description: `Fill the remaining employee deferral limit ($${max401k.toLocaleString()}/yr).`,
    taxAdvantage:
      traditionalShare > 0 ? "Lower Current Taxes" : "Tax-Free Compounding",
    maxCap: Math.round(unmatched401kRoom),
    allocated: Math.round(tier4Allocated),
    details: `Split: ${traditionalShare}% Traditional ($${Math.round(strategyTraditional401k).toLocaleString()}) / ${rothShare}% Roth ($${Math.round(strategyRoth401k).toLocaleString()}).`,
    status: tier4Status,
  };

  // -------------------------------------------------------------
  // Tier 5: Mega Backdoor Roth
  // -------------------------------------------------------------
  const fullPotentialMatch = calculateEmployerMatch(
    scenario.employerMatch,
    baseSalary,
    totalStrategy401k,
  );
  const megaBackdoorCap = config.enableMegaBackdoor
    ? definedContributionRoom(limits, baseSalary, totalStrategy401k, fullPotentialMatch)
    : 0;

  const tier5Allocated = config.enableMegaBackdoor ? Math.min(remaining, megaBackdoorCap) : 0;
  remaining -= tier5Allocated;

  const tier5Status: WaterfallTier["status"] = !config.enableMegaBackdoor
    ? "ineligible"
    : megaBackdoorCap <= 0
      ? "skipped"
      : tier5Allocated >= megaBackdoorCap
        ? "filled"
        : tier5Allocated > 0
          ? "partial"
          : "skipped";

  const tier5: WaterfallTier = {
    id: "mega-backdoor",
    name: "Step 5: Mega Backdoor Roth",
    accountType: "After-Tax 401(k) Rollover",
    description: "After-tax 401(k) contributions converted into Roth up to the IRC 415(c) limit.",
    taxAdvantage: "Tax-Free Growth",
    maxCap: Math.round(megaBackdoorCap),
    allocated: Math.round(tier5Allocated),
    details: config.enableMegaBackdoor
      ? `Utilizes remaining annual additions room ($${Math.round(megaBackdoorCap).toLocaleString()}).`
      : "Disabled or not supported by employer plan.",
    status: tier5Status,
  };

  // -------------------------------------------------------------
  // Tier 6: Taxable Brokerage / Cash Savings
  // -------------------------------------------------------------
  const tier6Allocated = remaining;
  const tier6: WaterfallTier = {
    id: "taxable",
    name: "Step 6: Taxable Brokerage & Savings",
    accountType: "Taxable Brokerage",
    description: "Regular investment accounts with total liquidity and long-term capital gains rates.",
    taxAdvantage: "Liquid & Flexible",
    maxCap: Infinity,
    allocated: Math.round(tier6Allocated),
    details:
      tier6Allocated > 0
        ? `$${Math.round(tier6Allocated).toLocaleString()} allocated to taxable savings.`
        : "Tax-advantaged accounts absorbed all target savings.",
    status: tier6Allocated > 0 ? "filled" : "skipped",
  };

  const tiers: WaterfallTier[] = [tier1, tier2, tier3, tier4, tier5, tier6];
  const totalAllocated =
    tier1Allocated +
    tier2Allocated +
    tier3Allocated +
    tier4Allocated +
    tier5Allocated +
    tier6Allocated;

  // -------------------------------------------------------------
  // Calculate Current Scenario Metrics
  // -------------------------------------------------------------
  const curr401kMode = scenario.retirementTargets.primary.workplace401k.mode;
  const curr401kAmt = Number(scenario.retirementTargets.primary.workplace401k.amount) || 0;
  const currentTotal401k =
    curr401kMode === "percent" ? (baseSalary * curr401kAmt) / 100 : curr401kAmt;
  const currentTradShare =
    Number(scenario.retirementTargets.primary.workplace401k.traditionalSharePercent) || 0;
  const currentRothShare =
    Number(scenario.retirementTargets.primary.workplace401k.rothSharePercent) || 0;
  const currentTrad401k = (currentTotal401k * currentTradShare) / 100;
  const currentRoth401k = (currentTotal401k * currentRothShare) / 100;

  const currentMatchCaptured = calculateEmployerMatch(
    scenario.employerMatch,
    baseSalary,
    currentTotal401k,
  );
  const currentHsa = Number(scenario.benefits.hsa) || 0;
  const currentIra =
    (Number(scenario.retirementTargets.primary.traditionalIra) || 0) +
    (Number(scenario.retirementTargets.primary.rothIra) || 0) +
    (Number(scenario.retirementTargets.primary.backdoorRoth) || 0);
  const currentMega = Number(scenario.retirementTargets.primary.megaBackdoor) || 0;

  // Estimate tax savings vs $0 contributions
  const zeroWorker: WorkerTaxInput = {
    cash: baseSalary,
    stock: 0,
    retirement: 0,
    health: 0,
    hsa: 0,
  };
  const zeroTax = calculateTaxes([zeroWorker], scenario.taxProfile, year, inflation);

  const currentWorker: WorkerTaxInput = {
    cash: baseSalary,
    stock: 0,
    retirement: currentTrad401k,
    roth401k: currentRoth401k,
    health: 0,
    hsa: currentHsa,
    deductibleIra: Number(scenario.retirementTargets.primary.traditionalIra) || 0,
  };
  const currentTax = calculateTaxes([currentWorker], scenario.taxProfile, year, inflation);
  const currentTaxSavings = Math.max(0, zeroTax.total - currentTax.total);

  const strategyDeductibleIra =
    recommendedIraType === "traditional" ? tier3Allocated : 0;
  const strategyWorker: WorkerTaxInput = {
    cash: baseSalary,
    stock: 0,
    retirement: strategyTraditional401k,
    roth401k: strategyRoth401k,
    health: 0,
    hsa: tier2Allocated,
    deductibleIra: strategyDeductibleIra,
  };
  const strategyTax = calculateTaxes([strategyWorker], scenario.taxProfile, year, inflation);
  const strategyTaxSavings = Math.max(0, zeroTax.total - strategyTax.total);

  const strategyMatchCaptured = calculateEmployerMatch(
    scenario.employerMatch,
    baseSalary,
    totalStrategy401k,
  );

  const currentTotalRetirement =
    currentTotal401k + currentHsa + currentIra + currentMega;
  const strategyTotalRetirement =
    totalStrategy401k + tier2Allocated + tier3Allocated + tier5Allocated;

  const comparison: StrategyComparison = {
    current: {
      total401k: Math.round(currentTotal401k),
      percent401k: baseSalary > 0 ? (currentTotal401k / baseSalary) * 100 : 0,
      traditional401k: Math.round(currentTrad401k),
      roth401k: Math.round(currentRoth401k),
      matchCaptured: Math.round(currentMatchCaptured),
      maxPotentialMatch: Math.round(maxPotentialMatch),
      hsa: Math.round(currentHsa),
      ira: Math.round(currentIra),
      megaBackdoor: Math.round(currentMega),
      taxable: 0,
      totalRetirementSaved: Math.round(currentTotalRetirement),
      estimatedCashTaxSavings: Math.round(currentTaxSavings),
    },
    strategy: {
      total401k: Math.round(totalStrategy401k),
      percent401k: total401kPercent,
      traditional401k: Math.round(strategyTraditional401k),
      roth401k: Math.round(strategyRoth401k),
      traditionalSharePercent: traditionalShare,
      rothSharePercent: rothShare,
      matchCaptured: Math.round(strategyMatchCaptured),
      maxPotentialMatch: Math.round(maxPotentialMatch),
      hsa: Math.round(tier2Allocated),
      ira: Math.round(tier3Allocated),
      iraType: recommendedIraType,
      megaBackdoor: Math.round(tier5Allocated),
      taxable: Math.round(tier6Allocated),
      totalRetirementSaved: Math.round(strategyTotalRetirement),
      estimatedCashTaxSavings: Math.round(strategyTaxSavings),
    },
    deltas: {
      matchDifference: Math.round(strategyMatchCaptured - currentMatchCaptured),
      taxAdvantagedDifference: Math.round(
        strategyTotalRetirement - currentTotalRetirement,
      ),
      taxSavingsDifference: Math.round(strategyTaxSavings - currentTaxSavings),
      totalSavingsDifference: Math.round(
        totalAllocated - (currentTotalRetirement + currentMatchCaptured),
      ),
    },
  };

  return {
    tiers,
    totalAllocated: Math.round(totalAllocated),
    targetSavings: Math.round(config.targetSavings),
    unallocated: Math.max(0, Math.round(remaining)),
    recommendedTaxPreference,
    marginalTaxRate,
    comparison,
  };
}

/**
 * Returns an updated scenario with the strategy's 401(k), HSA, and IRA targets applied cleanly.
 */
export function applyRetirementStrategy(
  scenario: ScenarioV2,
  strategy: RetirementStrategyResult,
): ScenarioV2 {
  const comp = strategy.comparison.strategy;
  const isPercent =
    scenario.retirementTargets.primary.workplace401k.mode === "percent";
  const baseSalary = Number(scenario.base) || 0;

  const next401kAmount = isPercent
    ? baseSalary > 0
      ? ((comp.total401k / baseSalary) * 100).toFixed(1)
      : "0"
    : String(Math.round(comp.total401k));

  const nextPrimaryTargets: RetirementTargets = {
    ...scenario.retirementTargets.primary,
    workplace401k: {
      ...scenario.retirementTargets.primary.workplace401k,
      amount: next401kAmount,
      traditionalSharePercent: String(Math.round(comp.traditionalSharePercent)),
      rothSharePercent: String(Math.round(comp.rothSharePercent)),
    },
    traditionalIra:
      comp.iraType === "traditional" ? String(Math.round(comp.ira)) : "0",
    rothIra: comp.iraType === "roth" ? String(Math.round(comp.ira)) : "0",
    backdoorRoth:
      comp.iraType === "backdoor" ? String(Math.round(comp.ira)) : "0",
    megaBackdoor: String(Math.round(comp.megaBackdoor)),
    backdoorConfirmed:
      comp.iraType === "backdoor"
        ? true
        : scenario.retirementTargets.primary.backdoorConfirmed,
    iraBalanceZeroConfirmed:
      comp.iraType === "backdoor"
        ? true
        : scenario.retirementTargets.primary.iraBalanceZeroConfirmed,
    megaBackdoorSupported:
      comp.megaBackdoor > 0
        ? true
        : scenario.retirementTargets.primary.megaBackdoorSupported,
    megaBackdoorRoute:
      comp.megaBackdoor > 0 &&
      scenario.retirementTargets.primary.megaBackdoorRoute === "none"
        ? "in-plan"
        : scenario.retirementTargets.primary.megaBackdoorRoute,
  };

  const nextBenefits: Benefits = {
    ...scenario.benefits,
    hsa: String(Math.round(comp.hsa)),
  };

  return {
    ...scenario,
    benefits: nextBenefits,
    retirementTargets: {
      ...scenario.retirementTargets,
      primary: nextPrimaryTargets,
    },
  };
}
