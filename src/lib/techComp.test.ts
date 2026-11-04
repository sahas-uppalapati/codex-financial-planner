import { describe, expect, it } from "vitest";
import { computeTechReality, computeVestingSchedule, getStatutoryStateSupplementalRate } from "./techComp";
import type { TechRealityInput } from "./techComp";
import {
  getTechProgressionTimeline,
  buildTechProgressionEvents,
} from "../data/techCompPresets";
import type { CareerEvent } from "./planner";

describe("techComp calculations", () => {
  it("computes accurate 4-year vesting schedule for Amazon historical 5/15/40/40", () => {
    const amazonSchedule = [
      { month: "12", percent: "5" },
      { month: "24", percent: "15" },
      { month: "30", percent: "20" },
      { month: "36", percent: "20" },
      { month: "42", percent: "20" },
      { month: "48", percent: "20" },
    ];
    const result = computeVestingSchedule(100000, amazonSchedule, 400000);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ year: 1, percent: 5, value: 20000 });
    expect(result[1]).toEqual({ year: 2, percent: 15, value: 60000 });
    expect(result[2]).toEqual({ year: 3, percent: 40, value: 160000 });
    expect(result[3]).toEqual({ year: 4, percent: 40, value: 160000 });
  });

  it("computes accurate 4-year vesting schedule for Amazon current 5/15/45/35 offer", () => {
    const amazonSchedule = [
      { month: "12", percent: "5" },
      { month: "24", percent: "15" },
      { month: "30", percent: "23" },
      { month: "36", percent: "22" },
      { month: "42", percent: "18" },
      { month: "48", percent: "17" },
    ];
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
    it("generates full 4-step progression timeline for Google starting at L3", () => {
      const steps = getTechProgressionTimeline("google", "l3", "san-francisco", 2026, 10);
      expect(steps).toHaveLength(4);

      // Step 0: Starting L3
      expect(steps[0]).toMatchObject({
        levelId: "l3",
        levelName: "L3",
        monthsFromStart: 0,
        yearsFromStart: 0,
        yearsFromPrev: 0,
        monthLabel: "2026-01",
        base: 166000,
        bonus: 20000,
        annualRsu: 44000,
        totalComp: 230000,
        isCurrent: true,
      });

      // Step 1: L4 (+2 yrs = 24 months)
      expect(steps[1]).toMatchObject({
        levelId: "l4",
        levelName: "L4",
        monthsFromStart: 24,
        yearsFromStart: 2,
        yearsFromPrev: 2,
        monthLabel: "2028-01",
        base: 204000,
        bonus: 30000,
        annualRsu: 125000,
        totalComp: 359000,
        compDelta: 129000,
        isCurrent: false,
      });

      // Step 2: L5 (+3 yrs = 60 months total)
      expect(steps[2]).toMatchObject({
        levelId: "l5",
        levelName: "L5",
        monthsFromStart: 60,
        yearsFromStart: 5,
        yearsFromPrev: 3,
        monthLabel: "2031-01",
        base: 241000,
        bonus: 36000,
        annualRsu: 176000,
        totalComp: 453000,
        compDelta: 94000,
        isCurrent: false,
      });

      // Step 3: L6 (+3 yrs = 96 months total)
      expect(steps[3]).toMatchObject({
        levelId: "l6",
        levelName: "L6",
        monthsFromStart: 96,
        yearsFromStart: 8,
        yearsFromPrev: 3,
        monthLabel: "2034-01",
        base: 280000,
        bonus: 55000,
        annualRsu: 275000,
        totalComp: 610000,
        compDelta: 157000,
        isCurrent: false,
      });
    });

    it("handles terminal level gracefully", () => {
      const steps = getTechProgressionTimeline("google", "l6", "san-francisco", 2026, 10);
      expect(steps).toHaveLength(1);
      expect(steps[0].levelId).toBe("l6");
      expect(steps[0].isCurrent).toBe(true);

      const events = buildTechProgressionEvents("google", "l6", "san-francisco", "emp-1", 2026, 10);
      expect(events).toEqual([]);
    });

    it("generates correct CareerEvents with promotion equity awards", () => {
      const events = buildTechProgressionEvents("google", "l4", "san-francisco", "emp-google", 2026, 10);
      // L4 -> L5 (+3 yrs = 36mo), L5 -> L6 (+3 yrs = 72mo)
      expect(events).toHaveLength(2);

      expect(events[0]).toMatchObject({
        kind: "promotion",
        month: "2029-01",
        issuerId: "emp-google",
        base: "241000",
        bonus: "36000",
        awardValue: String(176000 * 4), // $704,000 4-year award
        awardTemplate: "google-quarterly",
        presetProgression: "google",
      });

      expect(events[1]).toMatchObject({
        kind: "promotion",
        month: "2032-01",
        issuerId: "emp-google",
        base: "280000",
        bonus: "55000",
        awardValue: String(275000 * 4), // $1,100,000 4-year award
        awardTemplate: "google-quarterly",
        presetProgression: "google",
      });
    });

    it("preserves manual career events and truncates on collision", () => {
      const manualEvent: CareerEvent = {
        id: "manual-job",
        kind: "job",
        month: "2030-06",
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

      // Starting at L3: promotions proposed at 2028-01 (L4), 2031-01 (L5), 2034-01 (L6)
      // Manual event at 2030-06 should collide with 2031-01, leaving only 2028-01 + manual event!
      const events = buildTechProgressionEvents(
        "google",
        "l3",
        "san-francisco",
        "emp-google",
        2026,
        10,
        [manualEvent],
      );

      expect(events).toHaveLength(2);
      expect(events[0].month).toBe("2028-01");
      expect(events[0].kind).toBe("promotion");
      expect(events[1].month).toBe("2030-06");
      expect(events[1].kind).toBe("job");
    });
  });
});
