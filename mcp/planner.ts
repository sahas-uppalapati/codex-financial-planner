import { defaultPlanner } from "../src/lib/planner";
import { exportPlannerBackup, importPlannerBackup } from "../src/lib/plannerBackup";
import { projectScenario } from "../src/lib/projection";
import { TAX_VERSION, taxSources } from "../src/data/taxRules";
import { retirementRuleSources } from "../src/data/retirementRules";

export function examplePlan(): string {
  return exportPlannerBackup(defaultPlanner());
}

export function projectPlan(backup: string) {
  const plan = importPlannerBackup(backup);
  const scenarios = plan.scenarios.slice(0, plan.comparison ? 2 : 1).map((scenario) => {
    const projection = projectScenario(scenario, plan.shared);
    return { name: scenario.name, ...projection, months: undefined };
  });
  return {
    input: plan,
    provenance: {
      model: "CareerWorth monthly projection",
      adapterVersion: "1.0.0",
      taxRules: TAX_VERSION,
      taxSources,
      retirementRuleSources,
    },
    limitations: [
      "Estimates use 2026 tax law with projected indexed thresholds, not future enacted law.",
      "Calculated tax coverage is limited to supported full-year W-2 locations and household situations; see TAX_SOURCES.md.",
      "Investment income, later sales, withdrawals, many deductions and other assets or liabilities are excluded; projected balances are before future sale and withdrawal taxes.",
      "Retirement contribution eligibility and employer plan calculations have documented limitations; results are not tax or investment advice.",
    ],
    scenarios,
  };
}
