import { describe, expect, it } from "vitest";
import {
  calculateInvestments,
  defaultCalculatorDraft,
  standalonePath,
} from "./investmentCalculator";
import type { CalculatorDraft } from "./investmentCalculator";
import { defaultPlanner } from "./planner";
import { projectScenario } from "./projection";

const draft = (patch: Partial<CalculatorDraft> = {}): CalculatorDraft => ({
  ...defaultCalculatorDraft,
  ...patch,
});
const calculate = (patch: Partial<CalculatorDraft>) =>
  calculateInvestments({ draft: draft(patch) })[0];
function careerPlan() {
  const plan = defaultPlanner();
  plan.shared = {
    ...plan.shared,
    starting: "20000",
    years: "5",
    returns: "0",
    inflation: "0",
    taxInflation: "0",
  };
  for (const s of plan.scenarios) {
    s.base = "12000";
    s.bonus = "0";
    s.stock = "0";
    s.growth = "0";
    s.taxProfile.mode = "manual";
    s.tax = "0";
    s.expenses = {
      housing: "0",
      food: "0",
      healthcare: "0",
      transportation: "0",
      other: "0",
    };
    s.employerMatch.type = "none";
  }
  return plan;
}

describe("investment calculators", () => {
  it("uses effective monthly growth and verifies all standalone inverse modes against the forward calculation", () => {
    const rate = Math.expm1(Math.log1p(0.05) / 12);
    const expected =
      20000 * 1.05 ** 10 + (1000 * ((1 + rate) ** 120 - 1)) / rate;
    expect(calculate({}).answer).toBeCloseTo(expected, 6);
    const target = "200000";
    for (const mode of ["saving", "starting", "return"] as const) {
      const result = calculate({ mode, target });
      expect(result.status).toBe("solved");
      const forward = standalonePath(
        mode === "starting" ? result.answer! : 20000,
        mode === "saving" ? result.answer! : 1000,
        mode === "return" ? result.answer! : 5,
        120,
      );
      expect(forward.balances.at(-1)!).toBeGreaterThanOrEqual(
        Number(target) - 0.00001,
      );
      expect(forward.balances.at(-1)! - Number(target)).toBeLessThan(2);
    }
    const time = calculate({ mode: "time", target });
    expect(time.answer).toBeGreaterThan(0);
    expect(time.balances[time.answer! - 1]).toBeLessThan(Number(target));
    expect(time.balances[time.answer!]).toBeGreaterThanOrEqual(Number(target));
  });

  it("handles zero and negative returns, first crossings, and targets outside supported limits", () => {
    expect(
      calculate({ returns: "0", years: "1", starting: "0", monthly: "1000" })
        .answer,
    ).toBe(12000);
    expect(
      calculate({ returns: "-10", years: "1", starting: "1000", monthly: "0" })
        .answer,
    ).toBeCloseTo(900);
    const already = calculate({
      mode: "time",
      target: "500",
      starting: "1000",
      monthly: "0",
      returns: "-10",
    });
    expect(already.status).toBe("already-satisfied");
    expect(already.answer).toBe(0);
    expect(calculate({ mode: "saving", target: "0" }).answer).toBe(0);
    expect(calculate({ mode: "starting", target: "0" }).answer).toBe(0);
    expect(calculate({ mode: "return", target: "0" }).answer).toBe(-99.9);
    for (const mode of ["saving", "starting", "return", "time"] as const)
      expect(
        calculate({
          mode,
          years: "1",
          target: "1000000000000",
          starting: "0",
          monthly: "0",
          returns: "0",
        }).status,
      ).toBe("not-found");
    expect(
      calculate({
        mode: "time",
        target: "480000",
        starting: "0",
        monthly: "1000",
        returns: "0",
      }).answer,
    ).toBe(480);
  });

  it("rejects invalid visible inputs and accepts an unused solved field", () => {
    for (const patch of [
      { starting: "" },
      { monthly: "Infinity" },
      { years: "1.5" },
      { returns: "-100" },
      { target: "1000000000001", mode: "saving" as const },
    ])
      expect(() => calculate(patch)).toThrow(RangeError);
    expect(() =>
      calculate({ mode: "saving", monthly: "invalid" }),
    ).not.toThrow();
    expect(() => standalonePath(0, 1, 0, 481)).toThrow(RangeError);
  });

  it("matches both career projections at an earlier deadline without dropping later events or changing the plan", () => {
    const plan = careerPlan();
    plan.comparison = true;
    plan.scenarios[1].base = "24000";
    plan.scenarios[0].events = [
      {
        id: "promotion",
        kind: "promotion",
        month: "2029-01",
        role: "Senior",
        issuerId: plan.scenarios[0].employerId,
        base: "36000",
        bonus: "0",
        growth: "0",
        awardValue: "0",
        awardTemplate: "annual",
        awardTreatment: "sell",
        refresherValue: "0",
        refresherTemplate: "annual",
        refresherTreatment: "sell",
        refresherAfter: "12",
        refresherEvery: "12",
      },
    ];
    const before = JSON.stringify(plan);
    const result = calculateInvestments({
      draft: draft({ source: "career", years: "1" }),
      plan,
    });
    expect(result).toHaveLength(2);
    result.forEach((r, index) => {
      expect(r.answer).toBe(
        projectScenario(plan.scenarios[index], plan.shared).rows[0]
          .endingBalance,
      );
      expect(r.balances).toHaveLength(13);
    });
    expect(JSON.stringify(plan)).toBe(before);
  });

  it("solves career saving, starting funds and return through the actual engine, and searches 40 years", () => {
    const plan = careerPlan();
    const run = (patch: Partial<CalculatorDraft>) =>
      calculateInvestments({
        draft: draft({ source: "career", years: "2", ...patch }),
        plan,
      })[0];
    expect(run({ mode: "ending" }).answer).toBe(44000);
    expect(run({ mode: "saving", target: "68000" }).answer).toBeCloseTo(
      1000,
      3,
    );
    expect(run({ mode: "starting", target: "68000" }).answer).toBeCloseTo(
      24000,
      3,
    );
    const target = projectScenario(plan.scenarios[0], {
      ...plan.shared,
      returns: "8",
    }).rows[1].endingBalance;
    expect(run({ mode: "return", target: String(target) }).answer).toBeCloseTo(
      8,
      4,
    );
    expect(run({ mode: "time", target: "500000" }).answer).toBe(480);
    expect(run({ mode: "saving", target: "100" }).status).toBe(
      "already-satisfied",
    );
    expect(run({ mode: "saving", target: "1000000000000" }).status).toBe(
      "not-found",
    );
    expect(run({ mode: "starting", target: "1000000000000" }).status).toBe(
      "not-found",
    );
    plan.scenarios[0].base = "invalid";
    expect(() => run({})).toThrow("Correct the career plan");
    expect(() => calculateInvestments({ draft: draft(), plan })).not.toThrow();
  });
});
