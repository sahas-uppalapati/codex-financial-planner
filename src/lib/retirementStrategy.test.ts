import { describe, expect, it } from "vitest";
import { defaultPlanner } from "./planner";
import type { ScenarioV2, AssumptionsV2 } from "./planner";
import {
  applyRetirementStrategy,
  calculateMarginalTaxRate,
  calculateRetirementStrategy,
  getStrategyPresets,
} from "./retirementStrategy";

function createTestScenario(overrides: Partial<ScenarioV2> = {}): ScenarioV2 {
  const p = defaultPlanner();
  const scenario = p.scenarios[0] as ScenarioV2;
  return {
    ...scenario,
    base: "120000",
    employerMatch: {
      type: "simple",
      rate: "50",
      payPercent: "6",
      cap: "0",
      tiers: [],
      vestingType: "immediate",
      vestingSchedule: ["100"],
    },
    taxProfile: {
      ...scenario.taxProfile,
      location: "san-francisco",
      filing: "single",
      hsaCoverage: "self",
    },
    ...overrides,
  };
}

const testAssumptions: AssumptionsV2 = {
  startYear: "2026",
  taxInflation: "0",
  starting: "10000",
  years: "10",
  returns: "7",
  inflation: "2.5",
  startingRetirement: "20000",
  startingHsa: "3000",
  startingSpouseRetirement: "0",
  startingSpouseHsa: "0",
  startingAccounts: [],
};

