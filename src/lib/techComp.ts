import type { FilingStatus, TaxLocation, TaxProfile } from "./planner";
import { calculateTaxes } from "./tax";
import type { WorkerTaxInput } from "./tax";
import { techCompanies } from "../data/techCompPresets";
import { retirementRules2026 } from "../data/retirementRules";

export interface TechRealityInput {
  base: number;
  annualRsu: number;
  bonus: number;
  rent: number;
  otherLivingExpenses: number;
  locationId: TaxLocation;
  filing: FilingStatus;
  max401k?: boolean;
  employee401kAnnual?: number;
  healthAnnual?: number;
  companyId?: string;
  vestingCadence?: "quarterly" | "monthly" | "semiannual" | "annual";
}

export type HousingSafetyTier = "Comfortable" | "Moderate" | "Stretched" | "Equity-Dependent";

export interface TechRealityOutput {
  // Monthly Cash Flow
  monthlyGrossBase: number;
  monthlyBaseTaxes: number;
  monthly401kContribution: number;
  monthlyHealthDeduction: number;
  monthlyBaseTakeHome: number;
  monthlyTotalExpenses: number;
  monthlyBaseCashFlow: number; // monthlyBaseTakeHome - monthlyTotalExpenses

  // Housing safety
  rentToTakeHomeRatio: number; // e.g. 0.28
  housingSafetyTier: HousingSafetyTier;
  housingSafetyMessage: string;

  // Lumpy RSU Vest Cash Surges
  vestEventsPerYear: number;
  grossVestPerEvent: number;
  netVestPerEvent: number;
  annualNetRsu: number;

  // Tax reconciliation & supplemental withholding gap
  statutoryFederalWithholdingRate: number; // 0.22
  statutoryStateWithholdingRate: number; // e.g. 0.1023 for CA
  statutoryTotalWithholdingRate: number;
  actualEffectiveTaxOnStock: number;
  withholdingGapRate: number;
  annualSurpriseTaxBill: number; // Underwithholding gap in $

  // Total annual picture
  totalAnnualGrossComp: number;
  totalAnnualTaxes: number;
  totalAnnualNetTakeHome: number;
  totalAnnualLivingCosts: number;
  annualEmployerMatch: number;
  annualNetSavings: number; // net take-home + match - living costs

  // Year 4 Comp Cliff
  year4CliffAnnualDrop: number;
  year4CliffPercentage: number;
}

export interface VestingYearSummary {
  year: number;
  percent: number;
  value: number;
}

export function computeVestingSchedule(
  annualRsu: number,
  grantSchedule?: { month: string; percent: string }[],
  totalGrantValue?: number,
): VestingYearSummary[] {
  const total = totalGrantValue && totalGrantValue > 0 ? totalGrantValue : annualRsu * 4;
  if (!grantSchedule || grantSchedule.length === 0) {
    return [1, 2, 3, 4].map((year) => ({
      year,
      percent: 25,
      value: Math.round(total * 0.25),
    }));
  }

  return [1, 2, 3, 4].map((year) => {
    const startMonth = (year - 1) * 12;
    const endMonth = year * 12;
    const percent = grantSchedule.reduce((sum, r) => {
      const m = Number(r.month);
      return m > startMonth && m <= endMonth ? sum + Number(r.percent) : sum;
    }, 0);
    const roundedPct = Math.round(percent * 10) / 10;
    return {
      year,
      percent: roundedPct,
      value: Math.round(total * (roundedPct / 100)),
    };
  });
}

export const IRS_401K_LIMIT_2026 = 24500;

export function getStatutoryStateSupplementalRate(location: TaxLocation): number {
  switch (location) {
    case "san-francisco":
      return 0.1023; // California supplemental wage withholding rate
    case "new-york":
      return 0.117; // New York state + NYC supplemental rate
    case "boston":
      return 0.05; // Massachusetts flat supplemental rate
    case "columbus":
      return 0.055; // Ohio + Columbus local
    case "seattle":
    case "austin":
    default:
      return 0.0; // WA and TX have 0% state income tax
  }
}

