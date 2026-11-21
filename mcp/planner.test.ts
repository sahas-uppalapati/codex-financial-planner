import { describe, expect, it } from "vitest";
import { examplePlan, optimizeRetirement, projectPlan } from "./planner";
import { projectScenario } from "../src/lib/projection";
import { defaultPlanner } from "../src/lib/planner";
import { exportPlannerBackup } from "../src/lib/plannerBackup";

describe("local MCP planner", () => {
  it("reuses the validated engine and returns input, sources, and limitations", () => {
    const backup = examplePlan();
    const result = projectPlan(backup);
    expect(result.scenarios[0].startingTotal).toBe(projectScenario(result.input.scenarios[0], result.input.shared).startingTotal);
    expect(result.scenarios[0].rows).toEqual(projectScenario(result.input.scenarios[0], result.input.shared).rows);
    expect(result.provenance.taxRules).toBe("US-W2-2026.1");
    expect(result.limitations.length).toBeGreaterThan(0);
  });
  it("optimizes retirement waterfall allocations via MCP", () => {
    const backup = examplePlan();
    const result = optimizeRetirement(backup, 25000, "auto");
    expect(result.targetSavings).toBe(25000);
    expect(result.waterfallTiers.length).toBeGreaterThan(0);
    expect(result.marginalTaxRate).toBeGreaterThan(0);
  });
  it("requires saved confirmations before allocating to backdoor Roth accounts", () => {
    const plan = defaultPlanner();
    const scenario = plan.scenarios[0];
    scenario.base = "250000";
    const targets = scenario.retirementTargets.primary;
    targets.backdoorConfirmed = true;
    targets.megaBackdoorSupported = true;
    const unconfirmed = optimizeRetirement(exportPlannerBackup(plan), 50000, "roth");
    expect(unconfirmed.comparison.strategy.iraType).not.toBe("backdoor");
    expect(unconfirmed.comparison.strategy.megaBackdoor).toBe(0);

    targets.iraBalanceZeroConfirmed = true;
    targets.megaBackdoorRoute = "in-plan";
    const confirmed = optimizeRetirement(exportPlannerBackup(plan), 50000, "roth");
    expect(confirmed.comparison.strategy.iraType).toBe("backdoor");
    expect(confirmed.comparison.strategy.megaBackdoor).toBeGreaterThan(0);
  });

  it("rejects malformed or out-of-range backups", () => {
    expect(() => projectPlan("{}")).toThrow();
    const data = JSON.parse(examplePlan());
    data.planner.scenarios[0].base = "999999999999";
    expect(() => projectPlan(JSON.stringify(data))).toThrow();
  });
});
