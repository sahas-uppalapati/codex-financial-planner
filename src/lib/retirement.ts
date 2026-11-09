import { retirementRules2026 } from "../data/retirementRules";
import type { EmployerMatch, FilingStatus, MatchVestingType } from "./planner";

export type RetirementOwner = "primary" | "spouse";
export type RetirementAccountType =
  | "traditional-401k"
  | "roth-401k"
  | "traditional-ira"
  | "roth-ira"
  | "hsa"
  | "sep-ira"
  | "simple-ira";

export const retirementAccountLabels: Record<RetirementAccountType, string> = {
  "traditional-401k": "Traditional 401(k)",
  "roth-401k": "Roth 401(k)",
  "traditional-ira": "Traditional / rollover IRA",
  "roth-ira": "Roth IRA",
  hsa: "HSA",
  "sep-ira": "SEP IRA (balance only)",
  "simple-ira": "SIMPLE IRA (balance only)",
};

export interface StartingAccountBalance {
  id: string;
  owner: RetirementOwner;
  type: RetirementAccountType;
  balance: string;
}

export interface PersonRetirementProfile {
  ageAtFirstYearEnd: string;
  ageConfirmed: boolean;
  allowsCatchUp: boolean | "unsure";
  workplacePlanCoverage: boolean | "unsure";
  priorYearFicaWages: string;
  medicareMonth: string;
}

export interface AnnualRetirementLimits {
  employeeDeferral: number;
  employeeDeferralWithCatchUp: number;
  employeeDeferralWithCatchUpAge60To63: number;
  annualAdditions: number;
  compensationCap: number;
  iraContribution: number;
  iraCatchUp: number;
  rothCatchUpWageThreshold: number;
  iraRothPhaseout: { single: [number, number]; joint: [number, number] };
  iraDeductionPhaseout: {
    coveredSingle: [number, number];
    coveredJoint: [number, number];
    uncoveredWithCoveredSpouseJoint: [number, number];
  };
  hsaSelf: number;
  hsaFamily: number;
  hsaCatchUp: number;
  medicareAge: number;
}

export function annualRetirementLimits(
  calendarYear: number,
  inflationPercent: number,
): AnnualRetirementLimits {
  if (
    !Number.isInteger(calendarYear) ||
    calendarYear < 2026 ||
    !Number.isFinite(inflationPercent) ||
    inflationPercent < 0 ||
    inflationPercent > 10
  )
    throw new RangeError("Invalid retirement rule year or inflation assumption.");
  const scale = (1 + inflationPercent / 100) ** (calendarYear - 2026);
  const indexed = (n: number) => n * scale;
  const base = retirementRules2026;
  return {
    employeeDeferral: indexed(base.employeeDeferral),
    employeeDeferralWithCatchUp: indexed(base.catchUp),
    employeeDeferralWithCatchUpAge60To63: indexed(base.catchUpAge60To63),
    annualAdditions: indexed(base.annualAdditions),
    compensationCap: indexed(base.compensationCap),
    iraContribution: indexed(base.iraContribution),
    iraCatchUp: indexed(base.iraCatchUp),
    rothCatchUpWageThreshold: indexed(base.rothCatchUpPriorYearWages),
    iraRothPhaseout: {
      single: base.iraRothPhaseout.single.map(indexed) as [number, number],
      joint: base.iraRothPhaseout.joint.map(indexed) as [number, number],
    },
    iraDeductionPhaseout: {
      coveredSingle: base.iraDeductionPhaseout.coveredSingle.map(indexed) as [number, number],
      coveredJoint: base.iraDeductionPhaseout.coveredJoint.map(indexed) as [number, number],
      uncoveredWithCoveredSpouseJoint: base.iraDeductionPhaseout.uncoveredWithCoveredSpouseJoint.map(indexed) as [number, number],
    },
    hsaSelf: indexed(base.hsaSelf),
    hsaFamily: indexed(base.hsaFamily),
    hsaCatchUp: base.hsaCatchUp,
    medicareAge: base.medicareAge,
  };
}