export function computeTechReality(input: TechRealityInput): TechRealityOutput {
  const {
    base,
    annualRsu,
    bonus,
    rent,
    otherLivingExpenses,
    locationId,
    filing,
    max401k = true,
    employee401kAnnual = max401k ? IRS_401K_LIMIT_2026 : Math.round(base * 0.06),
    healthAnnual = 1800, // $150/month typical tech pre-tax medical/dental
    companyId = "google",
    vestingCadence = "quarterly",
  } = input;

  const taxProfile: TaxProfile = {
    mode: "calculated",
    location: locationId,
    filing,
    hsaCoverage: "self",
    spouseWages: "0",
    spouseGrowth: "0",
    federalAdjustment: "0",
    stateAdjustment: "0",
    localAdjustment: "0",
    employeePremiums: true,
    waCaresExempt: false,
    nyDisability: false,
  };

  // 1. Taxes on Base Salary alone (determines regular monthly paycheck)
  const baseWorkerInput: WorkerTaxInput = {
    cash: base,
    stock: 0,
    retirement: employee401kAnnual,
    health: healthAnnual,
    hsa: 0,
  };
  const baseTax = calculateTaxes([baseWorkerInput], taxProfile, 2026, 0);

  const monthlyGrossBase = Math.round(base / 12);
  const monthlyBaseTaxes = Math.round(baseTax.total / 12);
  const monthly401kContribution = Math.round(employee401kAnnual / 12);
  const monthlyHealthDeduction = Math.round(healthAnnual / 12);

  const monthlyBaseTakeHome = Math.max(
    0,
    monthlyGrossBase - monthlyBaseTaxes - monthly401kContribution - monthlyHealthDeduction,
  );
  const monthlyTotalExpenses = rent + otherLivingExpenses;
  const monthlyBaseCashFlow = monthlyBaseTakeHome - monthlyTotalExpenses;

  // 2. Base-to-Rent Safety Ratio
  const rentToTakeHomeRatio = monthlyBaseTakeHome > 0 ? rent / monthlyBaseTakeHome : 1.0;
  let housingSafetyTier: HousingSafetyTier = "Comfortable";
  let housingSafetyMessage = "Rent is easily covered by your base salary alone.";

  if (rentToTakeHomeRatio > 0.5) {
    housingSafetyTier = "Equity-Dependent";
    housingSafetyMessage =
      "Rent consumes over 50% of your base take-home. You are reliant on stock vests or bonuses to cover living expenses.";
  } else if (rentToTakeHomeRatio > 0.4) {
    housingSafetyTier = "Stretched";
    housingSafetyMessage =
      "Rent takes 40–50% of your base take-home. Cash flow is tight between quarterly stock vests.";
  } else if (rentToTakeHomeRatio >= 0.3) {
    housingSafetyTier = "Moderate";
    housingSafetyMessage =
      "Rent takes 30–40% of base take-home. Manageable, with healthy surplus during vest months.";
  }

  // 3. Taxes on Total Compensation (Base + Bonus + RSU)
  const totalWorkerInput: WorkerTaxInput = {
    cash: base + bonus,
    stock: annualRsu,
    retirement: employee401kAnnual,
    health: healthAnnual,
    hsa: 0,
  };
  const totalTax = calculateTaxes([totalWorkerInput], taxProfile, 2026, 0);

  // 4. Supplemental RSU Tax Withholding Gap Trap
  // Taxes attributable specifically to the RSU compensation:
  const taxFromStock = Math.max(0, totalTax.total - baseTax.total);
  const actualEffectiveTaxOnStock = annualRsu > 0 ? taxFromStock / annualRsu : 0;

  const statutoryFederalRate = 0.22; // Mandatory IRS statutory supplemental rate (under $1M)
  const statutoryStateRate = getStatutoryStateSupplementalRate(locationId);
  const statutoryFicaRate = 0.0145; // Medicare (plus additional medicare on higher tiers)
  const statutoryTotalWithholdingRate = statutoryFederalRate + statutoryStateRate + statutoryFicaRate;

  // Underwithholding occurs when the worker's true marginal bracket is higher than statutory withholding
  const withholdingGapRate = Math.max(0, actualEffectiveTaxOnStock - statutoryTotalWithholdingRate);
  const annualSurpriseTaxBill = Math.round(annualRsu * withholdingGapRate);

  // 5. Vest Month Cash Surge
  const vestCadences: Record<string, number> = {
    monthly: 12,
    quarterly: 4,
    semiannual: 2,
    annual: 1,
  };
  const vestEventsPerYear = vestCadences[vestingCadence] ?? 4;
  const grossVestPerEvent = Math.round(annualRsu / vestEventsPerYear);
  // Net cash received at vest after employer sell-to-cover withholding:
  const netVestPerEvent = Math.max(
    0,
    Math.round(grossVestPerEvent * (1 - statutoryTotalWithholdingRate)),
  );
  const annualNetRsu = netVestPerEvent * vestEventsPerYear;

  // 6. Employer 401(k) Match
  const company = techCompanies.find((c) => c.id === companyId);
  let annualEmployerMatch = 0;
  if (company) {
    if (company.matchPolicy.type === "percent_of_contribution") {
      const match = employee401kAnnual * (company.matchPolicy.rate / 100);
      const cap = company.matchPolicy.capBasis === "half-basic-deferral-limit"
        ? retirementRules2026.employeeDeferral / 2
        : company.matchPolicy.dollarCap;
      annualEmployerMatch = cap
        ? Math.min(match, cap)
        : match;
    } else if (company.matchPolicy.type === "percent_of_pay") {
      const eligibleEmployeeContribution = Math.min(
        employee401kAnnual,
        base * ((company.matchPolicy.payPercentCap ?? 0) / 100),
      );
      annualEmployerMatch = eligibleEmployeeContribution * (company.matchPolicy.rate / 100);
    }
  }

  // 7. Total Annual Picture
  const totalAnnualGrossComp = base + bonus + annualRsu;
  const totalAnnualTaxes = totalTax.total;
  const totalAnnualNetTakeHome = totalAnnualGrossComp - totalAnnualTaxes - employee401kAnnual - healthAnnual;
  const totalAnnualLivingCosts = monthlyTotalExpenses * 12;
  const annualNetSavings = totalAnnualNetTakeHome + annualEmployerMatch - totalAnnualLivingCosts;

  // 8. Year 4 Comp Cliff
  // Without refreshers, annual comp drops by the full annual RSU value of the initial grant
  const year4CliffAnnualDrop = annualRsu;
  const year4CliffPercentage = totalAnnualGrossComp > 0
    ? Math.round((annualRsu / totalAnnualGrossComp) * 100)
    : 0;

  return {
    monthlyGrossBase,
    monthlyBaseTaxes,
    monthly401kContribution,
    monthlyHealthDeduction,
    monthlyBaseTakeHome,
    monthlyTotalExpenses,
    monthlyBaseCashFlow,

    rentToTakeHomeRatio: Math.round(rentToTakeHomeRatio * 1000) / 1000,
    housingSafetyTier,
    housingSafetyMessage,

    vestEventsPerYear,
    grossVestPerEvent,
    netVestPerEvent,
    annualNetRsu,

    statutoryFederalWithholdingRate: statutoryFederalRate,
    statutoryStateWithholdingRate: statutoryStateRate,
    statutoryTotalWithholdingRate: Math.round(statutoryTotalWithholdingRate * 1000) / 1000,
    actualEffectiveTaxOnStock: Math.round(actualEffectiveTaxOnStock * 1000) / 1000,
    withholdingGapRate: Math.round(withholdingGapRate * 1000) / 1000,
    annualSurpriseTaxBill,

    totalAnnualGrossComp,
    totalAnnualTaxes: Math.round(totalAnnualTaxes),
    totalAnnualNetTakeHome: Math.round(totalAnnualNetTakeHome),
    totalAnnualLivingCosts,
    annualEmployerMatch: Math.round(annualEmployerMatch),
    annualNetSavings: Math.round(annualNetSavings),

    year4CliffAnnualDrop,
    year4CliffPercentage,
  };
}
