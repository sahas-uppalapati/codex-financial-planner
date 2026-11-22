import { templateSchedule } from "../data/vesting";
import { describe, expect, it, vi } from "vitest";
import { computeTechReality, computeVestingSchedule, getStatutoryStateSupplementalRate } from "./techComp";
import type { TechRealityInput } from "./techComp";
import {
  getTechProgressionTimeline,
  buildTechProgressionEvents,
} from "../data/techCompPresets";
import type { CareerEvent } from "./planner";

vi.mock("../data/techPresets.json", async (importOriginal) => {
  const original = await importOriginal<{ default: typeof import("../data/techPresets.json") }>();
  return { default: {
    ...original.default,
    techLevels: { ...original.default.techLevels, google: [
      { id: "l3", level: "Junior", title: "Junior", stage: "entry", experienceYears: 1 },
      { id: "l4", level: "Senior", title: "Senior", stage: "mid", experienceYears: 3 },
      { id: "l5", level: "Lead", title: "Lead", stage: "senior", experienceYears: 6 },
    ] },
  } };
});

vi.mock("../data/presets", async (importOriginal) => {
  const original = await importOriginal<typeof import("../data/presets")>();
  const example = original.compensationPresets[0];
  const presets = [
    { ...example, company: "Google", stage: "entry", scope: "United States", base: 100000, stock: 20000, bonusProjection: 5000, stockKind: "annualized" },
    { ...example, company: "Google", stage: "mid", scope: "United States", base: 150000, stock: 30000, bonusProjection: 10000, stockKind: "annualized" },
  ];
  return { ...original, findCompensationPreset: (company: string, stage: string, scope: string) =>
    presets.find((preset) => preset.company === company && preset.stage === stage && preset.scope === scope),
  };
});

