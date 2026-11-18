import { defaultPlanner } from "../src/lib/planner";
import { exportPlannerBackup, importPlannerBackup } from "../src/lib/plannerBackup";
import { startupScenarioView } from "../src/lib/startupComparison";
import { projectScenario } from "../src/lib/projection";
import { TAX_VERSION, taxSources } from "../src/data/taxRules";
import { retirementRuleSources } from "../src/data/retirementRules";
import { calculateRetirementStrategy } from "../src/lib/retirementStrategy";
import type { TaxStrategyPreference } from "../src/lib/retirementStrategy";

export function examplePlan(): string {
  return exportPlannerBackup(defaultPlanner());
}

export function optimizeRetirement(
  backup: string,
  targetSavings?: number,
  taxPreference: TaxStrategyPreference = "auto",
) {
  const { planner: plan, startup } = importPlannerBackup(backup);
  const scenario = startup.scenario === 0 ? startupScenarioView(plan.scenarios[0]) : plan.scenarios[0];
  const strategy = calculateRetirementStrategy(scenario, plan.shared, {
    targetSavings: targetSavings ?? 30000,
    taxPreference,
    enableBackdoor: true,
    enableMegaBackdoor: true,
  });
  return {
    scenarioName: scenario.name,
    targetSavings: strategy.targetSavings,
    recommendedTaxPreference: strategy.recommendedTaxPreference,
    marginalTaxRate: strategy.marginalTaxRate,
    waterfallTiers: strategy.tiers.map((t) => ({
      name: t.name,
      allocated: t.allocated,
      status: t.status,
      taxAdvantage: t.taxAdvantage,
      details: t.details,
    })),
    comparison: strategy.comparison,
  };
}

export function projectPlan(backup: string) {
  const { planner: plan, startup } = importPlannerBackup(backup);
  const scenarios = plan.scenarios.slice(0, plan.comparison ? 2 : 1).map((scenario, index) => {
    const projection = projectScenario(index === startup.scenario ? startupScenarioView(scenario) : scenario, plan.shared);
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
      "Startup option illustrations are not included in projections.",
      "Estimates use 2026 tax law with projected indexed thresholds, not future enacted law.",
      "Calculated tax coverage is limited to supported full-year W-2 locations and household situations; see docs/TAX_SOURCES.md.",
      "Investment income, later sales, withdrawals, many deductions and other assets or liabilities are excluded; projected balances are before future sale and withdrawal taxes.",
      "Retirement contribution eligibility and employer plan calculations have documented limitations; results are not tax or investment advice.",
    ],
    scenarios,
  };
}
