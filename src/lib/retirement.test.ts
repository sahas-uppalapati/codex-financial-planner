import { describe, expect, it } from "vitest";
import { defaultPlanner } from "./planner";
import { eligibleIraRequests, fundIraRequests } from "./retirementContributions";
import { annualRetirementLimits, employeeDeferralLimit, iraEligibility } from "./retirement";

describe("retirement rule calculations", () => {
  const limits = annualRetirementLimits(2026, 2.5);

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
});