describe("techComp calculations", () => {
  it("computes accurate 4-year vesting schedule for Amazon historical 5/15/40/40", () => {
    const amazonSchedule = templateSchedule("amazon-historical");
    const result = computeVestingSchedule(100000, amazonSchedule, 400000);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ year: 1, percent: 5, value: 20000 });
    expect(result[1]).toEqual({ year: 2, percent: 15, value: 60000 });
    expect(result[2]).toEqual({ year: 3, percent: 40, value: 160000 });
    expect(result[3]).toEqual({ year: 4, percent: 40, value: 160000 });
  });

  it("computes accurate 4-year vesting schedule for Amazon current 5/15/45/35 offer", () => {
    const amazonSchedule = templateSchedule("amazon");
    const result = computeVestingSchedule(27250, amazonSchedule, 109000);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ year: 1, percent: 5, value: 5450 });
    expect(result[1]).toEqual({ year: 2, percent: 15, value: 16350 });
    expect(result[2]).toEqual({ year: 3, percent: 45, value: 49050 });
    expect(result[3]).toEqual({ year: 4, percent: 35, value: 38150 });
  });

  it("computes default even 25% schedule when no grant is provided", () => {
    const result = computeVestingSchedule(100000);
    expect(result[0]).toEqual({ year: 1, percent: 25, value: 100000 });
    expect(result[1]).toEqual({ year: 2, percent: 25, value: 100000 });
    expect(result[2]).toEqual({ year: 3, percent: 25, value: 100000 });
    expect(result[3]).toEqual({ year: 4, percent: 25, value: 100000 });
  });
  it("computes realistic cash flow for Google L5 in San Francisco", () => {
    const input: TechRealityInput = {
      base: 241000,
      annualRsu: 176000,
      bonus: 36000,
      rent: 2800,
      otherLivingExpenses: 1700,
      locationId: "san-francisco",
      filing: "single",
      companyId: "google",
      vestingCadence: "quarterly",
    };

    const result = computeTechReality(input);

    // Total gross is $453,000
    expect(result.totalAnnualGrossComp).toBe(453000);

    // Base monthly gross ~$20,083
    expect(result.monthlyGrossBase).toBe(20083);

    // Monthly base take-home should be healthy after taxes and 401k
    expect(result.monthlyBaseTakeHome).toBeGreaterThan(9000);
    expect(result.monthlyBaseTakeHome).toBeLessThan(13000);

    // Rent ($2,800) should be comfortable (< 30% of base take-home)
    expect(result.rentToTakeHomeRatio).toBeLessThan(0.3);
    expect(result.housingSafetyTier).toBe("Comfortable");

    // Lumpy vest quarterly surge
    expect(result.vestEventsPerYear).toBe(4);
    expect(result.grossVestPerEvent).toBe(44000);
    expect(result.netVestPerEvent).toBeGreaterThan(20000);

    // Supplemental tax gap: California tech earner with $453k TC has a marginal rate > statutory withholding (~33.68%)
    expect(result.annualSurpriseTaxBill).toBeGreaterThan(0);

    // Google 50% match on 401k up to $11,750 cap
    expect(result.annualEmployerMatch).toBe(11750);

    // Year 4 cliff percentage reflects $176k / $453k (~39%)
    expect(result.year4CliffPercentage).toBeGreaterThanOrEqual(35);
    expect(result.year4CliffAnnualDrop).toBe(176000);
  });

  it("handles 0% state tax locations like Seattle and flags stretched housing", () => {
    const input: TechRealityInput = {
      base: 134000, // Amazon L4
      annualRsu: 32000,
      bonus: 16000,
      rent: 3200, // High rent relative to base
      otherLivingExpenses: 1800,
      locationId: "seattle",
      filing: "single",
      companyId: "amazon",
      vestingCadence: "quarterly",
    };

    const result = computeTechReality(input);

    expect(getStatutoryStateSupplementalRate("seattle")).toBe(0);
    // Base monthly take-home should be around ~$6,500 - $7,500
    // Rent $3,200 / ~$7,000 = ~45% => "Stretched"
    expect(result.rentToTakeHomeRatio).toBeGreaterThan(0.4);
    expect(result.housingSafetyTier).toBe("Stretched");

    // Amazon 401k match: 50% of first 4% of base pay = 2% of $134,000 = $2,680
    expect(result.annualEmployerMatch).toBe(2680);
  });

  it("flags equity-dependent housing when rent consumes over 50% of base take-home", () => {
    const input: TechRealityInput = {
      base: 120000,
      annualRsu: 200000, // heavily equity skewed
      bonus: 10000,
      rent: 4500, // rent higher than 50% of base take-home
      otherLivingExpenses: 1500,
      locationId: "san-francisco",
      filing: "single",
      companyId: "meta",
      vestingCadence: "quarterly",
    };

    const result = computeTechReality(input);
    expect(result.rentToTakeHomeRatio).toBeGreaterThan(0.5);
    expect(result.housingSafetyTier).toBe("Equity-Dependent");
  });

  describe("career progression & promotion timelines", () => {
    it("builds a timeline and promotion from available compensation, stopping at missing data", () => {
      const steps = getTechProgressionTimeline("google", "l3", "columbus", 2026, 10);
      expect(steps).toHaveLength(2);
      expect(steps[0]).toMatchObject({
        levelId: "l3", monthsFromStart: 0, monthLabel: "2026-01",
        totalComp: 125000, isCurrent: true,
      });
      expect(steps[1]).toMatchObject({
        levelId: "l4", monthsFromStart: 24, monthLabel: "2028-01",
        base: 150000, bonus: 10000, annualRsu: 30000,
        totalComp: 190000, compDelta: 65000, isCurrent: false,
      });
      const events = buildTechProgressionEvents("google", "l3", "columbus", "emp-1", 2026, 10);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        kind: "promotion", month: "2028-01", issuerId: "emp-1",
        base: "150000", bonus: "10000", awardValue: "0", promotionTargetTc: "190000",
        awardTemplate: "google-quarterly", presetProgression: "google",
      });
      expect(getTechProgressionTimeline("google", "l5", "columbus", 2026, 10)).toEqual([]);
      expect(buildTechProgressionEvents("google", "l5", "columbus", "emp-1", 2026, 10)).toEqual([]);
    });

    it("preserves manual career events and truncates on collision", () => {
      const manualEvent: CareerEvent = {
        id: "manual-job",
        kind: "job",
        month: "2027-06",
        issuerId: "other-emp",
        role: "Startup CTO",
        base: "300000",
        bonus: "0",
        growth: "0",
        awardValue: "0",
        awardTemplate: "annual",
        awardTreatment: "sell",
        refresherValue: "0",
        refresherAfter: "12",
        refresherEvery: "12",
        refresherTemplate: "annual",
        refresherTreatment: "sell",
      };

      // A manual event before the first promotion prevents generated events from overriding it.
      const events = buildTechProgressionEvents(
        "google",
        "l3",
        "columbus",
        "emp-google",
        2026,
        10,
        [manualEvent],
      );

      expect(events).toEqual([manualEvent]);
    });
  });
});