export function annualAge(profile: PersonRetirementProfile, yearOffset: number): number | null {
  if (!profile.ageConfirmed || !/^\d{1,3}$/.test(profile.ageAtFirstYearEnd)) return null;
  const age = Number(profile.ageAtFirstYearEnd) + yearOffset;
  return Number.isInteger(age) && age >= 0 && age <= 120 ? age : null;
}

export function employeeDeferralLimit(
  limits: AnnualRetirementLimits,
  age: number | null,
  planAllowsCatchUp: boolean,
): number {
  if (age === null || !planAllowsCatchUp || age < 50) return limits.employeeDeferral;
  const catchUp = age >= 60 && age <= 63
    ? limits.employeeDeferralWithCatchUpAge60To63
    : limits.employeeDeferralWithCatchUp;
  return limits.employeeDeferral + catchUp;
}

export function employeeDeferralIsCatchUp(
  yearlyDeferralsBeforeThisDollar: number,
  limits: AnnualRetirementLimits,
): boolean {
  return yearlyDeferralsBeforeThisDollar >= limits.employeeDeferral;
}

export function definedContributionRoom(
  limits: AnnualRetirementLimits,
  compensation: number,
  employeeContributions: number,
  employerContributions: number,
  afterTaxContributions = 0,
): number {
  const eligibleCompensation = Math.min(Math.max(0, compensation), limits.compensationCap);
  return Math.max(
    0,
    Math.min(limits.annualAdditions, eligibleCompensation) -
      employeeContributions - employerContributions - afterTaxContributions,
  );
}

function phaseoutRemaining(
  requested: number,
  magi: number,
  range: readonly [number, number],
): number {
  if (magi <= range[0]) return requested;
  if (magi >= range[1]) return 0;
  const reduction = Math.ceil(((magi - range[0]) / (range[1] - range[0]) * requested) / 10) * 10;
  return Math.max(0, requested - reduction);
}

export interface IraEligibilityInput {
  filing: FilingStatus;
  modifiedAgi: number;
  ownTaxableCompensation: number;
  spouseTaxableCompensation: number;
  age: number | null;
  limits: AnnualRetirementLimits;
  ownWorkplaceCoverage: boolean | "unsure";
  spouseWorkplaceCoverage: boolean | "unsure";
}

export interface IraEligibility {
  contributionLimit: number;
  rothContributionLimit: number;
  traditionalContributionLimit: number;
  deductibleTraditionalLimit: number;
  eligibilityIsEstimated: boolean;
}

export function iraEligibility(input: IraEligibilityInput): IraEligibility {
  const {
    filing,
    modifiedAgi,
    ownTaxableCompensation,
    spouseTaxableCompensation,
    age,
    limits,
    ownWorkplaceCoverage,
    spouseWorkplaceCoverage,
  } = input;
  const catchup = age !== null && age >= 50 ? limits.iraCatchUp : 0;
  const baseLimit = limits.iraContribution + catchup;
  const compensation = Math.max(
    0,
    ownTaxableCompensation + (filing === "joint" ? spouseTaxableCompensation : 0),
  );
  const contributionLimit = Math.min(baseLimit, compensation);
  let rothContributionLimit = contributionLimit;
  let deductibleTraditionalLimit = contributionLimit;
  if (filing === "single") {
    rothContributionLimit = phaseoutRemaining(
      contributionLimit,
      modifiedAgi,
      limits.iraRothPhaseout.single,
    );
    if (ownWorkplaceCoverage === true)
      deductibleTraditionalLimit = phaseoutRemaining(
        contributionLimit,
        modifiedAgi,
        limits.iraDeductionPhaseout.coveredSingle,
      );
    else if (ownWorkplaceCoverage === "unsure") deductibleTraditionalLimit = 0;
  } else {
    rothContributionLimit = phaseoutRemaining(
      contributionLimit,
      modifiedAgi,
      limits.iraRothPhaseout.joint,
    );
    if (ownWorkplaceCoverage === true) {
      deductibleTraditionalLimit = phaseoutRemaining(
        contributionLimit,
        modifiedAgi,
        limits.iraDeductionPhaseout.coveredJoint,
      );
    } else if (ownWorkplaceCoverage === "unsure" || spouseWorkplaceCoverage === "unsure") {
      deductibleTraditionalLimit = 0;
    } else if (spouseWorkplaceCoverage === true) {
      deductibleTraditionalLimit = phaseoutRemaining(
        contributionLimit,
        modifiedAgi,
        limits.iraDeductionPhaseout.uncoveredWithCoveredSpouseJoint,
      );
    }
  }
  return {
    contributionLimit,
    rothContributionLimit,
    traditionalContributionLimit: contributionLimit,
    deductibleTraditionalLimit,
    eligibilityIsEstimated:
      ownWorkplaceCoverage === "unsure" ||
      (filing === "joint" && spouseWorkplaceCoverage === "unsure"),
  };
}

