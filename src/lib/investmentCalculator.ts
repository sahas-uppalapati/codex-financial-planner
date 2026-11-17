import { numberError, validPlanner } from "./planner";
import type { PlannerV2, ScenarioV2 } from "./planner";
import { projectScenario } from "./projection";

export const calculatorModes = [
  { id: "ending", label: "Ending balance" },
  { id: "saving", label: "Monthly saving needed" },
  { id: "time", label: "Time to target" },
  { id: "starting", label: "Starting balance needed" },
  { id: "return", label: "Required return" },
] as const;
export type CalculatorMode = (typeof calculatorModes)[number]["id"];
export type CalculatorSource = "standalone" | "career";
export interface CalculatorDraft {
  source: CalculatorSource;
  mode: CalculatorMode;
  starting: string;
  monthly: string;
  returns: string;
  years: string;
  target: string;
  extraMonthly: string;
}
export const defaultCalculatorDraft: CalculatorDraft = {
  source: "standalone",
  mode: "ending",
  starting: "20000",
  monthly: "1000",
  returns: "5",
  years: "10",
  target: "1000000",
  extraMonthly: "0",
};
export type CalculatorField = Exclude<keyof CalculatorDraft, "mode" | "source">;
export function calculatorFields(d: CalculatorDraft): CalculatorField[] {
  const fields: CalculatorField[] = [];
  if (d.mode !== "ending") fields.push("target");
  if (d.source === "standalone") {
    if (d.mode !== "starting") fields.push("starting");
    if (d.mode !== "saving") fields.push("monthly");
    if (d.mode !== "return") fields.push("returns");
  } else if (d.mode !== "saving") fields.push("extraMonthly");
  if (d.mode !== "time") fields.push("years");
  return fields;
}
export function calculatorErrors(d: CalculatorDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!["standalone", "career"].includes(d.source))
    errors.source = "Choose an input source.";
  if (!calculatorModes.some((m) => m.id === d.mode))
    errors.mode = "Choose a calculator mode.";
  for (const key of calculatorFields(d)) {
    const min = key === "returns" ? -99.9 : key === "years" ? 1 : 0;
    const max =
      key === "returns"
        ? 30
        : key === "years"
          ? 40
          : key === "target"
            ? 1e12
            : key === "starting"
              ? 1e7
              : 1e6;
    const error = numberError(d[key], min, max, key === "years");
    if (error) errors[key] = error;
  }
  return errors;
}
export interface BalancePath {
  starting: number;
  /** Index 0 is the starting balance; subsequent points are month-ends. */
  balances: number[];
}
export interface CalculatorResult extends BalancePath {
  name: string;
  answer: number | null;
  status: "solved" | "already-satisfied" | "not-found";
  baseline?: BalancePath;
  warnings: string[];
}
export interface CalculatorRequest {
  draft: CalculatorDraft;
  plan?: PlannerV2;
}

export function standalonePath(
  starting: number,
  monthly: number,
  annualReturn: number,
  months: number,
): BalancePath {
  if (
    ![starting, monthly, annualReturn, months].every(Number.isFinite) ||
    starting < 0 ||
    starting > 1e7 ||
    monthly < 0 ||
    monthly > 1e6 ||
    annualReturn < -99.9 ||
    annualReturn > 30 ||
    !Number.isInteger(months) ||
    months < 0 ||
    months > 480
  )
    throw new RangeError(
      "Use supported investment amounts, returns, and a horizon of at most 40 years.",
    );
  const rate = Math.expm1(Math.log1p(annualReturn / 100) / 12);
  const balances = [starting];
  for (let month = 0; month < months; month++) {
    const next = balances[month] * (1 + rate) + monthly;
    if (!Number.isFinite(next))
      throw new RangeError("Calculation exceeded numerical limits.");
    balances.push(next);
  }
  return { starting, balances };
}

const ending = (path: BalancePath) => path.balances[path.balances.length - 1];
const tolerance = (target: number) => Math.max(1e-6, Math.abs(target) * 1e-12);

/** A bounded bracket search. Scan non-linear career models before refining a crossing. */
function solve(
  evaluate: (value: number) => BalancePath,
  target: number,
  low: number,
  high: number,
  scan: boolean,
) {
  let lower = low;
  const lowerPath = evaluate(lower);
  if (ending(lowerPath) >= target - tolerance(target))
    return { value: lower, path: lowerPath };
  const steps = scan ? 64 : 1;
  for (let step = 1; step <= steps; step++) {
    let upper = low + ((high - low) * step) / steps;
    let upperPath = evaluate(upper);
    if (ending(upperPath) >= target) {
      for (let i = 0; i < 60; i++) {
        const middle = (lower + upper) / 2;
        const middlePath = evaluate(middle);
        if (ending(middlePath) >= target) {
          upper = middle;
          upperPath = middlePath;
        } else lower = middle;
        if (Math.abs(ending(upperPath) - target) <= tolerance(target)) break;
      }
      // A threshold in the career model can cause a jump; verify attainment rather than promise equality.
      if (
        Number.isFinite(upper) &&
        ending(upperPath) >= target - tolerance(target)
      )
        return { value: upper, path: upperPath };
      return null;
    }
    lower = upper;
  }
  return null;
}

