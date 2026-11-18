import { describe, expect, it } from "vitest";
import { defaultPlanner, type CareerEvent } from "./planner";
import { projectScenario } from "./projection";
import { emptyStartup } from "./startupComparison";
import {
  decisionSummary,
  previewPlan,
  projectDecision,
  solveSalary,
} from "./decisionTools";

describe("decision tools", () => {
  it("uses the selected year's surplus and keeps previews separate from the baseline", () => {
    const plan = defaultPlanner();
    plan.comparison = true;
    plan.scenarios[0].base = "100000";
    plan.scenarios[1].base = "160000";
    const original = structuredClone(plan),
      baseline = projectDecision(plan, 1);
    const projections = plan.scenarios.map((s) =>
      projectScenario(s, plan.shared),
    );
    const summary = decisionSummary(projections, 1, null, emptyStartup);
    expect(summary.values).toEqual(baseline);
    expect(summary.values[1].cash - summary.values[0].cash).toBe(
      projections[1].rows[1].surplus - projections[0].rows[1].surplus,
    );
    const preview = previewPlan(plan, 0, "10", "500", "3", false);
    expect(projectDecision(preview, 1)[0].cash).not.toBe(baseline[0].cash);
    expect(projectDecision(preview, 1)[1].ending).not.toBe(baseline[1].ending);
    expect(plan).toEqual(original);
    const result = solveSalary(plan, 1, 0);
    expect(result.status).toBe("solution");
    if (result.status === "solution")
      expect(result.cash).toBeGreaterThanOrEqual(baseline[1].cash);
  });
  it("reports an unreachable target when a later job replaces starting pay", () => {
    const plan = defaultPlanner();
    plan.comparison = true;
    plan.scenarios[0].base = "100000";
    plan.scenarios[1].base = "300000";
    const job: CareerEvent = {
      id: "new-job",
      kind: "job",
      issuerId: plan.scenarios[0].employerId,
      month: "2027-01",
      role: "New role",
      base: "100000",
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
    const promotion: CareerEvent = { ...job, id: "promotion", kind: "promotion", month: "2026-07" };
    plan.scenarios[0].events = [promotion, job];
    const preview = previewPlan(plan, 0, "0", plan.scenarios[0].expenses.housing, plan.shared.returns, true);
    expect(preview.scenarios[0].events).toEqual([job]);
    expect(plan.scenarios[0].events).toEqual([promotion, job]);
    expect(solveSalary(plan, 1, 0).status).toBe("unreachable");
    expect(solveSalary(plan, 1, 1).status).toBe("already");
    expect(solveSalary(plan, -1, 0).status).toBe("invalid");
  });
});
