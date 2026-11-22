import { plannerScenarioErrors, validPlanner, type PlannerV2 } from "./planner";
import { startupComparison, type StartupInputs } from "./startupComparison";
import type { Projection } from "./projection";
import { projectScenario } from "./projection";

export function projectDecision(plan: PlannerV2, year: number) {
  if (
    !validPlanner(plan) ||
    plan.scenarios
      .slice(0, plan.comparison ? 2 : 1)
      .some((s) => Object.keys(plannerScenarioErrors(s, plan.shared)).length)
  )
    throw new Error("Check the preview inputs.");
  return plan.scenarios.slice(0, plan.comparison ? 2 : 1).map((s) => {
    const projection = projectScenario(s, plan.shared);
    const row = projection.rows[year],
      last = projection.rows.at(-1);
    if (
      !row ||
      !last ||
      ![row.surplus, row.stockContribution, last.endingBalance].every(
        Number.isFinite,
      )
    )
      throw new Error("Could not calculate this projection.");
    return {
      cash: row.surplus,
      stock: row.stockContribution,
      ending: last.endingBalance,
    };
  });
}
export function decisionSummary(
  projections: Projection[],
  year: number,
  startup: number | null,
  input: StartupInputs,
) {
  const values = projections.map((projection) => {
    const row = projection.rows[year],
      final = projection.rows.at(-1);
    if (
      !row ||
      !final ||
      ![row.surplus, row.stockContribution, final.endingBalance].every(
        Number.isFinite,
      )
    )
      throw new Error("Could not calculate this projection.");
    return {
      cash: row.surplus,
      stock: row.stockContribution,
      ending: final.endingBalance,
    };
  });
  let breakEvenShare: number | null = null;
  if (
    projections.length === 2 &&
    startup !== null &&
    startup >= 0 &&
    startup < 2
  ) {
    const gross = (projection: Projection) =>
      projection.rows.reduce(
        (sum, row) => sum + row.cashGross - row.spouseCash + row.stockGross,
        0,
      );
    breakEvenShare =
      startupComparison(
        input,
        projections[0].rows.length,
        gross(projections[startup]),
        gross(projections[1 - startup]),
      )?.breakEvenShare ?? null;
  }
  return { values, breakEvenShare };
}
export function solveSalary(plan: PlannerV2, year: number, offer: number) {
  try {
    if (
      !plan.comparison ||
      ![0, 1].includes(offer) ||
      !Number.isInteger(year) ||
      year < 0 ||
      year >= Number(plan.shared.years) ||
      !validPlanner(plan) ||
      plan.scenarios.some(
        (s) => Object.keys(plannerScenarioErrors(s, plan.shared)).length,
      )
    )
      return { status: "invalid" as const };
    const baseline = projectDecision(plan, year),
      target = baseline[1 - offer].cash;
    const start = Number(plan.scenarios[offer].base);
    if (!Number.isFinite(start) || start < 0 || start > 10_000_000)
      return { status: "invalid" as const };
    if (baseline[offer].cash >= target)
      return {
        status: "already" as const,
        salary: start,
        cash: baseline[offer].cash,
      };
    const calculate = (salary: number) => {
      const scenario = { ...plan.scenarios[offer], base: String(salary) };
      const cash = projectScenario(scenario, plan.shared).rows[year]?.surplus;
      if (cash === undefined || !Number.isFinite(cash)) throw new Error("Invalid salary projection.");
      return cash;
    };
    let low = start,
      high = Math.min(10_000_000, Math.max(start + 1000, start * 2));
    while (calculate(high) < target && high < 10_000_000) {
      low = high;
      high = Math.min(10_000_000, Math.max(high * 2, high + 1000));
    }
    if (calculate(high) < target) return { status: "unreachable" as const };
    while (high - low > 100) {
      const mid = (low + high) / 2;
      if (calculate(mid) >= target) high = mid;
      else low = mid;
    }
    const salary = Math.ceil(high),
      cash = calculate(salary);
    if (!Number.isFinite(cash) || cash < target)
      return { status: "unreachable" as const };
    return { status: "solution" as const, salary, cash };
  } catch {
    return { status: "failure" as const };
  }
}
