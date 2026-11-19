import { describe, expect, it } from "vitest";
import { defaultPlanner } from "./planner";
import { eligibleIraRequests, fundIraRequests } from "./retirementContributions";
import {
  annualRetirementLimits,
  employeeDeferralLimit,
  iraEligibility,
  matchVestedPercent,
  requiredEmployeeRateForFullMatch,
} from "./retirement";

describe("retirement rule calculations", () => {
  const limits = annualRetirementLimits(2026, 2.5);

  it("keeps the statutory HSA catch-up fixed in future-year projections", () => {
    expect(annualRetirementLimits(2030, 5).hsaCatchUp).toBe(1000);
  });

  it("applies workplace catch-up limits only after age and plan confirmation", () => {
    expect(employeeDeferralLimit(limits, 49, true)).toBe(24500);
    expect(employeeDeferralLimit(limits, 50, false)).toBe(24500);
    expect(employeeDeferralLimit(limits, 50, true)).toBe(32500);
    expect(employeeDeferralLimit(limits, 60, true)).toBe(35750);
    expect(employeeDeferralLimit(limits, 64, true)).toBe(32500);
  });

  it("applies IRA contribution, Roth phaseout, and deduction coverage limits", () => {
    const base = {
      filing: "single" as const,
      modifiedAgi: 0,
      ownTaxableCompensation: 200000,
      spouseTaxableCompensation: 0,
      age: 35,
      limits,
      spouseWorkplaceCoverage: false,
    };
    expect(iraEligibility({ ...base, ownWorkplaceCoverage: true }).deductibleTraditionalLimit).toBe(7500);
    expect(iraEligibility({ ...base, ownWorkplaceCoverage: "unsure" }).deductibleTraditionalLimit).toBe(0);
    expect(iraEligibility({ ...base, modifiedAgi: 168000, ownWorkplaceCoverage: false }).rothContributionLimit).toBe(0);
    expect(iraEligibility({ ...base, ownTaxableCompensation: 5000, ownWorkplaceCoverage: false }).contributionLimit).toBe(5000);
  });

  it("requires backdoor and mega-backdoor confirmations and funds requests proportionally", () => {
    const targets = defaultPlanner().scenarios[0].retirementTargets.primary;
    targets.traditionalIra = "0";
    targets.rothIra = "3000";
    targets.backdoorRoth = "1000";
    targets.megaBackdoor = "2000";
    const eligibility = iraEligibility({
      filing: "single", modifiedAgi: 0, ownTaxableCompensation: 200000,
      spouseTaxableCompensation: 0, age: 35, limits,
      ownWorkplaceCoverage: true, spouseWorkplaceCoverage: false,
    });
    expect(eligibleIraRequests(targets, eligibility, 1, 5000)).toEqual({
      traditional: 0, roth: 3000, backdoor: 0, megaBackdoor: 0,
    });
    targets.backdoorConfirmed = true;
    targets.iraBalanceZeroConfirmed = true;
    targets.megaBackdoorSupported = true;
    targets.megaBackdoorRoute = "in-plan";
    expect(eligibleIraRequests(targets, eligibility, 0, 5000)).toMatchObject({ backdoor: 1000, megaBackdoor: 2000 });
    const funded = fundIraRequests({ traditional: 3000, roth: 3000, backdoor: 0, megaBackdoor: 0 }, 3000, 1000);
    expect(funded).toMatchObject({ traditional: 1500, roth: 1500, deductibleTraditional: 1000 });
    expect(funded.unfunded).toMatchObject({ traditional: 1500, roth: 1500 });
  });

  it("calculates match vesting percentage across standard schedules and custom percentages", () => {
    const immediate = { type: "simple" as const, rate: "50", payPercent: "6", cap: "0", tiers: [], vestingType: "immediate" as const, vestingSchedule: ["100"] };
    expect(matchVestedPercent(immediate, 0)).toBe(100);
    expect(matchVestedPercent(immediate, 3)).toBe(100);

    const cliff2 = { type: "simple" as const, rate: "50", payPercent: "6", cap: "0", tiers: [], vestingType: "cliff-2" as const, vestingSchedule: ["0", "100"] };
    expect(matchVestedPercent(cliff2, 0)).toBe(0);
    expect(matchVestedPercent(cliff2, 1)).toBe(0);
    expect(matchVestedPercent(cliff2, 2)).toBe(100);
    expect(matchVestedPercent(cliff2, 5)).toBe(100);

    const graded4 = { type: "simple" as const, rate: "50", payPercent: "6", cap: "0", tiers: [], vestingType: "graded-4" as const, vestingSchedule: ["25", "50", "75", "100"] };
    expect(matchVestedPercent(graded4, 0)).toBe(0);
    expect(matchVestedPercent(graded4, 1)).toBe(25);
    expect(matchVestedPercent(graded4, 2)).toBe(50);
    expect(matchVestedPercent(graded4, 3)).toBe(75);
    expect(matchVestedPercent(graded4, 4)).toBe(100);

    const custom = { type: "simple" as const, rate: "50", payPercent: "6", cap: "0", tiers: [], vestingType: "custom" as const, vestingSchedule: ["10", "30", "60", "100"] };
    expect(matchVestedPercent(custom, 1)).toBe(10);
    expect(matchVestedPercent(custom, 2)).toBe(30);
    expect(matchVestedPercent(custom, 3)).toBe(60);
    expect(matchVestedPercent(custom, 4)).toBe(100);
  });

  it("computes required employee contribution rate to capture 100% of employer match", () => {
    expect(requiredEmployeeRateForFullMatch(undefined)).toBe(0);
    expect(requiredEmployeeRateForFullMatch({ type: "none", rate: "0", payPercent: "0", cap: "0", tiers: [] })).toBe(0);
    expect(requiredEmployeeRateForFullMatch({ type: "simple", rate: "50", payPercent: "6", cap: "0", tiers: [] })).toBe(6);
    expect(requiredEmployeeRateForFullMatch({
      type: "tiered", rate: "50", payPercent: "5", cap: "0",
      tiers: [{ rate: "100", payPercent: "3" }, { rate: "50", payPercent: "2" }],
    })).toBe(5);
  });
});