export const matchFormulaPresets = [
  { label: "50% on first 6%", type: "simple" as const, rate: "50", payPercent: "6", cap: "0" },
  { label: "100% on first 4%", type: "simple" as const, rate: "100", payPercent: "4", cap: "0" },
  {
    label: "100% on 3% + 50% on 2%",
    type: "tiered" as const,
    rate: "50",
    payPercent: "5",
    cap: "0",
    tiers: [
      { rate: "100", payPercent: "3" },
      { rate: "50", payPercent: "2" },
    ],
  },
  { label: "100% on first 6%", type: "simple" as const, rate: "100", payPercent: "6", cap: "0" },
];

export const matchVestingPresets: {
  id: MatchVestingType;
  label: string;
  schedule: string[];
}[] = [
  { id: "immediate", label: "Immediate (100% from Day 1)", schedule: ["100"] },
  { id: "cliff-1", label: "1-year cliff (100% after 1 year)", schedule: ["100"] },
  { id: "cliff-2", label: "2-year cliff (100% after 2 years)", schedule: ["0", "100"] },
  { id: "cliff-3", label: "3-year cliff (100% after 3 years)", schedule: ["0", "0", "100"] },
  { id: "graded-3", label: "3-year graded (33% per year)", schedule: ["33", "67", "100"] },
  { id: "graded-4", label: "4-year graded (25% per year)", schedule: ["25", "50", "75", "100"] },
  { id: "graded-5", label: "5-year graded (20% per year)", schedule: ["20", "40", "60", "80", "100"] },
  {
    id: "graded-6",
    label: "6-year graded (0% yr 1, then 20%/yr)",
    schedule: ["0", "20", "40", "60", "80", "100"],
  },
  { id: "custom", label: "Custom percentage schedule", schedule: ["25", "50", "75", "100"] },
];

export function matchVestedPercent(
  match: EmployerMatch | undefined,
  completedYears: number,
): number {
  if (!match || match.vestingType === "immediate" || !match.vestingType) {
    return 100;
  }
  if (completedYears <= 0) {
    return 0;
  }
  const schedule =
    match.vestingSchedule && match.vestingSchedule.length > 0
      ? match.vestingSchedule
      : matchVestingPresets.find((p) => p.id === match.vestingType)?.schedule ?? ["100"];
  if (completedYears > schedule.length) {
    return 100;
  }
  const raw = Number(schedule[completedYears - 1]);
  return Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 100;
}

export function requiredEmployeeRateForFullMatch(
  match: EmployerMatch | undefined,
): number {
  if (!match || match.type === "unsure" || match.type === "none") {
    return 0;
  }
  if (match.type === "simple") {
    return Math.min(100, Math.max(0, Number(match.payPercent) || 0));
  }
  if (match.type === "tiered" && Array.isArray(match.tiers)) {
    const total = match.tiers.reduce(
      (sum, tier) => sum + (Number(tier.payPercent) || 0),
      0,
    );
    return Math.min(100, Math.max(0, total));
  }
  return 0;
}