describe("retirementStrategy", () => {
  it("calculates a plausible combined marginal tax rate", () => {
    const s = createTestScenario({ base: "150000" });
    const rate = calculateMarginalTaxRate(s, testAssumptions);
    // Federal 24% + CA 9.3% minus payroll brackets ~ 30-35%
    expect(rate).toBeGreaterThan(0.20);
    expect(rate).toBeLessThan(0.50);
  });

  it("prioritizes 401(k) match first in the waterfall", () => {
    const s = createTestScenario({ base: "100000" });
    // 6% of $100k = $6,000 for full match. Provide only $4,000 target savings.
    const res = calculateRetirementStrategy(s, testAssumptions, {
      targetSavings: 4000,
      taxPreference: "auto",
      enableBackdoor: true,
      enableMegaBackdoor: false,
    });

    const matchTier = res.tiers.find((t) => t.id === "match")!;
    expect(matchTier.allocated).toBe(4000);
    expect(matchTier.status).toBe("partial");
    // Other tiers should be 0 because all $4,000 went to match
    const hsaTier = res.tiers.find((t) => t.id === "hsa")!;
    expect(hsaTier.allocated).toBe(0);
    expect(hsaTier.status).toBe("skipped");
  });

  it("flows funds through Match -> HSA -> IRA -> Unmatched 401k -> Taxable", () => {
    const s = createTestScenario({ base: "100000" });
    // Full match = $6,000. HSA limit = $4,300 (2026 self). IRA = $7,500. Total = $17,800.
    // Give $25,000.
    // Remaining $7,200 should go to Unmatched 401(k).
    const res = calculateRetirementStrategy(s, testAssumptions, {
      targetSavings: 25000,
      taxPreference: "traditional",
      enableBackdoor: true,
      enableMegaBackdoor: false,
    });

    const matchTier = res.tiers.find((t) => t.id === "match")!;
    expect(matchTier.allocated).toBe(6000);
    expect(matchTier.status).toBe("filled");
    expect(matchTier.effectiveMatchCaptured).toBe(3000); // 50% of 6% of 100k

    const hsaTier = res.tiers.find((t) => t.id === "hsa")!;
    expect(hsaTier.allocated).toBe(4400);
    expect(hsaTier.status).toBe("filled");

    const iraTier = res.tiers.find((t) => t.id === "ira")!;
    expect(iraTier.allocated).toBe(7500);
    expect(iraTier.status).toBe("filled");

    const unmatched401kTier = res.tiers.find((t) => t.id === "unmatched-401k")!;
    expect(unmatched401kTier.allocated).toBe(7100); // 25,000 - 6,000 - 4,400 - 7,500
    expect(unmatched401kTier.status).toBe("partial");

    const taxableTier = res.tiers.find((t) => t.id === "taxable")!;
    expect(taxableTier.allocated).toBe(0);
  });

  it("handles high earner backdoor Roth IRA when income exceeds direct Roth phaseout", () => {
    const s = createTestScenario({ base: "250000" });
    s.retirementTargets.primary.backdoorConfirmed = true;
    s.retirementTargets.primary.iraBalanceZeroConfirmed = true;
    const res = calculateRetirementStrategy(s, testAssumptions, {
      targetSavings: 30000,
      taxPreference: "roth",
      enableBackdoor: true,
      enableMegaBackdoor: false,
    });

    const iraTier = res.tiers.find((t) => t.id === "ira")!;
    expect(iraTier.accountType).toBe("Backdoor Roth IRA");
    expect(iraTier.allocated).toBe(7500);
  });

  it("respects combined wages and preserves unconfirmed conversion settings", () => {
    const s = createTestScenario({ base: "120000" });
    s.taxProfile.filing = "joint";
    s.taxProfile.spouseWages = "180000";
    const strategy = calculateRetirementStrategy(s, testAssumptions, {
      targetSavings: 65000,
      taxPreference: "roth",
      enableBackdoor: true,
      enableMegaBackdoor: true,
    });

    expect(strategy.comparison.strategy.ira).toBe(0);
    expect(strategy.comparison.strategy.megaBackdoor).toBe(0);
    const updated = applyRetirementStrategy(s, strategy);
    expect(updated.retirementTargets.primary.backdoorConfirmed).toBe(false);
    expect(updated.retirementTargets.primary.iraBalanceZeroConfirmed).toBe(false);
    expect(updated.retirementTargets.primary.megaBackdoorSupported).toBe(false);
    expect(updated.retirementTargets.primary.megaBackdoorRoute).toBe("none");
  });

  it("skips HSA tier when hsaCoverage is none", () => {
    const s = createTestScenario({
      taxProfile: {
        ...defaultPlanner().scenarios[0].taxProfile,
        hsaCoverage: "none",
        location: "austin",
        filing: "single",
      },
    });

    const res = calculateRetirementStrategy(s, testAssumptions, {
      targetSavings: 15000,
      taxPreference: "auto",
      enableBackdoor: true,
      enableMegaBackdoor: false,
    });

    const hsaTier = res.tiers.find((t) => t.id === "hsa")!;
    expect(hsaTier.allocated).toBe(0);
    expect(hsaTier.status).toBe("ineligible");
  });

  it("allocates excess savings above all limits to taxable brokerage", () => {
    const s = createTestScenario({ base: "100000" });
    // Total 401(k) = $24,500. HSA = $4,400. IRA = $7,500. Total tax-advantaged = $36,400.
    // Target savings = $50,000.
    const res = calculateRetirementStrategy(s, testAssumptions, {
      targetSavings: 50000,
      taxPreference: "traditional",
      enableBackdoor: true,
      enableMegaBackdoor: false,
    });

    const taxableTier = res.tiers.find((t) => t.id === "taxable")!;
    expect(taxableTier.allocated).toBe(50000 - 36400);
    expect(taxableTier.status).toBe("filled");
  });

  it("provides meaningful presets", () => {
    const s = createTestScenario({ base: "120000" });
    const presets = getStrategyPresets(s, testAssumptions);

    expect(presets.length).toBeGreaterThanOrEqual(4);
    const matchOnly = presets.find((p) => p.id === "match-only")!;
    expect(matchOnly.amount).toBe(7200); // 6% of $120k
    const max401k = presets.find((p) => p.id === "max-401k")!;
    expect(max401k.amount).toBe(24500 + 4400 + 7500);
  });

  it("omits redundant HSA preset when hsaCoverage is none", () => {
    const s = createTestScenario({
      base: "120000",
      taxProfile: { ...createTestScenario().taxProfile, hsaCoverage: "none" },
    });
    const presets = getStrategyPresets(s, testAssumptions);
    expect(presets.find((p) => p.id === "match-hsa")).toBeUndefined();
    const maxPreset = presets.find((p) => p.id === "max-401k")!;
    expect(maxPreset.label).toBe("Max 401(k) + IRA");
    expect(maxPreset.amount).toBe(24500 + 7500);
  });

  it("applies the strategy to the scenario cleanly", () => {
    const s = createTestScenario({
      base: "100000",
      retirementTargets: {
        ...defaultPlanner().scenarios[0].retirementTargets,
        primary: {
          ...defaultPlanner().scenarios[0].retirementTargets.primary,
          workplace401k: {
            mode: "percent",
            amount: "3",
            traditionalSharePercent: "100",
            rothSharePercent: "0",
          },
        },
      },
    });

    const res = calculateRetirementStrategy(s, testAssumptions, {
      targetSavings: 36400,
      taxPreference: "traditional",
      enableBackdoor: true,
      enableMegaBackdoor: false,
    });

    const updated = applyRetirementStrategy(s, res);

    expect(updated.retirementTargets.primary.workplace401k.amount).toBe("24.5"); // $24,500 / $100k = 24.5%
    expect(updated.retirementTargets.primary.workplace401k.traditionalSharePercent).toBe("100");
    expect(updated.benefits.hsa).toBe("4400");
    expect(updated.base).toBe("100000"); // Unrelated fields untouched
  });
});