function calculateOne(
  d: CalculatorDraft,
  plan?: PlannerV2,
  scenario?: ScenarioV2,
): CalculatorResult {
  const career = d.source === "career";
  const months = d.mode === "time" ? 480 : Number(d.years) * 12;
  const target = Number(d.target);
  const warnings: string[] = [];
  const path = (value?: number): BalancePath => {
    if (!career)
      return standalonePath(
        d.mode === "starting" ? (value ?? 0) : Number(d.starting),
        d.mode === "saving" ? (value ?? 0) : Number(d.monthly),
        d.mode === "return" ? (value ?? 0) : Number(d.returns),
        months,
      );
    if (!plan || !scenario)
      throw new RangeError(
        "Correct the career plan inputs before calculating.",
      );
    const shared = {
      ...plan.shared,
      // Later events stay in the model when inspecting an earlier deadline.
      years: String(Math.max(Number(plan.shared.years), months / 12)),
      starting:
        d.mode === "starting"
          ? String(Number(plan.shared.starting) + (value ?? 0))
          : plan.shared.starting,
      returns:
        d.mode === "return"
          ? String(value ?? Number(plan.shared.returns))
          : plan.shared.returns,
    };
    const result = projectScenario(scenario, shared, {
      additionalMonthlyDeposit:
        d.mode === "saving" ? (value ?? 0) : Number(d.extraMonthly),
    });
    return {
      starting: result.startingTotal,
      balances: [
        result.startingTotal,
        ...result.months.slice(0, months).map((m) => m.endingBalance),
      ],
    };
  };
  let baseline: BalancePath | undefined;
  if (career && plan && scenario) {
    const projection = projectScenario(scenario, {
      ...plan.shared,
      years: String(Math.max(Number(plan.shared.years), months / 12)),
    });
    baseline = {
      starting: projection.startingTotal,
      balances: [
        projection.startingTotal,
        ...projection.months.slice(0, months).map((m) => m.endingBalance),
      ],
    };
    warnings.push(...projection.warnings);
  }
  const name = career ? scenario!.name : "Standalone investments";
  const result = (
    p: BalancePath,
    answer: number | null,
    status: CalculatorResult["status"],
  ): CalculatorResult => ({ ...p, name, answer, status, baseline, warnings });
  if (d.mode === "ending") {
    const p = path();
    return result(p, ending(p), "solved");
  }
  if (d.mode === "time") {
    const p = path();
    const month = p.balances.findIndex((balance) => balance >= target);
    return result(
      p,
      month < 0 ? null : month,
      month < 0 ? "not-found" : month === 0 ? "already-satisfied" : "solved",
    );
  }
  const low = d.mode === "return" ? -99.9 : 0;
  const high =
    d.mode === "return"
      ? 30
      : d.mode === "saving"
        ? 1e6
        : 1e7 - (career ? Number(plan!.shared.starting) : 0);
  const solution = solve(path, target, low, high, career);
  if (!solution) return result(baseline ?? path(low), null, "not-found");
  // Return a usable amount/rate and verify the rounded value through the same model.
  const precision = d.mode === "return" ? 1e6 : 100;
  let answer = Math.min(
    high,
    Math.round(solution.value * precision) / precision,
  );
  let solvedPath = path(answer);
  if (ending(solvedPath) < target - tolerance(target)) {
    answer = Math.min(high, Math.ceil(solution.value * precision) / precision);
    solvedPath = path(answer);
  }
  if (ending(solvedPath) < target - tolerance(target))
    return result(baseline ?? path(low), null, "not-found");
  return result(
    solvedPath,
    answer,
    d.mode !== "return" && answer === 0 ? "already-satisfied" : "solved",
  );
}

export function calculateInvestments({
  draft,
  plan,
}: CalculatorRequest): CalculatorResult[] {
  const errors = calculatorErrors(draft);
  if (Object.keys(errors).length)
    throw new RangeError(Object.values(errors)[0]);
  if (draft.source === "standalone") return [calculateOne(draft)];
  if (!plan || !validPlanner(plan))
    throw new RangeError("Correct the career plan inputs before calculating.");
  return plan.scenarios
    .slice(0, plan.comparison ? 2 : 1)
    .map((s) => calculateOne(draft, plan, s));
}
